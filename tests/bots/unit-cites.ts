import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { assert, finish, group, test } from './harness';
import { normaliseCites, parseCite } from '../../lib/cites';

// Does Markdown turn this into a link whose address starts with cite:? (That is what the console renders as a button.)
function links(md: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as { children: unknown[] };
  const found: string[] = [];
  const walk = (n: any) => {
    if (n.type === 'link') found.push(n.url);
    (n.children ?? []).forEach(walk);
  };
  walk(tree);
  return found;
}

group('Citation links with real document names');
(async () => {
  const names = ['BIO 101 Photosynthesis', 'Notes (2).pdf', 'Lecture 3 - Cell Biology.docx', 'organic_chemistry.txt', 'Café & Müller [draft].pptx', '100% Sure.txt'];
  for (const name of names) {
    await test(`"${name}" becomes a citation link and reads back correctly`, async () => {
      const md = `Fact one. [•](cite:${name}#3) Fact two.`;
      const raw = links(md).filter((u) => u.startsWith('cite:'));
      const fixed = links(normaliseCites(md)).filter((u) => u.startsWith('cite:'));
      assert(fixed.length === 1, `expected one citation link after fixing, got ${fixed.length}`);
      const back = parseCite(fixed[0]);
      assert(back.name === name && back.n === 3, `read back as "${back.name}" #${back.n}`);
      return raw.length === 0 ? 'was raw text before the fix' : 'already worked';
    });
  }
  await test('a name the model already encoded is not encoded twice', async () => {
    const out = normaliseCites('[•](cite:BIO%20101#2)');
    assert(parseCite(links(out)[0]).name === 'BIO 101', out);
  });
  await test('two citations in one sentence, and one without a passage number', async () => {
    const md = 'A [•](cite:My Notes#1) and B [•](cite:My Notes#2) and C [•](cite:My Notes).';
    const l = links(normaliseCites(md)).filter((u) => u.startsWith('cite:'));
    assert(l.length === 3, `${l.length} links`);
    assert(parseCite(l[2]).n === null && parseCite(l[2]).name === 'My Notes', 'no-number form');
  });
  await test('ordinary links and text are left alone', async () => {
    const md = 'See [the docs](https://example.com/a b) and (cite: not a link) and [x](y).';
    assert(normaliseCites(md) === md, 'text changed');
  });
  await test('a half-streamed citation does not break anything', async () => {
    const md = 'Partial [•](cite:BIO 101 Photo';
    assert(normaliseCites(md) === md, 'changed an unfinished citation');
  });
  // The renderer itself: react-markdown blanks link addresses with schemes it does not know.
  const render = (md: string, transform?: (u: string) => string) =>
    renderToStaticMarkup(createElement(ReactMarkdown, { urlTransform: transform }, md));
  const ours = (url: string) => (url.startsWith('cite:') ? url : defaultUrlTransform(url));
  await test('by default the renderer erases cite: links (why citations showed as a bare dot)', async () => {
    assert(!render('[•](cite:Notes#1)').includes('cite:'), 'the default now keeps cite: links');
  });
  await test('with the console’s rule, the citation survives and decodes to the right name', async () => {
    const html = render(normaliseCites('A [•](cite:BIO 101 Photosynthesis#1)'), ours);
    const href = html.match(/href="([^"]+)"/)?.[1] ?? '';
    assert(href.startsWith('cite:'), `href was "${href}"`);
    assert(parseCite(href.replace(/&amp;/g, '&')).name === 'BIO 101 Photosynthesis', href);
  });
  await test('dangerous links are still removed (javascript:, data:, vbscript:)', async () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'vbscript:x', 'JaVaScRiPt:alert(1)']) {
      const html = render(`[click](${bad})`, ours);
      assert(!/href="[^"]*(javascript|data:|vbscript)/i.test(html), `${bad} survived: ${html}`);
    }
  });
  process.exit(finish('unit-cites') ? 1 : 0);
})();
