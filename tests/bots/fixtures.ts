import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';

// A made-up country, so the model cannot answer from general knowledge. Retrieval either works or it doesn't.
export const MARKER_FACT = 'Quenthar';
export const SECRET_TEXT = `Notes on the Republic of Zorblax

The Republic of Zorblax is a fictional island nation used in these study notes. Its capital city is ${MARKER_FACT}, which sits on the northern coast beside the Veltrine Bay.

Government. Zorblax is governed by a council of nine elders called the Nonet. Elders serve single seven year terms and cannot be re-elected. The Nonet votes by passing coloured stones into a bronze urn.

Economy. The main export of Zorblax is glassfern, a luminous plant harvested every autumn. Glassfern fibre is spun into the lightweight cloth known as lumicloth. About sixty percent of all Zorblax income comes from lumicloth sales to neighbouring islands.

History. The Zorblax Accord was signed in 1847 and ended the Salt Wars between the northern and southern provinces. Before the Accord, ${MARKER_FACT} was a fishing village of only two hundred people.

Learning theories note. In the Zorblax school system, teachers use a method called stone-stacking: students build a tower of ideas where each new idea must rest on one the class already understands. This mirrors constructivism, in which learners build knowledge by connecting new ideas to prior knowledge.`;

export const textFile = () => Buffer.from(SECRET_TEXT, 'utf-8');

export async function pptxFile(): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.addSlide().addText('The Zorblax Accord was signed in 1847.', { x: 1, y: 1, w: 8, h: 1 });
  pptx.addSlide().addText('The capital of Zorblax is Quenthar.', { x: 1, y: 1, w: 8, h: 1 });
  return Buffer.from((await pptx.write({ outputType: 'nodebuffer' })) as Buffer);
}

export async function docxFile(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  const paragraphs = ['Glassfern harvest report', 'The main export of Zorblax is glassfern, harvested every autumn.', 'Lumicloth is spun from glassfern fibre.']
    .map((t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`)
    .join('');
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
