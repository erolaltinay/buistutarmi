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

/** Sayfa sayfa satırlar, yukarıdan aşağıya; `minY` altındaki (sayfa altı) metin atılır. */
export async function pdfLines(pdf: Uint8Array, minY = 0): Promise<string[][]> {
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    const rows = new Map<number, string>();
    for (const x of content.items) {
      if (!('str' in x) || !x.str.trim()) continue;
      const y = Math.round(x.transform[5] as number);
      if (y >= minY) rows.set(y, (rows.get(y) ?? '') + x.str);
    }
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, line]) => line));
  }
  return pages;
}
