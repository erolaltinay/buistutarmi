// Testler için: PDF'in metnini sayfa sayfa çıkarır (Türkçe karakter kabul kriteri, İP-1.6).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function pdfText(pdf: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((x) => ('str' in x ? x.str : '')).join(''));
  }
  return pages;
}
