import { prisma } from '@/lib/prisma';

export const NEW_CARDS_PER_DAY = 10;
const MAX_QUEUE = 30;

export type ReviewCard = {
  assetId: string;
  cardIndex: number;
  question: string;
  answer: string;
  setTitle: string;
  isNew: boolean;
};

type Card = { question: string; answer: string };

function asCards(content: unknown): Card[] {
  if (!Array.isArray(content)) return [];
  return content.filter((c): c is Card => typeof c?.question === 'string' && typeof c?.answer === 'string');
}

/**
 * Today's study queue across every saved flashcard set the user owns:
 * cards that have come due first (oldest first), then a few new ones so nothing is overwhelming.
 */
export async function buildReviewQueue(userId: string, now = new Date()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [assets, states] = await Promise.all([
    prisma.studioAsset.findMany({
      where: { type: 'FLASHCARD', workspace: { userId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, content: true },
    }),
    prisma.cardState.findMany({ where: { userId }, select: { assetId: true, cardIndex: true, dueAt: true, createdAt: true } }),
  ]);

  const seen = new Map(states.map((s) => [`${s.assetId}:${s.cardIndex}`, s]));
  const introducedToday = states.filter((s) => s.createdAt >= startOfDay).length;
  const newAllowance = Math.max(0, NEW_CARDS_PER_DAY - introducedToday);

  const due: { card: ReviewCard; at: number }[] = [];
  const fresh: ReviewCard[] = [];
  for (const asset of assets) {
    asCards(asset.content).forEach((card, cardIndex) => {
      const base = { assetId: asset.id, cardIndex, question: card.question, answer: card.answer, setTitle: asset.title };
      const state = seen.get(`${asset.id}:${cardIndex}`);
      if (!state) fresh.push({ ...base, isNew: true });
      else if (state.dueAt <= now) due.push({ card: { ...base, isNew: false }, at: state.dueAt.getTime() });
    });
  }

  due.sort((a, b) => a.at - b.at);
  const newCards = fresh.slice(0, newAllowance);
  const queue = [...due.map((d) => d.card), ...newCards].slice(0, MAX_QUEUE);
  return { queue, dueCount: due.length, newCount: newCards.length };
}
