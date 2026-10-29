import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDocumentOwnership, requireUser } from '@/lib/api-auth';

const MAX_PER_DOCUMENT = 200;
const MAX_QUOTE = 2000;
const MAX_NOTE = 1000;

// Highlights the signed-in user saved in one source.
export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const documentId = new URL(req.url).searchParams.get('documentId');
    if (!documentId) return NextResponse.json({ error: 'Missing source.' }, { status: 400 });
    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    const highlights = await prisma.highlight.findMany({
      where: { userId: user.id, documentId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, quote: true, note: true, createdAt: true },
    });
    return NextResponse.json({ highlights });
  } catch (error) {
    console.error('Highlights GET error:', error);
    return NextResponse.json({ error: 'Could not load your highlights.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { documentId, quote, note } = await req.json().catch(() => ({}));
    const text = typeof quote === 'string' ? quote.replace(/\s+/g, ' ').trim() : '';
    if (typeof documentId !== 'string' || text.length < 3) {
      return NextResponse.json({ error: 'Select some text to highlight first.' }, { status: 400 });
    }
    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    const count = await prisma.highlight.count({ where: { userId: user.id, documentId } });
    if (count >= MAX_PER_DOCUMENT) {
      return NextResponse.json({ error: 'This source has the most highlights it can hold. Remove a few to add more.' }, { status: 400 });
    }

    const highlight = await prisma.highlight.create({
      data: {
        userId: user.id,
        documentId,
        quote: text.slice(0, MAX_QUOTE),
        note: typeof note === 'string' && note.trim() ? note.trim().slice(0, MAX_NOTE) : null,
      },
      select: { id: true, quote: true, note: true, createdAt: true },
    });
    return NextResponse.json({ highlight });
  } catch (error) {
    console.error('Highlights POST error:', error);
    return NextResponse.json({ error: 'Could not save that highlight.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing highlight.' }, { status: 400 });

    const { count } = await prisma.highlight.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Highlights DELETE error:', error);
    return NextResponse.json({ error: 'Could not remove that highlight.' }, { status: 500 });
  }
}
