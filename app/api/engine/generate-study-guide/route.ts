import { NextResponse } from "next/server";
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { getAIModel } from "@/lib/ai/model-router";
import { prisma } from "@/lib/prisma";
import type { Prisma } from '@prisma/client';
import { requireUser, requireDocumentOwnership } from '@/lib/api-auth';
import { ensurePrismaUser } from '@/lib/auth-sync';
import { recordMetric } from '@/lib/metrics';
import { classifyAiError } from '@/lib/ai-errors';
import { checkUsage, recordUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SOURCE_CHARS = 40000;

type Phase = { phaseId?: string; title?: string; microBites?: unknown; flashcards?: unknown };

function parseGuideJson(raw: string): { guideTitle?: string; phases: Phase[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
  }
  const phases = (parsed as { phases?: unknown })?.phases;
  if (!Array.isArray(phases) || phases.length === 0) throw new Error('AI returned a guide with no phases');
  return parsed as { guideTitle?: string; phases: Phase[] };
}

// Builds a guide from a stored document's text and saves it. Body: { documentId, sectionConstraint }.
export async function POST(req: Request) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (!user) return authResponse;
    const limited = rateLimit(user.id, LIMITS.generate);
    if (limited) return limited;


    const { documentId, sectionConstraint } = await req.json().catch(() => ({}));

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json({ error: "Missing documentId." }, { status: 400 });
    }
    if (!sectionConstraint || typeof sectionConstraint !== 'string' || sectionConstraint.length > 300) {
      return NextResponse.json({ error: "Missing or invalid sectionConstraint." }, { status: 400 });
    }

    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    const text = (doc.textContent || '').trim();
    if (!text) {
      return NextResponse.json({ error: "This source has no readable text, so a guide can't be built from it." }, { status: 400 });
    }

    const allowed = await checkUsage(user.id, 'guide');
    if (!allowed.ok) return NextResponse.json({ error: allowed.message }, { status: allowed.status });

    const prompt = `You are a master tutor. Create a highly structured JSON study guide based on the following document content, strictly adhering to the user's Study Brief Configuration parameters.
Study Brief Configuration: ${sectionConstraint}

You MUST return a raw JSON object that EXACTLY matches this schema. Do not include markdown wrappers.
{
  "guideTitle": "Mastering EDM 205",
  "phases": [
    {
      "phaseId": "1",
      "title": "Phase 1: Core Definitions",
      "microBites": [
        "Educational Planning is the systematic process of...",
        "It requires resource allocation and..."
      ],
      "flashcards": [
        { "question": "What is Educational Planning?", "answer": "A systematic process..." }
      ]
    }
  ]
}

Document Context:
${text.substring(0, MAX_SOURCE_CHARS)}
`;

    let raw: string;
    try {
      const result = await getAIModel('complex').generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      raw = result.response.text();
    } catch (aiError) {
      console.error("Study Guide Gen Error:", aiError);
      const failure = classifyAiError(aiError);
      return NextResponse.json({ error: failure.message, code: failure.kind }, { status: failure.status });
    }

    let studyGuide;
    try {
      studyGuide = parseGuideJson(raw);
    } catch (parseError) {
      console.error("Study guide JSON parse failed:", parseError);
      return NextResponse.json({ error: "The AI returned a guide in the wrong format. Please try again." }, { status: 502 });
    }

    await ensurePrismaUser(user);
    const guide = await prisma.studyGuide.create({
      data: {
        userId: user.id,
        sourceDocumentId: doc.id,
        sourceDocumentName: doc.name,
        sectionConstraint,
        strategyData: studyGuide as unknown as Prisma.InputJsonValue,
      },
    });

    await recordUsage(user.id, 'guide');
    recordMetric(user.id, 'generate_guide').catch((e) => console.error("Metric failed:", e));

    return NextResponse.json({ studyGuide, guide });
  } catch (error) {
    console.error("Study Guide Route Error:", error);
    return NextResponse.json({ error: "Could not generate the study guide." }, { status: 500 });
  }
}
