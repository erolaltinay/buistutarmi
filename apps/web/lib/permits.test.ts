import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LegalItem } from '@bitm/archetypes';
import {
  criticalPath,
  hasLegalList,
  isStale,
  legalItems,
  oldestReview,
  openCritical,
  permitStatus,
  setPermit,
  type Permits,
} from './permits';
import { projectFromSample } from './project';

const item = (id: string, days: [number, number] | null, extra: Partial<LegalItem> = {}): LegalItem =>
  ({
    id,
    title: { tr: id, en: id },
    what: { tr: '', en: '' },
    authority: { tr: '', en: '' },
    sourceUrl: 'https://example.org',
    appliesTo: { sectors: 'all', condition: 'always' },
    stage: 'before_opening',
    critical: false,
    typicalDays: days,
    typicalCost: null,
    dependsOn: [],
    verification: { status: 'verified', lastReviewed: '2026-01-01' },
    ...extra,
  }) as LegalItem;

const done = (...ids: string[]): Permits =>
  Object.fromEntries(ids.map((id) => [id, { status: 'done', updatedAt: 't' }]));

describe('mevzuat listesi', () => {
  it('TR kahve ve TR berber kendi maddelerini alır', () => {
    const coffee = legalItems(projectFromSample('coffee', 'ist', 'p'), false).map((i) => i.id);
    const barber = legalItems(projectFromSample('barber', 'ist', 'p'), false).map((i) => i.id);
    expect(coffee).toContain('tr.common.tax_registration');
    expect(coffee).toContain('tr.coffee.food_business_registration');
    expect(coffee).not.toContain('tr.barber.mastery_certificate');
    expect(barber).toContain('tr.barber.mastery_certificate');
    expect(barber).not.toContain('tr.coffee.food_business_registration');
  });

  it('örneğin şehri bölge maddelerini ekler', () => {
    const ids = legalItems(projectFromSample('barber', 'nyc', 'p'), false).map((i) => i.id);
    expect(ids).toContain('us.common.ein');
    expect(ids).toContain('us.nyc.barber_license');
    expect(ids).not.toContain('us.tx.barber_license');
  });

  it('desteklenmeyen ülkede liste yok', () => {
    const d = { ...projectFromSample('coffee', 'ist', 'p'), country: 'GENERIC' };
    expect(hasLegalList(d)).toBe(false);
    expect(legalItems(d, false)).toEqual([]);
  });

  it('yayın derlemesinde taslak madde gösterilmez', () => {
    const d = projectFromSample('coffee', 'ist', 'p');
    expect(legalItems(d, false).length).toBeGreaterThan(0);
    expect(legalItems(d, true)).toEqual([]);
  });

  it('kesin hukuki ifade yok: mevzuat metinleri ve madde içeriği', () => {
    const banned =
      /uygunsunuz|bu belgeler yeterli|ruhsat çıkar|you are compliant|these documents are enough/i;
    for (const locale of ['tr', 'en']) {
      const m = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
      expect(JSON.stringify(m.legal)).not.toMatch(banned);
    }
    for (const [s, sample] of [
      ['coffee', 'ist'],
      ['barber', 'ist'],
    ] as const)
      expect(JSON.stringify(legalItems(projectFromSample(s, sample, 'p'), false))).not.toMatch(banned);
  });
});

describe('durumlar', () => {
  it('işaretlenmeyen madde bilinmiyor; "bilmiyorum"a dönen kayıttan düşer', () => {
    const d = projectFromSample('coffee', 'ist', 'p');
    expect(permitStatus(d.permits, 'x')).toBe('unknown');
    setPermit(d, 'x', 'applied', 't1');
    expect(d.permits?.x).toEqual({ status: 'applied', updatedAt: 't1' });
    setPermit(d, 'x', 'unknown', 't2');
    expect(d.permits).toEqual({});
  });

  it('kritik sayımında başvuru tamamlanmış sayılmaz; aldım ve uygulanmaz sayılmaz', () => {
    const items = [
      item('a', null, { critical: true }),
      item('b', null, { critical: true }),
      item('c', null, { critical: true }),
      item('d', null),
    ];
    const permits: Permits = {
      a: { status: 'done', updatedAt: 't' },
      b: { status: 'na', updatedAt: 't' },
      c: { status: 'applied', updatedAt: 't' },
    };
    expect(openCritical(items, permits).map((i) => i.id)).toEqual(['c']);
    expect(openCritical(items, undefined).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('kritik yol', () => {
  it('bağımlılık zincirinin en uzunu alınır, paralel maddeler toplanmaz', () => {
    const items = [
      item('a', [5, 10]),
      item('b', [2, 3], { dependsOn: ['a'] }),
      item('c', [1, 20]),
      item('d', [4, 4], { dependsOn: ['b'] }),
    ];
    // a→b→d: 11–17; c: 1–20. Alt ve üst sınır ayrı ayrı en uzundur.
    expect(criticalPath(items, undefined)).toEqual({ min: 11, max: 20, unknownDays: 0, pending: 4 });
  });

  it('tamamlanan madde süre eklemez ama zinciri kesmez', () => {
    const items = [item('a', [5, 10]), item('b', [2, 3], { dependsOn: ['a'] })];
    expect(criticalPath(items, done('a'))).toMatchObject({ min: 2, max: 3, pending: 1 });
    expect(criticalPath(items, done('a', 'b'))).toMatchObject({ min: 0, max: 0, pending: 0 });
  });

  it('açılıştan sonraki madde açılışı bekletmez', () => {
    const items = [item('a', [1, 2]), item('b', [30, 40], { stage: 'after_opening' })];
    expect(criticalPath(items, undefined)).toMatchObject({ min: 1, max: 2, pending: 1 });
  });

  it('süresi bilinmeyen madde sayılır, tahmin edilmez', () => {
    const items = [item('a', null), item('b', [3, 4], { dependsOn: ['a'] }), item('c', null)];
    expect(criticalPath(items, undefined)).toEqual({ min: 3, max: 4, unknownDays: 2, pending: 3 });
  });

  it('bugünkü taslak listede süre yok: toplam 0, hepsi bilinmiyor', () => {
    const items = legalItems(projectFromSample('coffee', 'ist', 'p'), false);
    const path = criticalPath(items, undefined);
    expect(path).toMatchObject({ min: 0, max: 0 });
    expect(path.unknownDays).toBe(path.pending);
    expect(path.pending).toBeGreaterThan(0);
  });

  it('döngülü veri kilitlemez', () => {
    const items = [item('a', [1, 1], { dependsOn: ['b'] }), item('b', [1, 1], { dependsOn: ['a'] })];
    expect(() => criticalPath(items, undefined)).not.toThrow();
  });
});

describe('kontrol tarihi', () => {
  it('en eski tarih ve 12 ay kuralı', () => {
    const old = item('a', null, { verification: { status: 'verified', lastReviewed: '2025-01-01' } });
    expect(oldestReview([item('b', null), old])).toBe('2025-01-01');
    expect(oldestReview([])).toBeNull();
    expect(isStale(old, new Date('2026-11-04'))).toBe(true);
    expect(isStale(item('b', null), new Date('2026-11-04'))).toBe(false);
  });
});
