import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport, type ReportModel } from '../src/index';
import { pdfText } from '../src/test-utils';

const fontDir = fileURLToPath(new URL('../fonts', import.meta.url));

const model: ReportModel = {
  brand: 'Bu İş Tutar mı?',
  title: 'Kahve dükkânı · Fizibilite raporu',
  subtitle: 'Kadıköy, Moda · 04.11.2026',
  verdict: {
    tone: 'mid',
    eyebrow: 'KARAR',
    label: 'ŞARTLI',
    why: 'Şişli çağrı Öğle ÜĞŞİÖÇ üğşıöç.',
    preliminary: 'Ön değerlendirme',
    confidence: 'Örnek veriye dayanan kısım: %76',
  },
  tiles: [{ value: '₺957.500', label: 'Gerçek yatırım' }],
  chart: { title: 'Aylık net kâr', note: 'max ₺1 Mn', values: [-5, 3, 8] },
  blocks: [
    { kind: 'h2', text: 'Mevzuat yol haritası' },
    { kind: 'notice', text: 'Son kontrol: 02.11.2026.' },
    {
      kind: 'table',
      columns: [
        { head: 'Madde', width: 0.5, bold: true },
        { head: 'Kaynak', width: 0.5 },
      ],
      rows: [[{ text: 'İşyeri açma ruhsatı' }, { text: 'Resmi kaynak', href: 'https://example.org' }]],
    },
  ],
  disclaimer: 'Yatırım tavsiyesi değildir.',
  pageLabel: 'Sayfa {page} / {total}',
};

describe('PDF dizgisi', () => {
  it('Türkçe karakterler ve ₺ metin olarak geri okunur', async () => {
    const pdf = await renderReport(model, { fontDir });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = (await pdfText(pdf)).join(' ');
    for (const s of ['Bu İş Tutar mı?', 'ŞARTLI', 'ÜĞŞİÖÇ', 'üğşıöç', '₺957.500', 'İşyeri açma ruhsatı'])
      expect(text).toContain(s);
  });

  it('her sayfada uyarı ve sayfa numarası var', async () => {
    const long: ReportModel = {
      ...model,
      blocks: [{ kind: 'bullets', items: Array.from({ length: 200 }, (_, i) => `Madde ${i}`) }],
    };
    const pages = await pdfText(await renderReport(long, { fontDir }));
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, i) => {
      expect(p).toContain('Yatırım tavsiyesi değildir.');
      expect(p).toContain(`Sayfa ${i + 1} / ${pages.length}`);
    });
  });

  it('fontta olmayan karakter (emoji) metni bozmaz', async () => {
    const pdf = await renderReport({ ...model, subtitle: 'Moda 😀 şube' }, { fontDir });
    expect((await pdfText(pdf)).join(' ')).toMatch(/Moda\s+şube/);
  });
});
