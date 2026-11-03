import { describe, expect, it } from 'vitest';
import {
  checkLegal,
  checkPriceFloors,
  legalFiles,
  mergeLegal,
  sectors,
  type LegalFile,
  type LegalItem,
  type Sector,
} from '../src';

const base = { today: '2026-11-02', fullCountries: ['TR', 'US'], sectors: Object.keys(sectors) };

const item = (over: Partial<LegalItem> & { id: string }): LegalItem => ({
  title: { tr: 'Madde', en: 'Item' },
  what: { tr: 'Açıklama', en: 'Description' },
  authority: { tr: 'Kurum', en: 'Authority' },
  sourceUrl: 'https://example.gov/x',
  appliesTo: { sectors: 'all', condition: 'always' },
  stage: 'before_opening',
  critical: true,
  typicalDays: [1, 5],
  typicalCost: null,
  dependsOn: [],
  verification: { status: 'verified', reviewedBy: 'resmi site', lastReviewed: '2026-10-01' },
  ...over,
});
const file = (country: string, scope: string, items: LegalItem[], region?: string): LegalFile => ({
  country,
  scope,
  items,
  ...(region ? { region } : {}),
});
const rules = (issues: ReturnType<typeof checkLegal>, level: 'error' | 'warning') =>
  issues.filter((i) => i.level === level).map((i) => i.rule);

describe('paketteki mevzuat dosyaları', () => {
  it('hepsi şemadan geçer ve taslaktır', () => {
    const items = Object.values(legalFiles).flatMap((f) => f.items);
    expect(items.length).toBe(25);
    expect(items.every((i) => i.verification.status === 'draft')).toBe(true);
  });

  it('production modunda taslak madde varken build kırmızı (SPEC-legal §4.1)', () => {
    const issues = checkLegal({ ...base, production: true });
    expect(rules(issues, 'error')).toContain('no-draft-in-production');
    expect(rules(issues, 'error')).toContain('source-url');
  });

  it('önizleme modunda taslaklar uyarıdır, yapısal hata yok', () => {
    const issues = checkLegal({ ...base, production: false });
    expect(rules(issues, 'error')).toEqual([]);
    expect(rules(issues, 'warning')).toContain('no-draft-in-production');
  });

  it('birleştirme: TR kahve = ortak + kahve maddeleri; NYC berber bölge maddesini alır', () => {
    const trCoffee = mergeLegal('TR', 'coffee').map((i) => i.id);
    expect(trCoffee).toContain('tr.common.workplace_license');
    expect(trCoffee).toContain('tr.coffee.food_business_registration');
    expect(trCoffee).not.toContain('tr.barber.mastery_certificate');
    const nycBarber = mergeLegal('US', 'barber', 'US-NY-NYC').map((i) => i.id);
    expect(nycBarber).toContain('us.nyc.barber_license');
    expect(nycBarber).not.toContain('us.nyc.food_service_permit');
  });
});

describe('kurallar (sentetik dosyalarla)', () => {
  const opts = { today: '2026-11-02', fullCountries: ['XX'], sectors: ['coffee'], production: true };

  it('doğrulanmış ve kaynaklı maddeler production’da geçer', () => {
    const files = { a: file('XX', 'common', [item({ id: 'xx.common.a' })]) };
    expect(checkLegal({ ...opts, files })).toEqual([]);
  });

  it('dependsOn döngüsü ve bilinmeyen bağımlılık hatadır (§4.4)', () => {
    const files = {
      a: file('XX', 'common', [
        item({ id: 'xx.common.a', dependsOn: ['xx.common.b'] }),
        item({ id: 'xx.common.b', dependsOn: ['xx.common.a'] }),
        item({ id: 'xx.common.c', dependsOn: ['xx.common.nope'] }),
      ]),
    };
    const errs = rules(checkLegal({ ...opts, files }), 'error');
    expect(errs).toContain('no-cycle');
    expect(errs).toContain('depends-on');
  });

  it('ülke × sektörde kritik madde yoksa hatadır (§4.5)', () => {
    const files = { a: file('XX', 'common', [item({ id: 'xx.common.a', critical: false })]) };
    expect(rules(checkLegal({ ...opts, files }), 'error')).toContain('critical-item');
  });

  it('6 ve 12 aydan eski kontrol uyarı verir (§4.3)', () => {
    const files = {
      a: file('XX', 'common', [
        item({
          id: 'xx.common.a',
          verification: { status: 'verified', reviewedBy: 'x', lastReviewed: '2026-03-01' },
        }),
        item({
          id: 'xx.common.b',
          verification: { status: 'verified', reviewedBy: 'x', lastReviewed: '2025-10-01' },
        }),
      ]),
    };
    const warns = rules(checkLegal({ ...opts, files }), 'warning');
    expect(warns).toEqual(expect.arrayContaining(['stale-6m', 'stale-12m']));
  });

  it('doğrulanmış maddede reviewedBy zorunlu', () => {
    const files = {
      a: file('XX', 'common', [
        item({ id: 'xx.common.a', verification: { status: 'verified', lastReviewed: '2026-10-01' } }),
      ]),
    };
    expect(rules(checkLegal({ ...opts, files }), 'error')).toContain('reviewed-by');
  });

  it('bölge maddesi aynı id ile geçersiz kılar, removed ile kaldırır', () => {
    const files = {
      a: file('XX', 'common', [item({ id: 'xx.common.a' }), item({ id: 'xx.common.b' })]),
      r: file(
        'XX',
        'region',
        [item({ id: 'xx.common.a', stage: 'after_opening' }), item({ id: 'xx.common.b', removed: true })],
        'XX-R',
      ),
    };
    const merged = mergeLegal('XX', 'coffee', 'XX-R', files);
    expect(merged.map((i) => [i.id, i.stage])).toEqual([['xx.common.a', 'after_opening']]);
  });
});

describe('taban fiyatlar mevzuat gibi denetlenir (SPEC-archetypes §2.1)', () => {
  const withFloors = (floors: Partial<NonNullable<Sector['defaults'][string]['priceFloors']>>) => {
    const s = structuredClone(sectors.barber!);
    s.defaults.TR!.priceFloors = {
      sourceUrl: 'https://example.org/tarife',
      lastReviewed: '2026-10-01',
      reviewedBy: 'meslek odası tarifesi',
      items: { [s.itemTemplate[0]!.k]: 100 },
      ...floors,
    };
    return { barber: s };
  };
  const check = (production: boolean, set: Record<string, Sector>) =>
    checkPriceFloors(set, { production, today: '2026-11-02' });

  it('paketteki sektörlerde taban fiyat yok, sorun yok', () => {
    expect(check(true, sectors)).toEqual([]);
  });

  it("kaynaksız taban production build'i kırmızı yapar, önizlemede uyarıdır", () => {
    const set = withFloors({ sourceUrl: '' });
    expect(rules(check(true, set), 'error')).toContain('price-floor-source');
    expect(rules(check(false, set), 'error')).toEqual([]);
    expect(rules(check(false, set), 'warning')).toContain('price-floor-source');
  });

  it("doğrulayanı yazılmamış taban production'da hatadır", () => {
    const set = withFloors({ reviewedBy: undefined });
    expect(rules(check(true, set), 'error')).toContain('price-floor-reviewed-by');
  });

  it('kaynaklı ve doğrulanmış taban geçer; 12 aydan eskiyse uyarı', () => {
    expect(check(true, withFloors({}))).toEqual([]);
    const stale = check(true, withFloors({ lastReviewed: '2025-10-01' }));
    expect(rules(stale, 'error')).toEqual([]);
    expect(rules(stale, 'warning')).toContain('price-floor-stale-12m');
  });
});
