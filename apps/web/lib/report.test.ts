// İP-1.6 kabul: PDF metni çıkarıldığında Türkçe karakterler doğru; 24 ay tablosu ve karşılaştırma
// isteğe bağlı; mevzuat uyarısı ve son kontrol tarihi her zaman var.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { renderReport } from '@bitm/pdf';
import { pdfText } from '@bitm/pdf/test-utils';
import { addCandidate } from './compare';
import { projectFromSample, type ProjectDoc } from './project';
import { buildReport, reportFilename, type ReportOptions } from './report';
import type { Translate } from './verdict-text';

const fontDir = fileURLToPath(new URL('../../../packages/pdf/fonts', import.meta.url));
const messages = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));

const ALL: ReportOptions = { monthly: true, cmp: true, shop: true };
const NONE: ReportOptions = { monthly: false, cmp: false, shop: false };

const build = (doc: ProjectDoc, options: ReportOptions, locale = 'tr', release = false) =>
  buildReport({
    doc,
    locale,
    options,
    release,
    today: new Date('2026-11-04T12:00:00Z'),
    t: createTranslator({ locale, messages: messages(locale) }) as unknown as Translate,
  });

/** Satır kırılmaları ve boşluklar metni bölmesin diye boşluksuz karşılaştırılır. */
const squash = (s: string) => s.replace(/\s+/g, '');
const read = async (doc: ProjectDoc, options: ReportOptions, locale = 'tr', release = false) => {
  const pages = await pdfText(await renderReport(build(doc, options, locale, release), { fontDir }));
  return { pages, text: squash(pages.join('')) };
};
const has = (text: string, s: string) => squash(text).includes(squash(s));

const coffee = () => projectFromSample('coffee', 'ist', 'p1');

describe('PDF rapor (İP-1.6)', () => {
  it('Türkçe karakterler metin olarak doğru çıkıyor', async () => {
    const { text } = await read(coffee(), ALL);
    for (const s of [
      'Bu İş Tutar mı?',
      'Kahve dükkânı · Fizibilite raporu',
      'Kadıköy, Moda',
      'Başabaş / gün',
      'Gerçek yatırım ihtiyacı',
    ])
      expect(has(text, s), s).toBe(true);
    expect(text).toContain('₺');
    for (const ch of ['ş', 'ğ', 'ı', 'İ', 'ü', 'ö', 'ç']) expect(text).toContain(ch);
    // Eksik glif veya bozuk kodlama kalmamış olmalı.
    expect(text).not.toMatch(/\uFFFD/);
  });

  it('bölümler prototipteki sırada, mevzuat fiyat stratejisinden sonra', () => {
    const d = coffee();
    addCandidate(d, 'Moda', 'c1', '2026-11-04');
    const heads = build(d, ALL)
      .blocks.filter((b) => b.kind === 'h2')
      .map((b) => (b as { text: string }).text);
    expect(heads).toEqual([
      'Finans özeti',
      '24 aylık projeksiyon (baz senaryo)',
      'Bölge profili',
      'Rakipler (1 km)',
      'Lokasyon karnesi',
      'Fiyat stratejisi',
      'Mevzuat yol haritası',
      'Aday karşılaştırması',
    ]);
  });

  it('24 ay tablosu isteğe bağlı', async () => {
    expect(has((await read(coffee(), { ...NONE, monthly: true })).text, '24 aylık projeksiyon')).toBe(true);
    expect(has((await read(coffee(), NONE)).text, '24 aylık projeksiyon')).toBe(false);
  });

  it('karşılaştırma isteğe bağlı ve aday yoksa çıkmaz', async () => {
    const d = coffee();
    addCandidate(d, 'Şişli şubesi', 'c1', '2026-11-04');
    const on = (await read(d, { ...NONE, cmp: true })).text;
    expect(has(on, 'Aday karşılaştırması')).toBe(true);
    expect(has(on, 'Şişli şubesi')).toBe(true);
    expect(has((await read(d, NONE)).text, 'Aday karşılaştırması')).toBe(false);
    expect(has((await read(coffee(), ALL)).text, 'Aday karşılaştırması')).toBe(false);
  });

  it('seçenek ne olursa olsun mevzuat uyarısı, son kontrol tarihi ve yatırım uyarısı var', async () => {
    for (const options of [ALL, NONE]) {
      const { pages, text } = await read(coffee(), options);
      expect(has(text, 'Bu liste genel bir rehberdir ve değişebilir.')).toBe(true);
      expect(has(text, 'Son kontrol: 2.11.2026.') || has(text, 'Son kontrol: 02.11.2026.')).toBe(true);
      // Her sayfada yatırım uyarısı ve sayfa numarası.
      pages.forEach((p, i) => {
        expect(has(p, 'yatırım tavsiyesi değildir'), `sayfa ${i + 1}`).toBe(true);
        expect(has(p, `Sayfa ${i + 1} / ${pages.length}`)).toBe(true);
      });
    }
  });

  it('kesin hukuki ifade kurmaz', async () => {
    const { text } = await read(coffee(), ALL);
    for (const s of ['uygunsunuz', 'bu belgeler yeterli', 'ruhsat çıkar']) expect(has(text, s)).toBe(false);
  });

  it('taslak madde işaretlenir; yayın derlemesinde gösterilmez', async () => {
    const demo = (await read(coffee(), NONE)).text;
    expect(has(demo, 'henüz doğrulanmadı')).toBe(true);
    expect(has(demo, 'Vergi mükellefiyeti kaydı')).toBe(true);

    const release = (await read(coffee(), NONE, 'tr', true)).text;
    expect(has(release, 'Vergi mükellefiyeti kaydı')).toBe(false);
    expect(has(release, 'doğrulanmış mevzuat maddesi henüz yok')).toBe(true);
  });

  it('kritik maddeler teyit listesine girer', () => {
    const blocks = build(coffee(), NONE).blocks;
    const i = blocks.findIndex((b) => b.kind === 'h3' && b.text === 'Açmadan önce teyit et');
    const next = blocks[i + 1];
    expect(next?.kind === 'bullets' && next.items).toContain('Mevzuat: Vergi mükellefiyeti kaydı');
  });

  it('desteklenmeyen ülkede liste yerine genel uyarı', async () => {
    const d: ProjectDoc = { ...coffee(), country: 'GENERIC' };
    const { text } = await read(d, NONE);
    expect(has(text, 'Bu ülke için mevzuat listesi sunmuyoruz')).toBe(true);
    expect(has(text, 'Vergi mükellefiyeti kaydı')).toBe(false);
  });

  it('İngilizce rapor', async () => {
    const { text } = await read(projectFromSample('barber', 'nyc', 'p2'), NONE, 'en');
    expect(has(text, 'Feasibility report')).toBe(true);
    expect(has(text, 'Last reviewed:')).toBe(true);
    expect(has(text, 'not investment advice')).toBe(true);
  });

  it('veri güveni düşükse ön değerlendirme etiketi var', () => {
    expect(build(coffee(), NONE).verdict.preliminary).toBe('Ön değerlendirme');
    const d = coffee();
    d.sources = { rent: 'user', staff: 'user', price: 'user', base: 'user', cost: 'user' };
    expect(build(d, NONE).verdict.preliminary).toBeUndefined();
  });

  it('dosya adı Türkçe karakter içermez', () => {
    expect(reportFilename(coffee())).toBe('bu-is-tutar-mi-kadikoy-moda.pdf');
  });
});
