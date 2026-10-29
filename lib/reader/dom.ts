// Browser-only helpers for the reader: wrapping highlights in the rendered text and finding a passage again.
// They work on text nodes only and are safe to run repeatedly (clear, then apply).

const MARK_CLASS = 'reader-mark';

/** Lowercase words only, so a passage from the raw text still matches the formatted, marked-up page. */
export function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`*_#>|[\]()]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A few short word runs spread through a passage. Any one of them found in a page locates the passage there. */
export function passageProbes(passage: string, size = 6, max = 6): string[] {
  const words = normaliseForMatch(passage).split(' ').filter(Boolean);
  if (words.length < size) return words.length ? [words.join(' ')] : [];
  const step = Math.max(size, Math.floor(words.length / max));
  const probes: string[] = [];
  for (let i = 0; i + size <= words.length && probes.length < max; i += step) probes.push(words.slice(i, i + size).join(' '));
  return probes;
}

export function clearMarks(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll(`mark.${MARK_CLASS}`))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

type Seg = { node: Text; start: number };

/** Wraps the first occurrence of `quote` (whitespace-insensitive) in <mark> elements. Returns whether it was found. */
export function markQuote(root: HTMLElement, quote: string, id: string): boolean {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segs: Seg[] = [];
  let flat = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    segs.push({ node, start: flat.length });
    flat += node.data;
  }

  // Search a whitespace-collapsed copy, keeping a map back to offsets in `flat`.
  let collapsed = '';
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < flat.length; i++) {
    const isSpace = /\s/.test(flat[i]);
    if (isSpace && lastWasSpace) continue;
    collapsed += isSpace ? ' ' : flat[i];
    map.push(i);
    lastWasSpace = isSpace;
  }
  const needle = quote.replace(/\s+/g, ' ').trim();
  if (!needle) return false;
  const at = collapsed.indexOf(needle);
  if (at < 0) return false;
  const from = map[at];
  const to = map[at + needle.length - 1] + 1;

  // Wrap from the end so earlier offsets stay valid while text nodes are split.
  for (let i = segs.length - 1; i >= 0; i--) {
    const { node, start } = segs[i];
    const end = start + node.data.length;
    if (end <= from || start >= to) continue;
    const a = Math.max(from, start) - start;
    const b = Math.min(to, end) - start;
    if (b <= a) continue;
    const middle = a > 0 ? node.splitText(a) : node;
    if (b - a < middle.data.length) middle.splitText(b - a);
    const mark = root.ownerDocument.createElement('mark');
    mark.className = MARK_CLASS;
    mark.dataset.highlightId = id;
    middle.parentNode?.insertBefore(mark, middle);
    mark.appendChild(middle);
  }
  return true;
}

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th';

/** The smallest block of text inside `root` that contains one of the probes, if any. */
export function findBlock(root: HTMLElement, probes: string[]): HTMLElement | null {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(BLOCKS))) {
    const text = normaliseForMatch(el.textContent ?? '');
    if (probes.some((p) => text.includes(p))) return el;
  }
  return null;
}

/** The nearest ancestor that actually scrolls, which in this app is the page's <main>, not the window. */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll')) return p;
  }
  return null;
}
