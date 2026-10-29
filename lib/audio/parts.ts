// Long sources become a series: the text is cut into parts at paragraph breaks, each voiced as its own episode.

const PART_CHARS = 20_000;
const MAX_PARTS = 4;

/** Splits text into at most MAX_PARTS chunks of about PART_CHARS, breaking between paragraphs. */
export function splitIntoParts(text: string): string[] {
  if (text.length <= PART_CHARS * 1.25) return [text];
  const count = Math.min(MAX_PARTS, Math.ceil(text.length / PART_CHARS));
  const target = Math.ceil(text.length / count);
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < count - 1; i++) {
    const guess = start + target;
    const breakAt = text.indexOf('\n\n', guess);
    // Prefer the next paragraph break; fall back to a hard cut if the text has none nearby.
    const end = breakAt > 0 && breakAt - guess < target * 0.4 ? breakAt : guess;
    parts.push(text.slice(start, end).trim());
    start = end;
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}
