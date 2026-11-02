// SPEC-calc-engine §15 ek birim testleri + determinizm.
import { describe, expect, it } from 'vitest';
import { analyze, type AnalysisInput } from '@bitm/engine';
import { buildSampleInput, engineArchetype, engineCountry } from '@bitm/archetypes';

const run = (input: AnalysisInput, country = 'TR') =>
  analyze(input, engineArchetype(input.biz), engineCountry(country));

const coffee = () => buildSampleInput('coffee', 'ist');
const barber = () => buildSampleInput('barber', 'nyc');

describe('§15 uç durumlar', () => {
  it('satış payı toplamı 0: birim sonuçları 0, karar TUTMAZ', () => {
    const input = coffee();
    input.items = input.items.map((r) => ({ ...r, mix: 0 }));
    const r = run(input);
    expect(r.unit).toMatchObject({ ticket: 0, ticketNet: 0, costAvg: 0, cm: 0 });
    expect(r.breakEven.perDay).toBeNull();
    expect(r.financial.reason.code).toBe('negativeMargin');
    expect(r.verdict).toBe('NO');
  });

  it('cm ≤ 0: başabaş ∞ (null), finansal karar TUTMAZ', () => {
    const input = coffee();
    input.items = input.items.map((r) => ({ ...r, cost: Number(r.price) * 2 }));
    const r = run(input);
    expect(r.unit.cm).toBeLessThanOrEqual(0);
    expect(r.breakEven.perDay).toBeNull();
    expect(r.breakEven.perMonth).toBeNull();
    expect(r.breakEven.sensitivity).toEqual([null, null, null]);
    expect(r.financial).toMatchObject({ verdict: 'NO', reason: { code: 'negativeMargin' } });
  });

  it('kapasite aşımı: başabaş günlük kapasiteyi geçerse TUTMAZ', () => {
    const input = barber();
    input.cap = [1, 4, 60]; // günde en fazla 4 müşteri
    const r = run(input, 'US');
    expect(r.breakEven.maxDaily).toBe(4);
    expect(r.financial.verdict).toBe('NO');
    expect(r.financial.reason.code).toBe('capacity');
  });

  it('ürün arketipinde kapasite uygulanmaz', () => {
    const input = coffee();
    input.cap = [1, 1, 60];
    expect(run(input).breakEven.maxDaily).toBeNull();
  });

  it('sayım yokken: yaya bloğu puana girmez, teyit listesinde "say" var', () => {
    const input = coffee();
    input.loc.foot = { wd: [0, 0, 0], we: [0, 0, 0] };
    const r = run(input);
    expect(r.location.hasFootCount).toBe(false);
    expect(r.location.dailyPassersby).toBe(0);
    expect(r.location.captureNeededPct).toBeNull();
    expect(r.location.foot).toBeNull();
    const blocks = [r.location.rentStatus, r.location.history, r.location.founder, r.location.checklist];
    const points = { good: 100, mid: 60, bad: 20 } as const;
    const expected = blocks.reduce((a, s) => a + points[s!], 0) / blocks.length;
    expect(r.location.score).toBeCloseTo(expected, 10);
    expect(r.location.confirm).toContainEqual({ kind: 'footCount' });
  });

  it('öz sermaye %100 iken kredi ve taksit 0', () => {
    const input = coffee();
    input.loc.founder.equity = 100;
    const r = run(input);
    expect(r.fixed.loan).toBe(0);
    expect(r.fixed.monthlyLoanPayment).toBe(0);
    expect(r.projection.rows.every((row) => row.interest === 0 && row.principal === 0)).toBe(true);
  });

  it('ruhsat yoksa (engel) finansal karar ne olursa olsun TUTMAZ', () => {
    const input = coffee();
    input.loc.chk = { ...input.loc.chk, permitOk: 0 };
    const r = run(input);
    expect(r.location.blocker).toBe(true);
    expect(r.verdict).toBe('NO');
    expect(r.verdictReason.code).toBe('permitBlocked');
  });

  it('nüfus 0: işletme başına kişi ve doygunluk yok', () => {
    const input = coffee();
    input.pop = 0;
    const r = run(input);
    expect(r.competition.peoplePerBusiness).toBeNull();
    expect(r.competition.saturation).toBeNull();
  });

  it('seçim alanları hiçbir sonucu değiştirmez (CLAUDE.md kural 5)', () => {
    const a = coffee();
    const b = coffee();
    b.demo = { ...b.demo, turnout: 91, elec: 'herhangi bir metin' };
    expect(run(b)).toEqual(run(a));
  });

  it('açık satır tipi, anahtar tahmininin önüne geçer', () => {
    const input = coffee();
    const base = run(input);
    input.fixed = input.fixed.map((r) => (r.k === 'otherFixed' ? { ...r, type: 'rent' as const } : r));
    const r = run(input);
    expect(r.fixed.rent0).toBeGreaterThan(base.fixed.rent0);
    expect(r.location.rent).toBeCloseTo(r.fixed.rent0, 10);
  });
});

describe('determinizm', () => {
  it('aynı girdi her çalıştırmada aynı çıktıyı verir ve girdiyi değiştirmez', () => {
    const input = barber();
    const snapshot = structuredClone(input);
    const a = run(input, 'US');
    const b = run(input, 'US');
    expect(b).toEqual(a);
    expect(input).toEqual(snapshot);
  });
});
