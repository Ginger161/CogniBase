/**
 * Turns raw extracted text (PDF dumps, TXT, web pages, transcripts, slides) into clean Markdown
 * for the Zen reader: headings, lists, paragraphs and sensible line breaks.
 * Pure and deterministic, so it runs on the client at read time and never changes what is stored.
 */

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'vs', 'via']);
const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|vs|cf|dr|mr|mrs|ms|prof|fig|figs|eq|no|nos|approx|st|jr|sr|inc|ltd|al)\.$/i;
const BULLET = /^(?:[•●◦▪‣·⁃■□○➢➤►]|[-*+–—])\s+/;
const NUMBERED = /^(\d{1,3})[.)]\s+(.*)$/;
const DOTTED_HEADING = /^(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+(\S.*)$/;
const LABELLED_HEADING = /^(?:chapter|unit|module|week|lecture|section|part|topic|lesson|session)\s+(?:\d+|[ivxlc]+)\b[\s:.\-–—]*.{0,70}$/i;
const PAGE_NOISE = /^(?:page\s+)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$|^slide\s+\d+$/i;
const TERMINAL = /[.!?:;"”')\]]$/;
const TARGET_PARAGRAPH_WORDS = 85;
const MAX_PARAGRAPH_WORDS = 150;

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[]; ordered: boolean }
  | { kind: 'raw'; text: string };

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿­]/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]+\n/g, '\n')
    // "exam-\nple" -> "example": a hyphen at a line end followed by a lowercase continuation.
    .replace(/([A-Za-z])-\n([a-z])/g, '$1$2');
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function looksTitleish(s: string): boolean {
  const words = s.split(/\s+/);
  if (words.length > 9 || s.length > 72 || /[.,;]$/.test(s)) return false;
  if (!/^[A-Z0-9"“(]/.test(s)) return false;
  const content = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  if (content.length === 0) return false;
  const capped = content.filter((w) => /^[A-Z0-9"“(]/.test(w)).length;
  return capped / content.length >= 0.6;
}

/** Splits prose into sentences, keeping abbreviations like "e.g." and "Dr." attached. */
function splitSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+(?:[.!?]+["”')\]]*|$)\s*/g) ?? [text];
  const out: string[] = [];
  for (const piece of raw) {
    const s = piece.trim();
    if (!s) continue;
    const prev = out[out.length - 1];
    if (prev && (ABBREVIATIONS.test(prev) || /(?:^|\s)[A-Z]\.$/.test(prev) || !/^["“(\[]?[A-Z0-9]/.test(s))) {
      out[out.length - 1] = `${prev} ${s}`;
    } else {
      out.push(s);
    }
  }
  return out;
}

/** Breaks a wall of text into readable paragraphs of roughly TARGET_PARAGRAPH_WORDS words. */
function chunkProse(text: string): string[] {
  const words = wordCount(text);
  if (words <= MAX_PARAGRAPH_WORDS) return [text];

  const sentences = splitSentences(text);
  // Transcripts often have no punctuation at all, so fall back to fixed-size word groups.
  const unit = sentences.length >= words / 60 ? sentences : text.split(/\s+/).reduce<string[]>((acc, w, i) => {
    if (i % 12 === 0) acc.push(w);
    else acc[acc.length - 1] += ` ${w}`;
    return acc;
  }, []);

  const paragraphs: string[] = [];
  let current: string[] = [];
  let count = 0;
  for (const s of unit) {
    const n = wordCount(s);
    if (count >= TARGET_PARAGRAPH_WORDS || (count > 0 && count + n > MAX_PARAGRAPH_WORDS * 0.8)) {
      paragraphs.push(current.join(' '));
      current = [];
      count = 0;
    }
    current.push(s);
    count += n;
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs;
}

/** Lines that repeat many times (running headers and footers) are scanning noise, not content. */
function repeatedNoise(lines: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (t && t.length < 80 && !t.startsWith('#')) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const noisy = new Set<string>();
  const threshold = Math.max(4, Math.floor(lines.length / 40));
  for (const [t, n] of counts) if (n >= threshold && !BULLET.test(t)) noisy.add(t);
  return noisy;
}

function parseBlocks(segment: string): Block[] {
  const lines = segment.split('\n');
  const noise = repeatedNoise(lines);
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: para.join(' ').replace(/\s+/g, ' ').trim() });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: 'list', items: list.items, ordered: list.ordered });
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevBlank = i === 0 || lines[i - 1].trim() === '';
    const next = lines.slice(i + 1).find((l) => l.trim() !== '')?.trim();
    const nextIsAdjacent = (lines[i + 1] ?? '').trim() !== '';

    if (!line) {
      flush();
      continue;
    }
    if (PAGE_NOISE.test(line) || noise.has(line)) continue;

    // Markdown that is already there passes straight through.
    const md = line.match(/^(#{1,6})\s*(\S.*)$/);
    if (md) {
      flush();
      blocks.push({ kind: 'heading', level: md[1].length, text: md[2].replace(/\s*#+$/, '') });
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line) || line.startsWith('|') || line.startsWith('>')) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'raw' && !/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) last.text += `\n${line}`;
      else blocks.push({ kind: 'raw', text: line });
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    const dotted = line.match(DOTTED_HEADING);

    if (dotted && !TERMINAL.test(dotted[2]) && dotted[2].length <= 80) {
      flush();
      blocks.push({ kind: 'heading', level: Math.min(dotted[1].split('.').length + 1, 4), text: `${dotted[1]} ${dotted[2]}` });
      continue;
    }

    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered && !bullet;
      const body = (bullet ? line.slice(bullet[0].length) : numbered![2]).trim();
      const isolatedTitle =
        ordered && prevBlank && !list && !TERMINAL.test(body) && body.length <= 70 && !(next && NUMBERED.test(next));
      if (isolatedTitle) {
        blocks.push({ kind: 'heading', level: 2, text: `${numbered![1]}. ${body}` });
        continue;
      }
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { items: [], ordered };
      list.items.push(body);
      continue;
    }

    // A continuation of the previous list item (indented, or wrapped without punctuation).
    if (list && !prevBlank && !looksTitleish(line)) {
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    flushList();

    const isolated = prevBlank && (!nextIsAdjacent || !next);
    const wholeBold = line.match(/^\*\*([^*]+)\*\*:?$/);
    const standalone = (prevBlank || para.length === 0) && (isolated || nextIsAdjacent);

    if (wholeBold && line.length <= 80 && prevBlank) {
      flush();
      blocks.push({ kind: 'heading', level: 3, text: wholeBold[1].trim() });
      continue;
    }
    if (standalone && line.length <= 90 && LABELLED_HEADING.test(line)) {
      flush();
      blocks.push({ kind: 'heading', level: 2, text: line.replace(/[:.]$/, '') });
      continue;
    }
    if (standalone && isAllCaps(line) && line.length <= 80 && !/[.!?]$/.test(line) && wordCount(line) <= 10) {
      flush();
      blocks.push({ kind: 'heading', level: 2, text: titleCase(line.replace(/:$/, '')) });
      continue;
    }
    if (
      (prevBlank || para.length === 0) &&
      next &&
      (isolated || (nextIsAdjacent && next.length > line.length * 2)) &&
      looksTitleish(line) &&
      !TERMINAL.test(line)
    ) {
      flush();
      blocks.push({ kind: 'heading', level: 3, text: line });
      continue;
    }
    if (prevBlank && isolated && line.endsWith(':') && line.length <= 60) {
      flush();
      blocks.push({ kind: 'paragraph', text: `**${line.slice(0, -1)}:**` });
      continue;
    }

    // Plain text: a line that ends a sentence and is followed by a capital starts a new paragraph;
    // anything else is a hard wrap and gets joined to the paragraph it belongs to.
    para.push(line);
    const following = lines[i + 1]?.trim() ?? '';
    const startsNew = /^[A-Z0-9"“(\[]/.test(following);
    if (TERMINAL.test(line) && startsNew && (line.length < 55 || !para.slice(0, -1).length || isShortRun(lines, i))) flushPara();
  }
  flush();
  return blocks;
}

/** True when the document is written one-sentence-per-line rather than hard-wrapped at a column. */
function isShortRun(lines: string[], at: number): boolean {
  const nearby = lines.slice(Math.max(0, at - 3), at + 4).map((l) => l.trim()).filter(Boolean);
  if (nearby.length < 3) return true;
  const lengths = nearby.map((l) => l.length);
  const spread = Math.max(...lengths) - Math.min(...lengths);
  // Hard-wrapped text has lines of nearly equal width; paragraph-per-line text varies a lot.
  return spread > 25;
}

function render(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading':
        out.push(`${'#'.repeat(b.level)} ${b.text}`);
        break;
      case 'paragraph':
        out.push(...chunkProse(b.text));
        break;
      case 'list':
        out.push(b.items.map((t, i) => (b.ordered ? `${i + 1}. ${t}` : `- ${t}`)).join('\n'));
        break;
      case 'raw':
        out.push(b.text);
        break;
    }
  }
  return out.join('\n\n');
}

export function formatForReading(input: string): string {
  if (!input.trim()) return '';
  const text = normalize(input);

  // Fenced code is left exactly as written.
  const parts = text.split(/(```[\s\S]*?```)/g);
  const formatted = parts
    .map((part, i) => (i % 2 === 1 ? part : render(parseBlocks(part))))
    .filter((p) => p.trim())
    .join('\n\n');

  return formatted.replace(/\n{3,}/g, '\n\n').trim();
}
