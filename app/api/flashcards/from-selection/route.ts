import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { requireDocumentOwnership, requireUser } from '@/lib/api-auth';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { classifyAiError } from '@/lib/ai-errors';

export const maxDuration = 30;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const MAX_CARDS_IN_SET = 200;

// Turns a passage the student selected into one flashcard and adds it to that source's "Saved cards" set.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    const limited = rateLimit(user.id, LIMITS.generate);
    if (limited) return limited;

    const { documentId, quote } = await req.json().catch(() => ({}));
    const passage = typeof quote === 'string' ? quote.replace(/\s+/g, ' ').trim().slice(0, 1500) : '';
    if (typeof documentId !== 'string' || passage.length < 10) {
      return NextResponse.json({ error: 'Select a sentence or two to turn into a card.' }, { status: 400 });
    }
    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    let card: { question: string; answer: string } | null = null;
    try {
      const model = genAI.getGenerativeModel(
        { model: 'gemini-3.5-flash', generationConfig: { responseMimeType: 'application/json' } },
        { timeout: 25_000 }
      );
      const out = (
        await model.generateContent(
          `Write one effective flashcard that tests the key idea in this passage from "${doc.name}". The question must make sense on its own and the answer must be short. Use only what the passage says. Output strictly as JSON: {"question": string, "answer": string}.\n\nPassage:\n${passage}`
        )
      ).response.text();
      const parsed = JSON.parse(out.replace(/^```json|```$/gm, '').trim());
      if (typeof parsed?.question === 'string' && typeof parsed?.answer === 'string' && parsed.question && parsed.answer) {
        card = { question: parsed.question, answer: parsed.answer };
      }
    } catch (err) {
      console.error('Card from selection failed:', err);
      const failure = classifyAiError(err);
      return NextResponse.json({ error: failure.message, code: failure.kind }, { status: failure.status });
    }
    if (!card) return NextResponse.json({ error: 'The AI could not make a card from that. Try a different passage.' }, { status: 502 });

    const title = `Saved cards · ${doc.name}`;
    const existing = await prisma.studioAsset.findFirst({
      where: { type: 'FLASHCARD', title, workspaceId: doc.workspaceId, workspace: { userId: user.id } },
      select: { id: true, content: true },
    });

    if (existing) {
      const cards = Array.isArray(existing.content) ? existing.content : [];
      if (cards.length >= MAX_CARDS_IN_SET) {
        return NextResponse.json({ error: 'This saved set is full. Delete some cards in Study to add more.' }, { status: 400 });
      }
      await prisma.studioAsset.update({ where: { id: existing.id }, data: { content: [...cards, card] } });
    } else {
      await prisma.studioAsset.create({ data: { workspaceId: doc.workspaceId, title, type: 'FLASHCARD', content: [card] } });
    }
    return NextResponse.json({ card });
  } catch (error) {
    console.error('Flashcard from selection error:', error);
    return NextResponse.json({ error: 'Could not save that card. Please try again.' }, { status: 500 });
  }
}
