// İP-2.7 kabul: SPEC-calc-engine §5.1. Beklenen değerler motordan bağımsız `scripts/golden-preopen.py`'den gelir.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze, type AnalysisInput } from '@bitm/engine';
import { engineArchetype, engineCountry, sampleCountry } from '@bitm/archetypes';
import { diffAgainstExpected, loadGolden, toGoldenShape, type GoldenFile } from './golden';

const preopen = JSON.parse(
  readFileSync(new URL('../fixtures/golden-preopen.json', import.meta.url), 'utf8'),
) as GoldenFile;
const base = loadGolden();

const analyzeInput = (input: AnalysisInput) =>
  analyze(input, engineArchetype(input.biz), engineCountry(sampleCountry(input.biz, input.city)));

const withMonths = (input: AnalysisInput, preOpenMonths: AnalysisInput['preOpenMonths']) => ({
  ...input,
  preOpenMonths,
});

const baseInput = (id: string) => {
  const found = base.cases.find((c) => c.id === id);
  if (!found) throw new Error(`vaka yok: ${id}`);
  return found.input;
};

describe('golden-preopen.json', () => {
  it('en az 4 vaka içerir, hepsinde bekleme var', () => {
    expect(preopen.cases.length).toBeGreaterThanOrEqual(4);
    for (const c of preopen.cases) expect(c.input.preOpenMonths).toBeGreaterThan(0);
  });

  describe.each(preopen.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    it('bağımsız hesapla aynı sonucu üretir', () => {
      const r = analyzeInput(c.input);
      const shape = {
        ...toGoldenShape(r),
        investment: { ...toGoldenShape(r).investment, preOpen: r.investment.preOpen },
      };
      expect(diffAgainstExpected(c.expected, shape, preopen.tolerance)).toEqual([]);
    });
  });
});

describe('preOpenMonths', () => {
  const coffee = () => baseInput('coffee-ist-default');

  it('0 veya yokken 30 vakanın hepsi aynı sonucu verir', () => {
    for (const c of base.cases) {
      const without = analyzeInput(c.input);
      expect(analyzeInput(withMonths(c.input, 0))).toEqual(without);
      expect(analyzeInput(withMonths(c.input, null))).toEqual(without);
      expect(without.investment.preOpen).toEqual({ months: 0, monthlyCost: 0, interest: 0, total: 0 });
    }
  });

  it('nakit açığı ve toplam yatırım süreyle artar', () => {
    for (const c of base.cases) {
      let last = analyzeInput(c.input);
      for (const months of [1, 2, 3, 6]) {
        const r = analyzeInput(withMonths(c.input, months));
        expect(r.investment.cashTrough, `${c.id} ${months}`).toBeGreaterThan(last.investment.cashTrough);
        expect(r.investment.total, `${c.id} ${months}`).toBeGreaterThan(last.investment.total);
        last = r;
      }
    }
  });

  it('satırlar açılıştan sayılır, 60 satır kalır', () => {
    const r = analyzeInput(withMonths(coffee(), 3));
    expect(r.projection.rows).toHaveLength(60);
    expect(r.projection.rows[0]!.m).toBe(1);
    expect(r.projection.rows[0]!.units).toBe(analyzeInput(coffee()).projection.rows[0]!.units);
  });

  it('personel ödenmez; kira tam, diğer sabitlerin %30u', () => {
    const r = analyzeInput(withMonths(coffee(), 2));
    expect(r.investment.preOpen.months).toBe(2);
    expect(r.investment.preOpen.monthlyCost).toBeCloseTo(r.fixed.rent0 + r.fixed.other0 * 0.3);
    expect(r.investment.preOpen.monthlyCost).toBeLessThan(r.fixed.opFixed);
  });

  it('kredi yoksa faiz yok; kredi varsa bekleme faizi işler', () => {
    const noLoan = analyzeInput(withMonths(baseInput('coffee-ist-all_equity'), 3));
    expect(noLoan.fixed.loan).toBe(0);
    expect(noLoan.investment.preOpen.interest).toBe(0);
    expect(noLoan.investment.preOpen.total).toBeCloseTo(3 * noLoan.investment.preOpen.monthlyCost);
    const loaned = analyzeInput(withMonths(coffee(), 3));
    expect(loaned.fixed.loan).toBeGreaterThan(0);
    expect(loaned.investment.preOpen.interest).toBeGreaterThan(0);
  });

  it('geri ödeme ayları yatırımın çıktığı günden sayılır', () => {
    const r0 = analyzeInput(coffee());
    const r3 = analyzeInput(withMonths(coffee(), 3));
    expect(r0.projection.paybackTotalMonths).not.toBeNull();
    expect(r3.projection.paybackTotalMonths!).toBeGreaterThanOrEqual(r0.projection.paybackTotalMonths! + 3);
    expect(r3.projection.firstProfitMonth).not.toBeNull();
  });

  it('en dip nokta açılıştan önceyse ay 0 döner, açık yine sayılır', () => {
    const r = analyzeInput(withMonths(baseInput('coffee-ist-strong_open'), 2));
    expect(r.investment.troughMonth).toBe(0);
    expect(r.investment.cashTrough).toBeGreaterThan(0);
  });

  it('küsurat yuvarlanır, negatif 0 sayılır, üst sınır 24', () => {
    const months = (v: number) => analyzeInput(withMonths(coffee(), v)).investment.preOpen.months;
    expect(months(2.4)).toBe(2);
    expect(months(2.6)).toBe(3);
    expect(months(-3)).toBe(0);
    expect(months(100)).toBe(24);
    expect(months(Number.NaN)).toBe(0);
  });

  it('uzun bekleme kararı kötüleştirebilir, iyileştiremez', () => {
    const order = { NO: 0, MID: 1, GO: 2 } as const;
    for (const c of base.cases) {
      const before = order[analyzeInput(c.input).verdict];
      const after = order[analyzeInput(withMonths(c.input, 6)).verdict];
      expect(after, c.id).toBeLessThanOrEqual(before);
    }
  });
});
