import { GoogleGenerativeAI } from '@google/generative-ai';
import { CHARS_PER_MINUTE, FORMAT_INFO, GOAL_INFO, lengthRange, type AudioFormat, type AudioGoal, type LengthTier } from './formats';

export type Turn = { speaker: 'A' | 'B'; text: string; /** A question the listener should answer in their head before the reply. */ recall?: boolean };
export type Chapter = { title: string; startTurn: number };
export type AudioScript = { title: string; chapters: Chapter[]; turns: Turn[] };

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const SOURCE_CHARS = 24_000;

// Varied on purpose, so two episodes on similar material still open and feel different.
const OPENERS = [
  'a surprising fact or number from the source',
  'a direct question to the listener',
  'a very short everyday scene that shows why this matters',
  'a bold claim that the episode then proves',
  'the one mistake students most often make on this topic',
];
const ANALOGY_WORLDS = ['football and sport', 'cooking and food', 'markets and trading', 'travel and transport', 'phones and apps', 'school life and exams'];

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

type Brief = { name: string; text: string; format: AudioFormat; goal: AudioGoal; tier: LengthTier; part?: { index: number; total: number } };

function prompt({ name, text, format, goal, tier, part }: Brief): string {
  const { targetWords } = lengthRange(tier);
  // Quiz and rapid-fire episodes are built on recall, so they pause far more often than a walkthrough.
  const perFiveMinutes = format === 'quiz' ? 4 : format === 'rapid' ? 3 : 2;
  const recalls = Math.max(2, Math.round((tier / 5) * perFiveMinutes));
  return `You write audio study overviews for university students who listen while walking, so there is nothing to look at. Two hosts, A and B, speak. Write the script.

FORMAT: ${FORMAT_INFO[format].label}. ${FORMAT_INFO[format].structure}
GOAL: ${GOAL_INFO[goal].guidance}
LENGTH: about ${targetWords} words in total (${tier} minutes spoken). Stay within 20 percent of that. ${part ? `This is part ${part.index} of ${part.total} of a series on the source: cover only the text given, say "part ${part.index}" in the opening line${part.index < part.total ? ' and tease the next part at the end' : ' and close the series at the end'}.` : ''}

HOW PEOPLE REMEMBER WHAT THEY HEAR. Build these in:
- Open with ${pick(OPENERS)}, then a 15-second roadmap of what is coming.
- Teach in small chunks of three to five ideas, and number them out loud ("three things to remember").
- Include exactly ${recalls} recall pauses. A recall pause is a host turn that asks a question about what was just taught, marked "recall": true. The very next turn gives the answer. Never put an answer in the same turn as its question.
- Say each key definition in the same words at least twice, so the listener can reproduce it in an exam.
- Use vivid, concrete analogies (draw some from ${pick(ANALOGY_WORLDS)}), one short mnemonic where one fits, and flag "likely exam question" moments.
- Keep every turn short, 1 to 3 sentences. Real conversation: reactions, questions, light humour. Never lecture for more than 3 sentences.
- Close with a two-line recap of the most important points.

WRITE FOR THE EAR. No "as you can see", no bullet lists, no markdown, no stage directions, no sound effects. Say numbers and formulas the way they are spoken ("x squared plus two"). Expand abbreviations and symbols ("for example", not "e.g."). Define any acronym the first time. Use only what the source says: if it is not in the source, do not teach it as fact.

Output strictly as JSON, no markdown:
{"title": string, "chapters": [{"title": string, "startTurn": number}], "turns": [{"speaker": "A" | "B", "text": string, "recall"?: true}]}
Chapters are 3 to 6 short topic titles, with startTurn as the index of the first turn of each.

Source name: ${name}
Source text:
${text.slice(0, SOURCE_CHARS)}`;
}

const chars = (turns: Turn[]) => turns.reduce((n, t) => n + t.text.length, 0);

/** Cleans a model reply into a valid script, or null if nothing usable came back. */
export function normaliseScript(raw: unknown, fallbackTitle: string, hardMaxChars = Number.POSITIVE_INFINITY): AudioScript | null {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.turns) ? obj.turns : Array.isArray(raw) ? raw : [];
  const turns: Turn[] = [];
  let used = 0;
  for (const t of list) {
    const r = t as Record<string, unknown>;
    const text = typeof r?.text === 'string' ? r.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) continue;
    if (used + text.length > hardMaxChars) break;
    used += text.length;
    turns.push({ speaker: r.speaker === 'B' ? 'B' : 'A', text, ...(r.recall === true ? { recall: true } : {}) });
  }
  if (turns.length < 4) return null;
  // A question with no reply after it cannot be a recall pause.
  if (turns[turns.length - 1].recall) delete turns[turns.length - 1].recall;

  const chapters: Chapter[] = (Array.isArray(obj.chapters) ? obj.chapters : [])
    .map((c) => c as Record<string, unknown>)
    .filter((c) => typeof c?.title === 'string' && Number.isInteger(c.startTurn) && (c.startTurn as number) >= 0 && (c.startTurn as number) < turns.length)
    .map((c) => ({ title: (c.title as string).trim().slice(0, 80), startTurn: c.startTurn as number }))
    .sort((a, b) => a.startTurn - b.startTurn);
  if (chapters.length === 0 || chapters[0].startTurn !== 0) chapters.unshift({ title: 'Introduction', startTurn: 0 });

  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim().slice(0, 120) : fallbackTitle;
  return { title, chapters, turns };
}

// A long script takes a while to write (a 5-minute one took about 35 seconds), so the timeout is generous.
// Overload errors are common and pass quickly, so they are retried a few times.
async function ask(promptText: string): Promise<unknown> {
  const model = genAI.getGenerativeModel(
    { model: 'gemini-3.5-flash', generationConfig: { responseMimeType: 'application/json' } },
    { timeout: 150_000 }
  );
  const backoff = [2000, 5000, 10_000];
  for (let attempt = 0; ; attempt++) {
    try {
      const out = (await model.generateContent(promptText)).response.text();
      return JSON.parse(out.replace(/^```json|```$/gm, '').trim());
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      const transient = msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded');
      if (!transient || attempt >= backoff.length) throw err;
      await new Promise((r) => setTimeout(r, backoff[attempt]));
    }
  }
}

export type ScriptResult = { script: AudioScript; minutes: number; repaired: boolean };

/**
 * Writes the script and holds it to its length range. If it lands outside the range it gets one repair
 * pass (expand or condense), and if it is still too long it is cut at a turn boundary.
 */
export async function writeScript(brief: Brief): Promise<ScriptResult | null> {
  const { minChars, maxChars } = lengthRange(brief.tier);
  const fallbackTitle = `Audio overview · ${brief.name}`;

  let script = normaliseScript(await ask(prompt(brief)), fallbackTitle, maxChars * 1.5);
  if (!script) return null;

  let repaired = false;
  const size = chars(script.turns);
  if (size < minChars || size > maxChars) {
    repaired = true;
    const direction = size < minChars ? 'too short. Expand it with more examples, recall pauses and recap' : 'too long. Condense it by trimming the least important material';
    const fixed = await ask(
      `This audio script is ${direction}, to about ${lengthRange(brief.tier).targetWords} words (${brief.tier} minutes spoken). Keep the same format, voice, recall pauses and structure. Return the full script in the same JSON shape.\n\n${JSON.stringify({ title: script.title, chapters: script.chapters, turns: script.turns })}`
    ).catch(() => null);
    const again = fixed ? normaliseScript(fixed, fallbackTitle, maxChars) : null;
    if (again && chars(again.turns) >= minChars * 0.9) script = again;
    else if (size > maxChars) script = normaliseScript({ ...script }, fallbackTitle, maxChars) ?? script;
  }
  return { script, minutes: Math.round((chars(script.turns) / CHARS_PER_MINUTE) * 10) / 10, repaired };
}
