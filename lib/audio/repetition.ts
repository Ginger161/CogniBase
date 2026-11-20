// Measures how much a script repeats itself. Pure functions, so tests and the measuring script share them.

import type { Turn } from './script';

const STOP = new Set(
  'the a an and or but of to in on at for with as is are was were be been it its this that these those you your we our they them he she his her i me my not no so if then than too very can will just from by about into over also have has had do does did what which who how why when where there here'.split(' ')
);

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
const content = (s: string) => words(s).filter((w) => w.length >= 4 && !STOP.has(w));
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => words(x).length >= 5);
const norm = (s: string) => words(s).join(' ');

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export type RepetitionReport = {
  turns: number;
  words: number;
  /** Share of sentences (5+ words) that are an exact repeat of an earlier one. */
  repeatedSentenceRate: number;
  /** Share of 6-word runs that appear more than once. */
  repeatedSixGramRate: number;
  /** Turn pairs (not neighbours) that say nearly the same thing. */
  nearDuplicateTurns: number;
  /** Unique content words / all content words. Low means the script keeps reusing the same vocabulary. */
  vocabularyVariety: number;
  /** Script words per source word. Far above 1 means the script is stretched to fill the time. */
  stretch: number | null;
};

export function measureRepetition(turns: Turn[], sourceText?: string): RepetitionReport {
  const all = turns.map((t) => t.text);
  const text = all.join(' ');
  const w = words(text);

  const sents = all.flatMap(sentences).map(norm);
  const seen = new Set<string>();
  let repeatedSentences = 0;
  for (const s of sents) {
    if (seen.has(s)) repeatedSentences++;
    else seen.add(s);
  }

  const grams = new Map<string, number>();
  for (let i = 0; i + 6 <= w.length; i++) {
    const g = w.slice(i, i + 6).join(' ');
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let repeatedGrams = 0;
  for (const n of grams.values()) if (n > 1) repeatedGrams += n;

  const sets = all.map((t) => new Set(content(t)));
  let near = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 2; j < sets.length; j++) {
      if (sets[i].size >= 5 && sets[j].size >= 5 && jaccard(sets[i], sets[j]) >= 0.6) near++;
    }
  }

  const cw = content(text);
  return {
    turns: turns.length,
    words: w.length,
    repeatedSentenceRate: sents.length ? repeatedSentences / sents.length : 0,
    repeatedSixGramRate: grams.size ? repeatedGrams / Math.max(1, w.length - 5) : 0,
    nearDuplicateTurns: near,
    vocabularyVariety: cw.length ? new Set(cw).size / cw.length : 1,
    stretch: sourceText ? w.length / Math.max(1, words(sourceText).length) : null,
  };
}

/**
 * True when `text` just says again what one of the recent turns already said (same points, near-same words).
 * Used to drop echo turns from a script the model wrote. A recall question and its answer are never an echo.
 */
export function isEcho(text: string, recent: { text: string; recall?: boolean }[], window = 6): boolean {
  const mine = new Set(content(text));
  if (mine.size < 5) return false;
  const tail = recent.slice(-window);
  return tail.some((t) => {
    if (t.recall) return false; // the answer to a question
    return jaccard(mine, new Set(content(t.text))) >= 0.7;
  });
}
