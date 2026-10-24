import PDFParser from 'pdf2json';
import { parseOffice } from 'officeparser';

/** Plain text from a PDF's text layer (no OCR). */
export function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);
    parser.on('pdfParser_dataError', (err: Error | { parserError: Error }) =>
      reject('parserError' in err ? err.parserError : err)
    );
    parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()));
    parser.parseBuffer(buffer);
  });
}

/** Text from Word or PowerPoint files. */
export async function extractOfficeText(buffer: Buffer, fileType: 'docx' | 'pptx'): Promise<string> {
  const ast = await parseOffice(buffer, { fileType });
  return typeof ast === 'string' ? ast : ast.toText();
}
