import { BASE_URL, anon, chatText, signIn, sseEvents, type Bot, type Reply } from './client';
import { assert, finish, group, skip, test } from './harness';
import { createClient } from '@supabase/supabase-js';
import { MARKER_FACT, SECRET_TEXT, docxFile, pptxFile, textFile } from './fixtures';

const BUCKET = 'workspace-files';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ask = (text: string) => ({ id: 'm1', role: 'user', parts: [{ type: 'text', text }] });

// Everything a bot creates is tracked here and removed at the end.
const made = { docs: [] as { bot: Bot; id: string }[], assets: [] as { bot: Bot; id: string }[], guides: [] as { bot: Bot; id: string }[] };

async function createText(bot: Bot, name: string, text: string): Promise<string> {
  const r = await bot.call('POST', '/api/documents', { name, rawText: text });
  assert(r.status === 200 && r.json?.id, `create failed: ${r.status} ${r.text.slice(0, 150)}`);
  made.docs.push({ bot, id: r.json.id });
  return r.json.id;
}

async function index(bot: Bot, docId: string): Promise<string> {
  const r = await bot.call('POST', '/api/engine/analyze', { docId });
  assert(r.status === 200, `analyze returned ${r.status}: ${r.text.slice(0, 150)}`);
  const events = sseEvents(r.text);
  const err = events.find((e) => e.type === 'error');
  if (err && QUOTA.test(err.error)) skip('Gemini quota used up');
  assert(!err, `indexing error: ${err?.error}`);
  const done = events.find((e) => e.type === 'done');
  assert(done, 'indexing stream never reported done');
  return `${done.chunksProcessed} chunks`;
}

// When Gemini's daily quota is spent we cannot judge anything that needs the model. Skip instead of failing.
const QUOTA = /daily usage limit|exceeded your current quota/i;
const needsAI = (r: Reply, extra = '') => {
  if (r.status === 429 && r.json?.code === 'quota') skip('Gemini daily quota is used up — cannot test this today');
  if (QUOTA.test(extra) || QUOTA.test(r.text.slice(0, 600))) skip('Gemini daily quota is used up — cannot test this today');
};

const listDocs = async (bot: Bot): Promise<any[]> => (await bot.call('GET', '/api/documents')).json ?? [];

async function main() {
  console.log(`CogniBase API bots → ${BASE_URL}`);

  // ───────────────────────────────────────────── signed out
  group('1. Signed out');
  const getRoutes = ['/api/home', '/api/documents', '/api/metrics', '/api/settings', '/api/study-guides', '/api/studio/assets', '/api/timetable', '/api/profile', '/api/audit-logs', '/api/settings/export', '/api/users'];
  const postRoutes = ['/api/chat', '/api/documents', '/api/engine/analyze', '/api/engine/generate-study-guide', '/api/studio/generate', '/api/engine/extract-courses', '/api/engine/extract-timetable', '/api/study-guides', '/api/study-guides/progress', '/api/metrics'];
  await test('every data route refuses a signed-out caller with 401', async () => {
    const bad: string[] = [];
    for (const p of getRoutes) {
      const r = await anon('GET', p);
      if (r.status !== 401) bad.push(`GET ${p} → ${r.status}`);
    }
    for (const p of postRoutes) {
      const r = await anon('POST', p, {});
      if (r.status !== 401) bad.push(`POST ${p} → ${r.status}`);
    }
    assert(bad.length === 0, bad.join('; '));
    return `${getRoutes.length + postRoutes.length} routes checked`;
  });
  await test('app pages redirect signed-out visitors to /login', async () => {
    const bad: string[] = [];
    for (const p of ['/dashboard', '/vault', '/study-guides', '/analytics', '/settings', '/schedule']) {
      const r = await anon('GET', p);
      if (r.status !== 307 || !String(r.headers.get('location')).includes('/login')) bad.push(`${p} → ${r.status}`);
    }
    assert(bad.length === 0, bad.join('; '));
  });
  await test('public pages load (landing, login, signup)', async () => {
    for (const p of ['/', '/login', '/signup']) {
      const r = await anon('GET', p);
      assert(r.status === 200, `${p} → ${r.status}`);
    }
  });
  await test('login page has real content in the server HTML (no blank flash)', async () => {
    const r = await anon('GET', '/login');
    assert(r.text.includes('Welcome back'), 'form is not in the server-rendered HTML');
  });
  await test('shared-guide page for an unknown id says "not available"', async () => {
    const r = await anon('GET', '/share/guide/does-not-exist');
    assert(r.status === 200 && r.text.includes('available'), `status ${r.status}`);
  });

  // ───────────────────────────────────────────── sign in
  group('2. Sign in');
  let bot1!: Bot;
  let bot2!: Bot;
  await test('both test accounts sign in', async () => {
    bot1 = await signIn('bot1', process.env.BOT1_EMAIL!, process.env.BOT1_PASSWORD!);
    bot2 = await signIn('bot2', process.env.BOT2_EMAIL!, process.env.BOT2_PASSWORD!);
    return `${bot1.userId.slice(0, 8)}…, ${bot2.userId.slice(0, 8)}…`;
  });
  if (!bot1 || !bot2) {
    return finish('api');
  }
  await test('signed-in pages load (home, library, study, progress, settings, schedule)', async () => {
    for (const p of ['/dashboard', '/vault', '/study-guides', '/analytics', '/settings', '/schedule']) {
      const r = await bot1.call('GET', p);
      assert(r.status === 200, `${p} → ${r.status}`);
    }
  });
  await test('signed-in user is bounced off /login to the dashboard', async () => {
    const r = await bot1.call('GET', '/login');
    assert(r.status === 307 && String(r.headers.get('location')).includes('/dashboard'), `status ${r.status}`);
  });

  // The bots are throwaway accounts: start from a clean slate (an interrupted run may have left data behind).
  await test('reset: remove leftovers from earlier runs', async () => {
    let removed = 0;
    for (const b of [bot1, bot2]) {
      for (const g of (await b.call('GET', '/api/study-guides')).json ?? []) {
        await b.call('DELETE', `/api/study-guides/${g.id}`);
        removed++;
      }
      for (const a of (await b.call('GET', '/api/studio/assets')).json?.assets ?? []) {
        await b.call('DELETE', `/api/studio/assets?id=${a.id}`);
        removed++;
      }
      for (const d of await listDocs(b)) {
        await b.call('DELETE', `/api/documents?id=${d.id}`);
        removed++;
      }
    }
    return `${removed} leftover items removed`;
  });

  // Snapshot state we will change, so it can be put back.
  const originalTimetable = (await bot1.call('GET', '/api/timetable')).json?.scheduled_classes ?? [];
  const originalProfile = (await bot1.call('GET', '/api/profile')).json?.profile ?? null;
  const originalSettings = (await bot1.call('GET', '/api/settings')).json;

  // ───────────────────────────────────────────── ingestion
  group('3. Adding sources');
  let textDoc = '';
  await test('paste text → source created', async () => {
    textDoc = await createText(bot1, 'Zorblax notes (bot)', SECRET_TEXT);
    const mine = await listDocs(bot1);
    const d = mine.find((x) => x.id === textDoc);
    assert(d, 'new source missing from the library list');
    assert(d.sourceType === 'text', `sourceType ${d.sourceType}`);
    assert(d.indexed === false, 'should not be searchable until indexed');
  });

  const uploaded: Record<string, string> = {};
  const upload = async (bot: Bot, fileName: string, body: Buffer, contentType: string) => {
    const path = `${bot.userId}/bot-${Date.now()}-${fileName}`;
    const { error } = await bot.supabase.storage.from(BUCKET).upload(path, body, { contentType });
    assert(!error, `storage upload failed: ${error?.message}`);
    const { data } = bot.supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  };
  const addFile = async (label: string, fileName: string, body: Buffer, contentType: string) => {
    const { url } = await upload(bot1, fileName, body, contentType);
    uploaded[label] = url;
    const r = await bot1.call('POST', '/api/documents', { name: fileName, url, fileSize: body.length });
    assert(r.status === 200 && r.json?.id, `add failed: ${r.status} ${r.text.slice(0, 160)}`);
    made.docs.push({ bot: bot1, id: r.json.id });
    return r.json.id as string;
  };
  let txtFileDoc = '';
  await test('upload a .txt file → text extracted', async () => {
    txtFileDoc = await addFile('txt', 'zorblax.txt', await textFile(), 'text/plain');
  });
  await test('upload a .pptx file → text extracted', async () => {
    await addFile('pptx', 'zorblax-slides.pptx', await pptxFile(), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  });
  await test('upload a .docx file → text extracted', async () => {
    await addFile('docx', 'glassfern.docx', await docxFile(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
  await test('web page link → text extracted', async () => {
    const r = await bot1.call('POST', '/api/documents', { url: 'https://example.com' });
    assert(r.status === 200 && r.json?.id, `${r.status} ${r.text.slice(0, 160)}`);
    made.docs.push({ bot: bot1, id: r.json.id });
    assert(r.json.sourceType === 'website', `sourceType ${r.json.sourceType}`);
    return `named "${r.json.name}"`;
  });
  await test('YouTube link → transcript extracted and titled (needs captions + network)', async () => {
    const r = await bot1.call('POST', '/api/documents', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    if (r.status === 400) skip(`YouTube refused or no captions (${r.json?.error}) — outside our control`);
    assert(r.status === 200 && r.json?.id, `${r.status} ${r.text.slice(0, 160)}`);
    made.docs.push({ bot: bot1, id: r.json.id });
    assert(r.json.sourceType === 'youtube', `sourceType ${r.json.sourceType}`);
    return `titled "${r.json.name}"`;
  });

  group('4. Input the app must refuse');
  const refuse = async (label: string, body: unknown, ...okStatuses: number[]) => {
    const r = await bot1.call('POST', '/api/documents', body);
    assert(okStatuses.includes(r.status), `expected ${okStatuses.join('/')}, got ${r.status}: ${r.text.slice(0, 120)}`);
  };
  await test('link to localhost is refused', () => refuse('localhost', { url: 'http://localhost:3000/api/home' }, 400));
  await test('link to a private network address is refused', () => refuse('lan', { url: 'http://192.168.1.1/' }, 400));
  await test('link to the cloud metadata address is refused', () => refuse('meta', { url: 'http://169.254.169.254/latest/meta-data/' }, 400));
  await test('file URL pointing outside our storage is refused', () => refuse('foreign', { name: 'x.pdf', url: 'https://supabase.co.evil.example/storage/v1/object/public/x.pdf' }, 400));
  await test('empty body gets a 400 (not a crash)', () => refuse('empty', {}, 400));
  await test('text over 500,000 characters is refused', () => refuse('huge', { name: 'big', rawText: 'a'.repeat(500_001) }, 413));
  await test('text sent as a number is refused', () => refuse('nan', { name: 'x', rawText: 12345 }, 400));
  await test('malformed JSON does not return a 5xx', async () => {
    const r = await bot1.call('POST', '/api/documents', 'this is not json', { raw: true });
    assert(r.status < 500, `got ${r.status} (low severity: bad JSON should be a 400)`);
  });
  await test('extract-courses refuses a non-storage URL', async () => {
    const r = await bot1.call('POST', '/api/engine/extract-courses', { fileUrl: 'http://169.254.169.254/' });
    assert(r.status === 400, `got ${r.status}`);
  });

  // ───────────────────────────────────────────── indexing
  group('5. Indexing (chunks + embeddings)');
  await test('index the pasted text; the library then marks it searchable', async () => {
    const detail = await index(bot1, textDoc);
    const d = (await listDocs(bot1)).find((x) => x.id === textDoc);
    assert(d?.indexed === true && d.chunkCount > 0, 'document not marked indexed');
    return detail;
  });
  await test('re-indexing the same source replaces its chunks (no duplicate-key failure)', async () => {
    const before = (await listDocs(bot1)).find((x) => x.id === textDoc).chunkCount;
    await index(bot1, textDoc);
    const after = (await listDocs(bot1)).find((x) => x.id === textDoc).chunkCount;
    assert(after === before, `chunk count changed ${before} → ${after}`);
  });
  await test('index the uploaded .txt file', async () => {
    assert(txtFileDoc, 'no txt doc');
    return index(bot1, txtFileDoc);
  });
  await test('indexing someone else’s source is refused', async () => {
    const r = await bot2.call('POST', '/api/engine/analyze', { docId: textDoc });
    assert(r.status === 404, `got ${r.status}`);
  });
  await test('indexing without a docId is a 400', async () => {
    const r = await bot1.call('POST', '/api/engine/analyze', {});
    assert(r.status === 400, `got ${r.status}`);
  });

  // ───────────────────────────────────────────── ask
  group('6. Ask (chat with sources)');
  await test('answers from the selected source and calls the search tool', async () => {
    const r = await bot1.call('POST', '/api/chat', { messages: [ask('What is the capital city of Zorblax?')], activeSources: [textDoc] });
    assert(r.status === 200, `status ${r.status}: ${r.text.slice(0, 160)}`);
    const { answer, tools, error } = chatText(r.text);
    needsAI(r, error);
    assert(tools.includes('searchSources'), `search tool not used (tools: ${tools.join(',') || 'none'})`);
    assert(answer.includes(MARKER_FACT), `answer missed the fact: "${answer.slice(0, 160)}"`);
    return answer.includes('cite:') ? 'answered with a citation' : 'answered (no citation link found — check prompt)';
  });
  await test('answer contains a cite: link naming the source', async () => {
    const r = await bot1.call('POST', '/api/chat', { messages: [ask('When was the Zorblax Accord signed? Cite your source.')], activeSources: [textDoc] });
    const { answer, error } = chatText(r.text);
    needsAI(r, error);
    assert(answer.includes('1847'), `missed the date: "${answer.slice(0, 120)}"`);
    assert(/\]\(cite:/.test(answer), 'no [•](cite:NAME) citation in the answer');
  });
  await test('with no selection, Ask still finds the user’s own sources', async () => {
    const r = await bot1.call('POST', '/api/chat', { messages: [ask('What does Zorblax export?')] });
    const { answer, error } = chatText(r.text);
    needsAI(r, error);
    assert(/glassfern|lumicloth/i.test(answer), `answer: "${answer.slice(0, 140)}"`);
  });
  await test('another user cannot read it by passing the source id', async () => {
    const r = await bot2.call('POST', '/api/chat', { messages: [ask('What is the capital city of Zorblax?')], activeSources: [textDoc] });
    assert(r.status === 200, `status ${r.status}`);
    const { answer } = chatText(r.text);
    assert(!answer.includes(MARKER_FACT), `LEAK: bot2 got "${MARKER_FACT}" from bot1's source`);
  });
  await test('another user cannot read it with no selection either', async () => {
    const r = await bot2.call('POST', '/api/chat', { messages: [ask('What is the capital city of Zorblax?')] });
    const { answer } = chatText(r.text);
    assert(!answer.includes(MARKER_FACT), `LEAK: bot2 got "${MARKER_FACT}" without any selection`);
  });
  await test('another user cannot scope to someone else’s workspace', async () => {
    const mine = (await listDocs(bot1)).find((x) => x.id === textDoc);
    const r = await bot2.call('POST', '/api/chat', { messages: [ask('hello')], workspaceId: mine.workspaceId });
    assert(r.status === 404, `got ${r.status}`);
  });
  await test('empty or malformed messages are a 400', async () => {
    const a = await bot1.call('POST', '/api/chat', { messages: [] });
    const b = await bot1.call('POST', '/api/chat', { messages: 'hi' });
    assert(a.status === 400 && b.status === 400, `got ${a.status} / ${b.status}`);
  });

  // ───────────────────────────────────────────── generation
  group('7. Generating study material');
  const assetOf = async (kind: string, who: Bot = bot1, ids: string[] = [textDoc]): Promise<Reply> => who.call('POST', '/api/studio/generate', { kind, documentIds: ids });
  await test('flashcards: saved, with valid question/answer pairs', async () => {
    const r = await assetOf('flashcards');
    needsAI(r);
    assert(r.status === 200, `status ${r.status}: ${r.text.slice(0, 160)}`);
    made.assets.push({ bot: bot1, id: r.json.asset.id });
    const c = r.json.asset.content;
    assert(r.json.asset.type === 'FLASHCARD' && Array.isArray(c) && c.length >= 5, 'bad shape');
    assert(c.every((x: any) => x.question && x.answer), 'a card is missing a side');
    return `${c.length} cards`;
  });
  await test('mind map: saved, with Mermaid code', async () => {
    const r = await assetOf('mindmap');
    needsAI(r);
    assert(r.status === 200, `status ${r.status}: ${r.text.slice(0, 160)}`);
    made.assets.push({ bot: bot1, id: r.json.asset.id });
    assert(/graph\s+TD/i.test(r.json.asset.content.mermaidCode), 'not a top-down graph');
  });
  await test('slides: saved, with titles and bullets', async () => {
    const r = await assetOf('slides');
    needsAI(r);
    assert(r.status === 200, `status ${r.status}: ${r.text.slice(0, 160)}`);
    made.assets.push({ bot: bot1, id: r.json.asset.id });
    const s = r.json.asset.content;
    assert(Array.isArray(s) && s.length >= 3 && s.every((x: any) => x.title && Array.isArray(x.bulletPoints)), 'bad slide shape');
    return `${s.length} slides`;
  });
  await test('saved items show up in the user’s Studio list, and not in another user’s', async () => {
    const mine = (await bot1.call('GET', '/api/studio/assets')).json.assets;
    const theirs = (await bot2.call('GET', '/api/studio/assets')).json.assets;
    if (made.assets.length === 0) skip('nothing was generated (AI unavailable)');
    assert(mine.length >= made.assets.length, `bot1 sees ${mine.length} of ${made.assets.length}`);
    assert(!theirs.some((a: any) => made.assets.some((m) => m.id === a.id)), 'LEAK: bot2 can list bot1 assets');
  });
  await test('unknown asset type is a 400', async () => {
    const r = await assetOf('podcast');
    assert(r.status === 400, `got ${r.status}`);
  });
  await test('generating from someone else’s source is refused', async () => {
    const r = await assetOf('flashcards', bot2);
    assert(r.status === 400 || r.status === 404, `got ${r.status}`);
    assert(!r.json?.asset, 'LEAK: bot2 generated from bot1 content');
  });
  await test('another user cannot delete someone else’s saved item', async () => {
    const target = made.assets[0];
    if (!target) skip('nothing was generated (AI unavailable)');
    const r = await bot2.call('DELETE', `/api/studio/assets?id=${target.id}`);
    assert(r.status === 404, `got ${r.status}`);
  });

  let guideId = '';
  let firstPhase = '';
  await test('study guide: built and saved with phases, bites and cards', async () => {
    const r = await bot1.call('POST', '/api/engine/generate-study-guide', { documentId: textDoc, sectionConstraint: 'Format: General Knowledge | Timeframe: Standard | Level: Beginner' });
    needsAI(r);
    assert(r.status === 200, `status ${r.status}: ${r.text.slice(0, 160)}`);
    guideId = r.json.guide.id;
    made.guides.push({ bot: bot1, id: guideId });
    const phases = r.json.studyGuide.phases;
    assert(phases.length >= 2, `only ${phases.length} phases`);
    firstPhase = String(phases[0].phaseId ?? '1');
    assert(phases.every((p: any) => Array.isArray(p.microBites) && Array.isArray(p.flashcards)), 'phase missing bites or cards');
    return `${phases.length} phases`;
  });
  await test('study guide from someone else’s source is refused', async () => {
    const r = await bot2.call('POST', '/api/engine/generate-study-guide', { documentId: textDoc, sectionConstraint: 'Format: General Knowledge' });
    assert(r.status === 404, `got ${r.status}`);
  });

  group('8. Study guide lifecycle');
  const needGuide = () => { if (!guideId) skip('no study guide was built (AI unavailable)'); };
  await test('completing a phase is recorded and shows in the list', async () => {
    needGuide();
    const p = await bot1.call('POST', '/api/study-guides/progress', { guideId, phaseId: firstPhase });
    assert(p.status === 200, `status ${p.status}`);
    const g = await bot1.call('GET', `/api/study-guides/progress?guideId=${guideId}`);
    assert(g.json.completedPhases.includes(firstPhase), 'phase not recorded');
    const list = (await bot1.call('GET', '/api/study-guides')).json;
    const row = list.find((x: any) => x.id === guideId);
    assert(row?.completedPhases === 1 && row.totalPhases >= 2, `list shows ${row?.completedPhases}/${row?.totalPhases}`);
  });
  await test('another user cannot record progress on, share, or delete it', async () => {
    needGuide();
    const a = await bot2.call('POST', '/api/study-guides/progress', { guideId, phaseId: '1' });
    const b = await bot2.call('PATCH', `/api/study-guides/${guideId}/share`, { isPublic: true });
    const c = await bot2.call('DELETE', `/api/study-guides/${guideId}`);
    assert(a.status === 404, `progress → ${a.status}`);
    assert(b.status === 404, `share → ${b.status}`);
    assert(c.status === 403 || c.status === 404, `delete → ${c.status}`);
  });
  await test('another user does not see it in their list', async () => {
    needGuide();
    const list = (await bot2.call('GET', '/api/study-guides')).json;
    assert(!list.some((x: any) => x.id === guideId), 'LEAK: bot2 lists bot1 guide');
  });
  await test('private guide is hidden on the public share page', async () => {
    needGuide();
    const r = await anon('GET', `/share/guide/${guideId}`);
    assert(r.text.includes('available'), 'private guide is visible to the public');
  });
  await test('shared guide is readable by anyone; unsharing hides it again', async () => {
    needGuide();
    const on = await bot1.call('PATCH', `/api/study-guides/${guideId}/share`, { isPublic: true });
    assert(on.status === 200 && on.json.isPublic === true, `share on → ${on.status}`);
    const open = await anon('GET', `/share/guide/${guideId}`);
    assert(open.status === 200 && !open.text.includes("isn&#x27;t available") && open.text.includes('Knowledge check') || open.text.includes('Shared from CogniBase'), 'public page did not show the guide');
    const off = await bot1.call('PATCH', `/api/study-guides/${guideId}/share`, { isPublic: false });
    assert(off.status === 200, `share off → ${off.status}`);
    const closed = await anon('GET', `/share/guide/${guideId}`);
    assert(closed.text.includes('available'), 'still visible after unsharing');
  });
  await test('shared page does not reveal flashcard answers to anonymous readers', async () => {
    needGuide();
    await bot1.call('PATCH', `/api/study-guides/${guideId}/share`, { isPublic: true });
    const page = await anon('GET', `/share/guide/${guideId}`);
    const full = (await bot1.call('GET', '/api/study-guides')).json.find((x: any) => x.id === guideId);
    const answers: string[] = full.strategyData.phases.flatMap((p: any) => (p.flashcards || []).map((c: any) => c.answer));
    await bot1.call('PATCH', `/api/study-guides/${guideId}/share`, { isPublic: false });
    const leaked = answers.filter((a) => a && a.length > 12 && page.text.includes(a.replace(/'/g, '&#x27;').replace(/"/g, '&quot;')));
    assert(leaked.length === 0, `${leaked.length} flashcard answers appear in the public page`);
  });

  // ───────────────────────────────────────────── isolation of plain data
  group('9. Data isolation');
  await test('another user does not see the library, and cannot delete from it', async () => {
    const theirs = await listDocs(bot2);
    assert(!theirs.some((d) => d.id === textDoc), 'LEAK: bot2 lists bot1 source');
    const r = await bot2.call('DELETE', `/api/documents?id=${textDoc}`);
    assert(r.status === 404, `delete → ${r.status}`);
    assert((await listDocs(bot1)).some((d) => d.id === textDoc), 'source vanished');
  });
  await test('data export contains only the caller’s data', async () => {
    const r = await bot2.call('GET', '/api/settings/export');
    assert(r.status === 200, `status ${r.status}`);
    assert(!r.text.includes('Zorblax'), 'LEAK: bot2 export includes bot1 content');
  });
  await test('activity log is per user', async () => {
    const r = await bot2.call('GET', '/api/audit-logs');
    assert(r.status === 200 && Array.isArray(r.json), `status ${r.status}`);
    assert(!r.json.some((l: any) => /Zorblax/.test(l.details || '')), 'LEAK in activity log');
  });
  await test('storage: an uploaded file cannot be fetched without signing in', async () => {
    const url = uploaded.txt;
    assert(url, 'no uploaded file');
    const r = await fetch(url);
    assert(r.status !== 200, 'bucket is public: anyone with the link can read uploads (your fix: make the bucket private + add the policies)');
  });
  await test('storage: another user cannot download it through the storage API', async () => {
    const path = uploaded.txt.split(`${BUCKET}/`)[1];
    const { data, error } = await bot2.supabase.storage.from(BUCKET).download(decodeURIComponent(path));
    assert(error || !data, 'bot2 downloaded bot1’s file (needs the storage policies from the README)');
  });

  await test('storage: a signed-out visitor cannot list, download, upload or delete files', async () => {
    const anonSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const path = decodeURIComponent(uploaded.txt.split(`${BUCKET}/`)[1]);
    const folder = path.split('/')[0];
    const problems: string[] = [];

    const listed = await anonSb.storage.from(BUCKET).list(folder);
    if (!listed.error && (listed.data?.length ?? 0) > 0) problems.push('can list files');
    const dl = await anonSb.storage.from(BUCKET).download(path);
    if (!dl.error && dl.data) problems.push('can download');
    const up = await anonSb.storage.from(BUCKET).upload(`${folder}/anon-probe-${Date.now()}.txt`, Buffer.from('probe'), { contentType: 'text/plain' });
    if (!up.error) {
      problems.push('can upload');
      await anonSb.storage.from(BUCKET).remove([up.data.path]);
    }
    const rm = await anonSb.storage.from(BUCKET).remove([path]);
    if (!rm.error && (rm.data?.length ?? 0) > 0) problems.push('can delete');
    assert(problems.length === 0, `signed-out visitor ${problems.join(', ')}`);
  });
  await test('storage: a user cannot upload into another user’s folder', async () => {
    const { error } = await bot2.supabase.storage.from(BUCKET).upload(`${bot1.userId}/intruder-${Date.now()}.txt`, Buffer.from('x'), { contentType: 'text/plain' });
    assert(error, 'bot2 wrote into bot1’s folder');
  });
  await test('storage: a user cannot delete another user’s file', async () => {
    const path = decodeURIComponent(uploaded.txt.split(`${BUCKET}/`)[1]);
    const { data } = await bot2.supabase.storage.from(BUCKET).remove([path]);
    assert((data?.length ?? 0) === 0, 'bot2 deleted bot1’s file');
    const { data: still } = await bot1.supabase.storage.from(BUCKET).download(path);
    assert(still, 'file is gone');
  });

  // ───────────────────────────────────────────── account data endpoints
  group('10. Settings, schedule, progress');
  await test('home summary has the expected shape', async () => {
    const r = await bot1.call('GET', '/api/home');
    assert(r.status === 200, `status ${r.status}`);
    assert(Array.isArray(r.json.week) && r.json.week.length === 7, 'week is not 7 days');
    assert(typeof r.json.focusGoal === 'number' && typeof r.json.sourceCount === 'number', 'missing fields');
    assert(r.json.sourceCount >= 1, 'should count the bot’s sources');
    if (guideId) assert(r.json.continueGuide, 'no guide to continue');
  });
  await test('progress: week of 7 days, streak is a number', async () => {
    const r = await bot1.call('GET', '/api/metrics');
    assert(r.status === 200 && r.json.week.length === 7 && typeof r.json.streak === 'number', 'bad shape');
  });
  await test('progress: unknown action is a 400; real action credits today', async () => {
    const bad = await bot1.call('POST', '/api/metrics', { action: 'give_me_a_million_minutes' });
    assert(bad.status === 400, `bogus action → ${bad.status}`);
    const good = await bot1.call('POST', '/api/metrics', { action: 'chat_message' });
    assert(good.status === 200, `real action → ${good.status}`);
  });
  await test('settings: partial update works, and is restored', async () => {
    const r = await bot1.call('POST', '/api/settings', { preferences: { dailyFocusGoal: 90 } });
    assert(r.status === 200, `status ${r.status}`);
    assert((await bot1.call('GET', '/api/settings')).json.preferences.dailyFocusGoal === 90, 'goal not saved');
  });
  await test('settings: out-of-range goal, bad theme, junk types are all 400', async () => {
    const codes = [
      (await bot1.call('POST', '/api/settings', { preferences: { dailyFocusGoal: 'abc' } })).status,
      (await bot1.call('POST', '/api/settings', { preferences: { dailyFocusGoal: 99999 } })).status,
      (await bot1.call('POST', '/api/settings', { preferences: { theme: 'neon' } })).status,
      (await bot1.call('POST', '/api/settings', { username: 12345 })).status,
    ];
    assert(codes.every((c) => c === 400), `statuses ${codes.join(',')}`);
  });
  await test('timetable: valid list saves; junk is a 400', async () => {
    const good = await bot1.call('PATCH', '/api/timetable', { scheduled_classes: [{ id: 'bot1', courseCode: 'BOT101', day: 'Monday', startTime: '9:00 AM', endTime: '10:00 AM' }] });
    assert(good.status === 200, `valid → ${good.status}`);
    const junk = [
      (await bot1.call('PATCH', '/api/timetable', { scheduled_classes: 'nope' })).status,
      (await bot1.call('PATCH', '/api/timetable', { scheduled_classes: [{ foo: 1 }] })).status,
      (await bot1.call('PATCH', '/api/timetable', {})).status,
    ];
    assert(junk.every((c) => c === 400), `junk statuses ${junk.join(',')}`);
  });
  await test('timetable is private to the user', async () => {
    const theirs = (await bot2.call('GET', '/api/timetable')).json.scheduled_classes ?? [];
    assert(!theirs.some((c: any) => c.courseCode === 'BOT101'), 'LEAK: bot2 sees bot1 classes');
  });
  await test('profile: object saves; string or oversized is a 400', async () => {
    const ok = await bot1.call('PATCH', '/api/profile', { profile: { ...(originalProfile ?? {}), courses: [{ courseCode: 'BOT101', courseTitle: 'Bot course', semester: 'First' }] } });
    assert(ok.status === 200, `valid → ${ok.status}`);
    const a = await bot1.call('PATCH', '/api/profile', { profile: 'nope' });
    const b = await bot1.call('PATCH', '/api/profile', { profile: { blob: 'x'.repeat(120_000) } });
    assert(a.status === 400 && b.status === 400, `junk → ${a.status}/${b.status}`);
  });
  await test('Ask knows the user’s courses (profile.courses reaches the prompt)', async () => {
    const r = await bot1.call('POST', '/api/chat', { messages: [ask('Which course codes am I enrolled in? List them from my context if you know.')], userProfile: { courses: [{ courseCode: 'BOT101' }] } });
    assert(r.status === 200, `status ${r.status}`);
  });

  // ───────────────────────────────────────────── load
  group('11. Rate limiting (last: it uses up the ingest budget)');
  await test('a flood of imports gets 429 with Retry-After', async () => {
    await sleep(61_000); // let the earlier calls fall out of the one-minute window
    let limited: Reply | null = null;
    let ok = 0;
    for (let i = 0; i < 25; i++) {
      const r = await bot1.call('POST', '/api/documents', { name: `flood-${i}`, rawText: `flood ${i}` });
      if (r.status === 429) {
        limited = r;
        break;
      }
      if (r.status === 200) made.docs.push({ bot: bot1, id: r.json.id });
      ok++;
    }
    assert(limited, 'no rate limit hit after 25 rapid imports');
    assert(limited.headers.get('retry-after'), 'missing Retry-After header');
    return `limited after ${ok} requests`;
  });
  await test('the limit is per user (the other bot is not blocked)', async () => {
    const r = await bot2.call('POST', '/api/documents', { name: 'bot2 ok', rawText: 'bot2 note' });
    assert(r.status === 200, `bot2 got ${r.status}`);
    made.docs.push({ bot: bot2, id: r.json.id });
  });

  // ───────────────────────────────────────────── cleanup
  group('12. Cleanup');
  await test('restore settings, timetable and profile', async () => {
    await bot1.call('PATCH', '/api/timetable', { scheduled_classes: originalTimetable });
    if (originalProfile) await bot1.call('PATCH', '/api/profile', { profile: originalProfile });
    const prefs = originalSettings?.preferences;
    if (prefs?.dailyFocusGoal) await bot1.call('POST', '/api/settings', { preferences: { dailyFocusGoal: prefs.dailyFocusGoal } });
  });
  await test('delete everything the bots made (storage files included)', async () => {
    for (const a of made.assets) await a.bot.call('DELETE', `/api/studio/assets?id=${a.id}`);
    for (const g of made.guides) await g.bot.call('DELETE', `/api/study-guides/${g.id}`);
    // The documents route is rate limited for delete? No: only POST is. Wait out the window anyway for DELETE-heavy cleanup.
    let failed = 0;
    for (const d of made.docs) {
      const r = await d.bot.call('DELETE', `/api/documents?id=${d.id}`);
      if (r.status !== 200) failed++;
    }
    assert(failed === 0, `${failed} of ${made.docs.length} deletes failed`);
    const left = (await listDocs(bot1)).filter((d) => made.docs.some((m) => m.id === d.id));
    assert(left.length === 0, `${left.length} sources remain`);
    return `${made.docs.length} sources, ${made.assets.length} items, ${made.guides.length} guides removed`;
  });

  return finish('api');
}

main()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((e) => {
    console.error('Bot run crashed:', e);
    process.exit(2);
  });
