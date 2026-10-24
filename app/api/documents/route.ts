import { logActivity } from '@/lib/audit-log';
import { extractOfficeText, extractPDFText } from '@/lib/parse';
import { readStoredFile } from '@/lib/storage';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { recordMetric } from '@/lib/metrics';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { requireUser, requireWorkspaceOwnership, requireDocumentOwnership, getOrCreateUserVault, isTrustedStorageUrl, isPublicWebUrl, badFileUrlResponse } from '@/lib/api-auth';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from 'cheerio';

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { name, url, workspaceId, fileSize, rawText, category } = await req.json().catch(() => ({}));
    const limited = rateLimit(user.id, LIMITS.ingest);
    if (limited) return limited;


    if (rawText !== undefined && typeof rawText !== 'string') {
      return NextResponse.json({ error: "Text must be a string." }, { status: 400 });
    }
    if (typeof rawText === 'string' && rawText.length > 500_000) {
      return NextResponse.json({ error: "That text is too long. Split it into smaller sources." }, { status: 413 });
    }
    if (!(typeof rawText === 'string' && rawText.trim()) && typeof url !== 'string') {
      return NextResponse.json({ error: "Add a file, a link or some text." }, { status: 400 });
    }

    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      const vault = await getOrCreateUserVault(user.id);
      targetWorkspaceId = vault.id;
    } else {
      const { workspace, response: ownerResp } = await requireWorkspaceOwnership(targetWorkspaceId, user.id);
      if (!workspace) return ownerResp;
    }

    let extractedText = "";
    let sourceType = "file";

    if (rawText && rawText.trim().length > 0) {
      extractedText = rawText.trim();
      sourceType = 'text';
    } else {

    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return '';
      }
    })();
    const isYouTube = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host);
    const isWebsite = !isYouTube && /^https?:\/\//i.test(url) && !isTrustedStorageUrl(url);

    if (isYouTube) {
      sourceType = 'youtube';
      try {
        const { YoutubeTranscript } = await import('youtube-transcript');
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        extractedText = transcript.map((t: { text: string }) => t.text).join(' ');
      } catch (err) {
        console.error("YouTube transcript extraction failed:", err);
        return NextResponse.json({ error: "This video doesn't have captions/transcript available, so it can't be added to your vault." }, { status: 400 });
      }
    } else if (isWebsite) {
      sourceType = 'website';
      if (!isPublicWebUrl(url)) return badFileUrlResponse();
      try {
        const response = await fetch(url, { redirect: 'error' });
        const html = await response.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        extractedText = $('body').text().replace(/\s+/g, ' ').trim();
      } catch (err) {
        console.error("Website extraction failed", err);
        return NextResponse.json({ error: "Could not fetch website content." }, { status: 400 });
      }
    } else {
      sourceType = 'file';
      if (!isTrustedStorageUrl(url)) return badFileUrlResponse();
      if (typeof name !== 'string' || !name) {
        return NextResponse.json({ error: "Missing file name." }, { status: 400 });
      }
      const stored = await readStoredFile(url);
      if (!stored) return NextResponse.json({ error: "Could not read the uploaded file. Please try again." }, { status: 400 });
      const buffer = stored.buffer;

      const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : 'unknown';

      if (extension === "pdf") {
        try {
          const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
          const prompt = "Please extract all text from this document accurately and format it as Markdown. Preserve headings (#, ##), bulleted lists, and bold text. Do not summarize, extract the full text. Output ONLY the markdown text without any other comments.";
          const result = await generativeModel.generateContent([
            prompt,
            { inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" } }
          ]);
          extractedText = result.response.text();
        } catch (err) {
          console.error("Gemini PDF extraction failed, falling back to plain text:", err);
          const rawPdfText = await extractPDFText(buffer);
          const lines = rawPdfText.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 0 && line.length < 60 && line === line.toUpperCase()) {
               lines[i] = `### ${line}`;
            }
          }
          extractedText = lines.join('\n');
        }
      } else if (extension === "docx") {
        try {
          const mammoth = await import("mammoth");
          const { default: TurndownService } = await import("turndown");
          const docxResult = await mammoth.convertToHtml({ buffer });
          extractedText = new TurndownService().turndown(docxResult.value);
        } catch (err) {
          console.error("Mammoth failed, falling back to officeparser", err);
          extractedText = await extractOfficeText(buffer, "docx");
        }
      } else if (extension === "pptx") {
        extractedText = await extractOfficeText(buffer, "pptx");
      } else if (extension === "txt") {
        extractedText = buffer.toString("utf-8");
      } else if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension as string)) {
        try {
          const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
          const prompt = "Please extract all text from this image accurately. If there are diagrams, describe them in text. If there is no text or diagrams, just describe the visual content in detail so a student can study it.";
          const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;

          const result = await generativeModel.generateContent([
            prompt,
            { inlineData: { data: buffer.toString("base64"), mimeType } }
          ]);
          extractedText = result.response.text();
        } catch (err) {
          console.error("Gemini Vision Error:", err);
        }
      }
    }

    }

    if (!extractedText) extractedText = "";
    try { extractedText = decodeURIComponent(extractedText); } catch { /* not URI-encoded */ }

    extractedText = extractedText.trim();

    if (sourceType !== 'youtube' && extractedText.length === 0) {
      return NextResponse.json({ error: "Could not read text from this file. Please ensure it is a valid, text-based document." }, { status: 400 });
    }

    // Give links a readable title instead of the raw URL.
    let docName: string = typeof name === 'string' && name.trim() ? name.trim() : (url || 'Untitled');
    if (sourceType === 'youtube' && (!name || name === url)) {
      try {
        const oembed = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
        if (oembed.ok) docName = (await oembed.json()).title || docName;
      } catch { /* keep the URL as the name */ }
    } else if (sourceType === 'website' && (!name || name === url)) {
      try { docName = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep the URL */ }
    }

    const newDoc = await prisma.document.create({
      data: { name: docName, url: url || 'text://pasted', workspaceId: targetWorkspaceId, fileSize, textContent: extractedText, sourceType, category: category || 'Note' }
    });

    recordMetric(user.id, 'upload_document').catch((e) => console.error("Failed to update gamification metric:", e));

    logActivity(user.id, 'upload_document', `Uploaded "${name}"`, req).catch(console.error);
    return NextResponse.json(newDoc);
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (workspaceId) {
      const { workspace, response: ownerResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return ownerResp;
    }

    // No workspace given: everything the user owns, including documents from older "desk" workspaces.
    // List view: no full text, but say whether the source is searchable (has chunks).
    const docs = await prisma.document.findMany({
      where: workspaceId ? { workspaceId } : { workspace: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        sourceType: true,
        fileSize: true,
        category: true,
        createdAt: true,
        workspaceId: true,
        _count: { select: { chunks: true } },
      },
    });

    return NextResponse.json(
      docs.map(({ _count, ...d }) => ({ ...d, chunkCount: _count.chunks, indexed: _count.chunks > 0 }))
    );
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const { doc, response: ownerResp } = await requireDocumentOwnership(id, user.id);
    if (!doc) return ownerResp;

    const supabase = await createClient();

    if (doc.url && doc.url.includes('workspace-files/')) {
      const urlParts = doc.url.split('workspace-files/');
      if (urlParts.length > 1) {
        const pathToDelete = urlParts[1];
        const { error: storageError } = await supabase.storage.from('workspace-files').remove([pathToDelete]);
        if (storageError) {
           console.error("Supabase storage deletion failed:", storageError);
           return NextResponse.json({ error: "Failed to delete file from storage" }, { status: 500 });
        }
      }
    }

    await prisma.document.delete({ where: { id } });

    logActivity(user.id, 'delete_document', 'Deleted a document', req).catch(console.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
