/**
 * The console cites its sources as `[•](cite:DOCUMENT NAME#N)`. Document names have spaces and brackets
 * ("BIO 101 Photosynthesis", "Notes (2).pdf"), which Markdown does not accept inside a link address, so such a
 * citation would show as raw text instead of a button. This encodes the name so it becomes a normal link;
 * the console decodes it again when it renders the button.
 */
export function normaliseCites(text: string): string {
  const decoded = (name: string) => {
    try {
      return decodeURIComponent(name);
    } catch {
      return name; // contains a stray % that is not an escape
    }
  };
  // Decode first so a name the model already encoded is not encoded twice.
  const encode = (name: string) => encodeURIComponent(decoded(name).trim()).replace(/\(/g, '%28').replace(/\)/g, '%29');

  return text
    .replace(/\]\(cite:([^\n]*?)#(\d+)\)/g, (_m, name: string, n: string) => `](cite:${encode(name)}#${n})`)
    .replace(/\]\(cite:([^)\n#%]+)\)/g, (_m, name: string) => `](cite:${encode(name)})`); // no passage number
}

/** Reads a `cite:NAME#N` link address back into the document name and passage number. */
export function parseCite(href: string): { name: string; n: number | null } {
  let raw = href.slice(5);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep it as written */
  }
  const m = raw.match(/^(.*)#(\d+)$/);
  return m ? { name: m[1], n: Number(m[2]) } : { name: raw, n: null };
}
