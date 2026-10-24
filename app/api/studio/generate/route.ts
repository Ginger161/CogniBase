import { NextResponse } from 'next/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getOrCreateUserVault, requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';
import { getScopedText, resolveScopedDocs } from '@/lib/scope';
import { recordMetric } from '@/lib/metrics';
import { logActivity } from '@/lib/audit-log';
import { classifyAiError } from '@/lib/ai-errors';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const MAX_SOURCE_CHARS = 50000;

type Kind = 'flashcards' | 'mindmap' | 'slides';

const SPECS: Record<Kind, { assetType: string; label: string; prompt: string }> = {
  flashcards: {
    assetType: 'FLASHCARD',
    label: 'Flashcards',
    prompt:
      'You are an expert educational tutor. Analyze the provided text and generate 10 highly effective flashcards. Output strictly as a JSON array of objects with the keys "question" and "answer". No markdown, no commentary.',
  },
  mindmap: {
    assetType: 'MINDMAP',
    label: 'Mind map',
    prompt:
      'You are an expert visual educator. Analyze the provided text and map out the core concepts and their relationships using standard Mermaid.js flowchart syntax. You MUST use graph TD. You MUST create a deep, vertical, hierarchical tree with a single root node at the top, branching downwards into sub-topics. Do NOT create a flat horizontal list of disconnected nodes. Keep the node text concise. Output strictly as a JSON object with a single key "mermaidCode" containing the raw Mermaid syntax string. No markdown backticks, HTML or commentary.',
  },
  slides: {
    assetType: 'PRESENTATION',
    label: 'Slides',
    prompt:
      'You are an expert presentation designer. Analyze the text and create a 5-slide presentation outline. Output strictly as a JSON object with a "slides" array. Each slide has a "title" (string) and "bulletPoints" (array of strings, max 4 per slide). No markdown.',
  },
};

function isKind(x: unknown): x is Kind {
  return x === 'flashcards' || x === 'mindmap' || x === 'slides';
}

// Accepts the shape we asked for plus the near-misses models tend to produce.
function normalise(kind: Kind, raw: unknown): Prisma.InputJsonValue | null {
  const asObj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (kind === 'flashcards') {
    const list = Array.isArray(raw) ? raw : Array.isArray(asObj.flashcards) ? asObj.flashcards : null;
    const cards = (list ?? [])
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c?.question === 'string' && typeof c?.answer === 'string')
      .map((c) => ({ question: c.question as string, answer: c.answer as string }));
    return cards.length > 0 ? cards : null;
  }
  if (kind === 'mindmap') {
    const code = typeof asObj.mermaidCode === 'string' ? asObj.mermaidCode.replace(/```(mermaid)?/g, '').trim() : '';
    return code ? { mermaidCode: code } : null;
  }
  const list = Array.isArray(raw) ? raw : Array.isArray(asObj.slides) ? asObj.slides : null;
  const slides = (list ?? [])
    .map((s) => s as Record<string, unknown>)
    .filter((s) => typeof s?.title === 'string')
    .map((s) => {
      const bullets = Array.isArray(s.bulletPoints) ? s.bulletPoints : Array.isArray(s.bullets) ? s.bullets : [];
      return { title: s.title as string, bulletPoints: bullets.filter((b): b is string => typeof b === 'string') };
    });
  return slides.length > 0 ? slides : null;
}

async function generateJson(prompt: string): Promise<unknown> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const backoff = [1000, 2000, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      const text = (await model.generateContent(prompt)).response.text();
      return JSON.parse(text.replace(/^```json|```$/gm, '').trim());
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      const transient = msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded');
      if (!transient || attempt >= backoff.length) throw err;
      await new Promise((r) => setTimeout(r, backoff[attempt]));
    }
  }
}

// Body: { kind, documentIds? | workspaceId? | documentText? }. Generates, validates and saves a Studio asset.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    const limited = rateLimit(user.id, LIMITS.generate);
    if (limited) return limited;


    const { kind, workspaceId, documentIds, documentText } = await req.json().catch(() => ({}));
    if (!isKind(kind)) return NextResponse.json({ error: 'Unknown asset type.' }, { status: 400 });

    if (workspaceId) {
      const { workspace, response: wsResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return wsResp;
    }

    const docs = await resolveScopedDocs(user.id, { workspaceId, documentIds });
    let text: string = typeof documentText === 'string' ? documentText : '';
    if (!text) text = await getScopedText(user.id, { workspaceId, documentIds });
    if (!text.trim()) {
      return NextResponse.json({ error: 'There is no readable text in the selected sources.' }, { status: 400 });
    }

    const spec = SPECS[kind];
    let content: Prisma.InputJsonValue | null;
    try {
      content = normalise(kind, await generateJson(`${spec.prompt}\n\nText to analyze:\n${text.slice(0, MAX_SOURCE_CHARS)}`));
    } catch (err) {
      console.error(`Studio ${kind} generation failed:`, err);
      const failure = classifyAiError(err);
      return NextResponse.json({ error: failure.message, code: failure.kind }, { status: failure.status });
    }
    if (!content) {
      return NextResponse.json({ error: 'The AI returned something unusable. Please try again.' }, { status: 502 });
    }

    const saveWorkspaceId = docs[0]?.workspaceId || workspaceId || (await getOrCreateUserVault(user.id)).id;
    const title = docs.length === 1 ? `${spec.label} · ${docs[0].name}` : spec.label;
    const asset = await prisma.studioAsset.create({
      data: { workspaceId: saveWorkspaceId, title, type: spec.assetType, content },
    });

    recordMetric(user.id, 'generate_asset').catch((e) => console.error('Metric failed:', e));
    logActivity(user.id, 'save_studio_asset', `Saved a ${spec.assetType} to Studio Assets`, req).catch(console.error);

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Studio generate error:', error);
    return NextResponse.json({ error: 'Could not generate this. Please try again.' }, { status: 500 });
  }
}
