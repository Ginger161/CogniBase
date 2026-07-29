import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { requireUser, requireWorkspaceOwnership, requireDocumentOwnership, getOrCreateUserVault } from '@/lib/api-auth';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from 'cheerio';

const PDFParser = require("pdf2json");
const officeParser = require("officeparser");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { name, url, workspaceId, fileSize } = await req.json();

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

    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isWebsite = url.startsWith('http') && !url.includes('supabase.co');

    if (isYouTube) {
      sourceType = 'youtube';
      try {
        const { YoutubeTranscript } = require('youtube-transcript');
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        extractedText = transcript.map((t: any) => t.text).join(' ');
      } catch (err) {
        console.error("YouTube transcript extraction failed:", err);
        return NextResponse.json({ error: "This video doesn't have captions/transcript available, so it can't be added to your vault." }, { status: 400 });
      }
    } else if (isWebsite) {
      sourceType = 'website';
      try {
        const response = await fetch(url);
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
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

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
          let rawText = await extractPDFText(buffer);
          const lines = rawText.split('\n');
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
          const mammoth = require("mammoth");
          const Turndown = require("turndown");
          const TurndownService = Turndown.default || Turndown;
          const docxResult = await mammoth.convertToHtml({ buffer });
          const turndownService = new TurndownService();
          extractedText = turndownService.turndown(docxResult.value);
        } catch (err) {
          console.error("Mammoth failed, falling back to officeparser", err);
          if (typeof officeParser.parseOffice === 'function') {
            const ast = await officeParser.parseOffice(buffer, { fileType: extension });
            extractedText = typeof ast === 'string' ? ast : (ast.toText ? ast.toText() : JSON.stringify(ast));
          } else if (typeof officeParser.parseOfficeAsync === 'function') {
            extractedText = await officeParser.parseOfficeAsync(buffer);
          }
        }
      } else if (extension === "doc" || extension === "pptx") {
        if (typeof officeParser.parseOffice === 'function') {
          const ast = await officeParser.parseOffice(buffer, { fileType: extension });
          extractedText = typeof ast === 'string' ? ast : (ast.toText ? ast.toText() : JSON.stringify(ast));
        } else if (typeof officeParser.parseOfficeAsync === 'function') {
          extractedText = await officeParser.parseOfficeAsync(buffer);
        }
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

    if (!extractedText) extractedText = "";
    try { extractedText = decodeURIComponent(extractedText); } catch(e) {}

    extractedText = extractedText.trim();

    if (sourceType !== 'youtube' && extractedText.length === 0) {
      return NextResponse.json({ error: "Could not read text from this file. Please ensure it is a valid, text-based document." }, { status: 400 });
    }

    const newDoc = await prisma.document.create({
      data: { name, url, workspaceId: targetWorkspaceId, fileSize, textContent: extractedText, sourceType }
    });

    try {
      const origin = req.headers.get('origin') || new URL(req.url).origin;
      const cookieHeader = req.headers.get('cookie');
      await fetch(`${origin}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { 'cookie': cookieHeader } : {}) },
        body: JSON.stringify({ action: 'upload_document' })
      });
    } catch (metricErr) {
      console.error("Failed to update gamification metric:", metricErr);
    }

    return NextResponse.json(newDoc);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(req.url);
    let workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      const vault = await getOrCreateUserVault(user.id);
      workspaceId = vault.id;
    } else {
      const { workspace, response: ownerResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return ownerResp;
    }

    const docs = await prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
