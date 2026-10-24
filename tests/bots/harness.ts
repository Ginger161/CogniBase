import fs from 'fs';
import path from 'path';

export type Verdict = 'pass' | 'fail' | 'skip';
export type Result = { group: string; name: string; verdict: Verdict; detail: string; ms: number };

const results: Result[] = [];
let currentGroup = 'general';

export function group(name: string) {
  currentGroup = name;
  console.log(`\n== ${name}`);
}

export class Skip extends Error {}
export const skip = (why: string): never => {
  throw new Skip(why);
};

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function test(name: string, fn: () => Promise<string | void>) {
  const started = Date.now();
  let verdict: Verdict = 'pass';
  let detail = '';
  try {
    detail = (await fn()) || '';
  } catch (e) {
    if (e instanceof Skip) {
      verdict = 'skip';
      detail = e.message;
    } else {
      verdict = 'fail';
      detail = e instanceof Error ? e.message : String(e);
    }
  }
  const ms = Date.now() - started;
  results.push({ group: currentGroup, name, verdict, detail, ms });
  const mark = verdict === 'pass' ? 'PASS' : verdict === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`  ${mark}  ${name}${detail ? `  — ${detail}` : ''}`);
}

export function finish(label: string) {
  const count = (v: Verdict) => results.filter((r) => r.verdict === v).length;
  console.log(`\n${label}: ${count('pass')} passed, ${count('fail')} failed, ${count('skip')} skipped (${results.length} total)`);
  const dir = path.join(process.cwd(), 'tests', 'bots', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  return count('fail');
}
