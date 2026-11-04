// İP-1.9 kabul: genel modda uygulama çalışır, hiçbir TR/US varsayılanı sızmaz.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { analyze } from '@bitm/engine';
import {
  buildBlankInput,
  buildSampleInput,
  countries,
  engineArchetype,
  engineCountry,
} from '@bitm/archetypes';
import { renderReport } from '@bitm/pdf';
import { pdfText } from '@bitm/pdf/test-utils';
import { currencyOptions, isGeneric, messagesFor, otherCountries, withGenericTerms } from './generic';
import { incompleteFields } from './incomplete';
import { blankProject, projectFromSample, resetProject } from './project';
import { applyQuick, isAnswered, quickCurrency } from './quick';
import { buildReport } from './report';
import type { Translate } from './verdict-text';

const messages = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
const fontDir = fileURLToPath(new URL('../../../packages/pdf/fonts', import.meta.url));

/** Girdide veya sonuçta sayı olmayan/sonsuz değer var mı. */
function badNumbers(o: unknown, path = ''): string[] {
  if (typeof o === 'number') return Number.isFinite(o) ? [] : [path];
  if (Array.isArray(o)) return o.flatMap((v, i) => badNumbers(v, `${path}[${i}]`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => badNumbers(v, `${path}.${k}`));
  return [];
}

describe('boş girdi', () => {
  for (const sector of ['coffee', 'barber']) {
    it(`${sector}: motor boş girdiyle hata vermez, sonsuz değer üretmez`, () => {
      const input = buildBlankInput(sector, 'FR', 'EUR');
      const r = analyze(input, engineArchetype(sector), engineCountry('FR', 'EUR'));
      expect(badNumbers(r)).toEqual([]);
    });

    it(`${sector}: örnek ve ülke değeri sızmaz`, () => {
      const blank = buildBlankInput(sector, 'FR', 'EUR');
      expect(blank.cur).toBe('EUR');
      expect(blank.area).toBe('');
      expect(blank.pop).toBeNull();
      expect(blank.comp).toEqual([]);
      expect(blank.scen).toEqual([0, 0, 0]);
      expect(blank.loc.chk).toEqual({});
      expect(blank.capex.every((r) => r.v === null)).toBe(true);
      expect(blank.fixed.every((r) => r.v === null)).toBe(true);
      expect(blank.items.every((r) => r.price === null && r.cost === null && !r.minPrice)).toBe(true);
      expect(blank.items.reduce((a, r) => a + Number(r.mix), 0)).toBe(100);
      // Vergi, komisyon, artış ve faiz boş; yöntem varsayılanları kalır.
      for (const k of [
        'kdv',
        'stopaj',
        'employer',
        'profitTax',
        'cardFee',
        'platFee',
        'loanRate',
        'priceInc',
      ] as const)
        expect(blank.fin[k]).toBeNull();
      expect(blank.fin.rampMonths).toBe(6);
    });
  }

  it('eksik veri: boş girdi karar vermez, doldurulunca verir', () => {
    const coffee = buildBlankInput('coffee', 'FR', 'EUR');
    expect(incompleteFields(coffee)).toEqual(['price', 'base']);
    expect(incompleteFields(buildBlankInput('barber', 'FR', 'EUR'))).toEqual(['price', 'base']);
    coffee.items[0]!.price = 4;
    coffee.scen = [50, 80, 110];
    expect(incompleteFields(coffee)).toEqual([]);
    expect(incompleteFields(buildSampleInput('coffee', 'ist'))).toEqual([]);
    expect(incompleteFields(buildSampleInput('barber', 'nyc'))).toEqual([]);
    expect(incompleteFields({ ...coffee, days: null })).toEqual(['days']);
    expect(incompleteFields({ ...coffee, cap: [0, 8, 30] })).toEqual(['cap']);
  });
});

describe('ülke ve para birimi listesi', () => {
  it('kendi dosyası olan ülkeler listede yok; Fransa var ve çevrilmiş', () => {
    const tr = otherCountries('tr');
    expect(tr.find((c) => c.code === 'FR')?.name).toBe('Fransa');
    expect(otherCountries('en').find((c) => c.code === 'FR')?.name).toBe('France');
    for (const code of Object.keys(countries)) expect(tr.some((c) => c.code === code)).toBe(false);
    expect(tr.length).toBeGreaterThan(200);
    expect(isGeneric('FR')).toBe(true);
    expect(isGeneric('TR')).toBe(false);
    expect(isGeneric('US')).toBe(false);
  });

  it('güncel para birimleri listelenir, eskiler listelenmez', () => {
    const codes = currencyOptions('en').map((c) => c.code);
    for (const c of ['EUR', 'GBP', 'JPY', 'CHF']) expect(codes).toContain(c);
    expect(codes).not.toContain('DEM');
  });
});

describe('genel terimler', () => {
  it('iki dilde aynı geçersiz kılmalar; asıl yapıda karşılığı var', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
      );
    const tr = messages('tr');
    expect(keys(tr.genericTerms).sort()).toEqual(keys(messages('en').genericTerms).sort());
    const flat = new Set(keys(tr));
    for (const k of keys(tr.genericTerms)) expect(flat.has(k), k).toBe(true);
  });

  it('ülkeye özgü terim kalmaz', () => {
    const m = withGenericTerms(messages('tr'));
    // Anahtar adları (kdv, stopaj) değil, yalnız ekrana çıkan değerler aranır.
    const values = (o: object): string[] =>
      Object.values(o).flatMap((v) => (typeof v === 'object' ? values(v as object) : [String(v)]));
    const shown = values({
      finance: m.finance,
      result: m.result,
      location: m.location,
      report: m.report,
      hint: m.quick.hint,
    });
    expect(shown.filter((v) => /KDV|SGK|stopaj/i.test(v))).toEqual([]);
    // Tam desteklenen ülkede terimler değişmez.
    expect(messagesFor(messages('tr'), 'TR').finance.fin.kdv).toContain('KDV');
    expect(messagesFor(messages('tr'), 'FR').finance.fin.kdv).not.toContain('KDV');
  });
});

describe('hızlı mod', () => {
  const answers = {
    sector: 'coffee',
    country: 'FR',
    currency: 'EUR',
    area: 'Lyon',
    rent: 2000,
    staff: 3000,
    role: 'full' as const,
    price: 4,
    cost: 1,
    daily: 80,
    capex: 50000,
    equity: 60,
  };

  it('ülke adımı para birimi olmadan geçmez', () => {
    expect(isAnswered('country', { country: 'FR' })).toBe(false);
    expect(isAnswered('country', { country: 'FR', currency: 'EUR' })).toBe(true);
    expect(isAnswered('country', { country: 'TR' })).toBe(true);
    expect(quickCurrency({ country: 'TR' })).toBe('TRY');
    expect(quickCurrency({ country: 'FR', currency: 'EUR' })).toBe('EUR');
    expect(quickCurrency({ country: 'FR' })).toBeUndefined();
  });

  it('cevaplar boş girdiye yazılır, örnek rakam sızmaz', () => {
    const { input, sample, country } = applyQuick(answers, { staff: 'Personel' });
    expect(sample).toBe('');
    expect(country).toBe('FR');
    expect(input.cur).toBe('EUR');
    expect(input.area).toBe('Lyon');
    expect(input.fixed.filter((r) => r.v !== null).map((r) => r.v)).toEqual([2000, 3000]);
    expect(input.items[0]).toMatchObject({ price: 4, cost: 1, mix: 100 });
    expect(input.items.slice(1).every((r) => r.price === null && r.mix === 0)).toBe(true);
    expect(input.capex.filter((r) => r.v !== null).map((r) => r.v)).toEqual([50000]);
    expect(input.comp).toEqual([]);
    expect(input.scen).toEqual([80, 80, 80]);
    expect(input.fin.kdv).toBeNull();
    expect(incompleteFields(input)).toEqual([]);
  });
});

describe('proje', () => {
  it('boş proje temizlenince yine boş; aday korunur', () => {
    const d = blankProject('coffee', 'FR', 'EUR', 'p');
    expect(d.sample).toBe('');
    expect(d.shop.name).toBe('');
    d.input.area = 'Lyon';
    d.candidates = [{ id: 'c', name: 'A', savedAt: 't', input: d.input }];
    const fresh = resetProject(d);
    expect(fresh.input.area).toBe('');
    expect(fresh.input.cur).toBe('EUR');
    expect(fresh.country).toBe('FR');
    expect(fresh.candidates).toHaveLength(1);
  });

  it('örnekli proje örneğe döner', () => {
    const d = projectFromSample('coffee', 'ist', 'p');
    d.input.area = 'x';
    expect(resetProject(d).input.area).toBe('Kadıköy, Moda');
  });
});

describe('PDF', () => {
  const build = (locale: string) => {
    const doc = blankProject('coffee', 'FR', 'EUR', 'p');
    return buildReport({
      doc,
      locale,
      options: { monthly: true, cmp: true, shop: true },
      release: false,
      today: new Date('2026-11-04T12:00:00Z'),
      t: createTranslator({
        locale,
        messages: messagesFor(messages(locale), doc.country),
      }) as unknown as Translate,
    });
  };

  it('boş Fransa projesi: bilgi bandı, eksik veri, TR/US izi yok', async () => {
    const model = build('tr');
    expect(model.verdict.label).toBe('EKSİK VERİ');
    expect(model.verdict.preliminary).toBeUndefined();
    expect(model.tiles.map((x) => x.value)).toEqual(['—', '—', '—', '—', '—', '—']);
    const text = (await pdfText(await renderReport(model, { fontDir }))).join(' ');
    const flat = text.replace(/\s+/g, '');
    expect(flat).toContain('Buülkeiçinyerelverivemevzuatdesteğihenüzyok');
    expect(flat).toContain('mevzuatlistesisunmuyoruz');
    expect(text).toContain('€');
    expect(text).not.toMatch(/₺|\$|KDV|SGK|stopaj|Kadıköy|Moda|Gelir İdaresi/i);
  });

  it('İngilizce', async () => {
    const text = (await pdfText(await renderReport(build('en'), { fontDir }))).join(' ');
    expect(text.replace(/\s+/g, '')).toContain('Localdataandpermitguidance');
    expect(text).not.toMatch(/₺|\$|VAT|withholding|payroll tax/i);
  });
});
