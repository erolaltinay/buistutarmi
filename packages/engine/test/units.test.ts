import { describe, expect, it } from 'vitest';
import {
  annuity,
  evaluateExpr,
  ExprError,
  parseExpr,
  roundPrice,
  unitEconomics,
  type FinParams,
} from '../src';

const fin = (over: Partial<FinParams> = {}): FinParams => ({
  rampStart: 50,
  rampMonths: 6,
  priceInc: 0,
  inflCost: 0,
  rentInc: 0,
  wageInc: 0,
  ownerSalary: 0,
  kdv: 10,
  cardShare: 80,
  cardFee: 2.5,
  platShare: 10,
  platFee: 25,
  waste: 5,
  stopaj: 20,
  employer: 20,
  profitTax: 25,
  loanRate: 45,
  loanTerm: 36,
  depYears: 5,
  ...over,
});

describe('annuity', () => {
  it('anapara 0 veya negatifse taksit 0', () => {
    expect(annuity(0, 0.01, 12)).toBe(0);
    expect(annuity(-100, 0.01, 12)).toBe(0);
    expect(annuity(Number.NaN, 0.01, 12)).toBe(0);
  });
  it('faiz 0 ise eşit taksit', () => {
    expect(annuity(1200, 0, 12)).toBe(100);
  });
  it('tek dönemde anapara + faiz', () => {
    expect(annuity(1000, 0.05, 1)).toBeCloseTo(1050, 10);
  });
  it('standart annüite formülü', () => {
    const r = 0.1 / 12;
    expect(annuity(10000, r, 60)).toBeCloseTo((10000 * r) / (1 - Math.pow(1 + r, -60)), 10);
  });
});

describe('unitEconomics', () => {
  it('satış payı toplamı 0 ise tüm sonuçlar 0', () => {
    const u = unitEconomics([{ price: 100, cost: 30, mix: 0 }], fin());
    expect(u).toMatchObject({ mixSum: 0, ticket: 0, ticketNet: 0, costAvg: 0, cm: 0 });
  });
  it('katkı payı: KDV hariç fiyat − fireli maliyet − KDV dahil tutar üzerinden komisyon', () => {
    const u = unitEconomics([{ price: 110, cost: 40, mix: 1 }], fin());
    const feeRate = 0.8 * 0.025 + 0.1 * 0.25;
    expect(u.ticketNet).toBeCloseTo(100, 10);
    expect(u.cm).toBeCloseTo(100 - 40 * 1.05 - 110 * feeRate, 10);
  });
  it('maliyet fiyatı aşınca katkı payı negatif', () => {
    expect(unitEconomics([{ price: 50, cost: 80, mix: 1 }], fin()).cm).toBeLessThan(0);
  });
  it('satış payları ağırlık olarak normalize edilir', () => {
    const a = unitEconomics(
      [
        { price: 100, cost: 10, mix: 1 },
        { price: 200, cost: 20, mix: 3 },
      ],
      fin(),
    );
    const b = unitEconomics(
      [
        { price: 100, cost: 10, mix: 25 },
        { price: 200, cost: 20, mix: 75 },
      ],
      fin(),
    );
    expect(a.ticket).toBeCloseTo(175, 10);
    expect(b.cm).toBeCloseTo(a.cm, 10);
  });
});

describe('roundPrice', () => {
  it('TRY adımı 5, en az 5', () => {
    expect(roundPrice(117, 5)).toBe(115);
    expect(roundPrice(118, 5)).toBe(120);
    expect(roundPrice(1, 5)).toBe(5);
  });
  it('USD/EUR adımı 0,25, en az 0,25', () => {
    expect(roundPrice(42.75, 0.25)).toBe(42.75);
    expect(roundPrice(4.6, 0.25)).toBe(4.5);
    expect(roundPrice(0.01, 0.25)).toBe(0.25);
  });
});

describe('talep uyumu ifadeleri', () => {
  const scope = { a1: 30, a2: 32, a3: 25, idx: null, dayR: 0.32, pop: 25000, hh: 2.3 };
  it('null karşılaştırması ve üçlü koşul', () => {
    expect(evaluateExpr('idx==null ? 0.5 : clamp((idx-70)/60)', scope)).toBe(0.5);
    expect(evaluateExpr('idx==null ? 0.5 : clamp((idx-70)/60)', { ...scope, idx: 100 })).toBe(0.5);
    expect(evaluateExpr('idx==null ? 0.5 : clamp((idx-70)/60)', { ...scope, idx: 160 })).toBe(1);
  });
  it('işlem önceliği, tekli eksi ve clamp', () => {
    expect(evaluateExpr('a1+a2*2', scope)).toBe(94);
    expect(evaluateExpr('-(a1-40)/10', scope)).toBe(1);
    expect(evaluateExpr('clamp(pop/15000)', scope)).toBe(1);
  });
  it('beyaz liste dışını reddeder (eval yok)', () => {
    expect(() => parseExpr('process.exit(1)')).toThrow(ExprError);
    expect(() => parseExpr('Math.random()')).toThrow(ExprError);
    expect(() => parseExpr('a1; a2')).toThrow(ExprError);
    expect(() => parseExpr('constructor')).toThrow(ExprError);
    expect(() => parseExpr('clamp(a1')).toThrow(ExprError);
  });
  it('null ile aritmetik hatadır', () => {
    expect(() => evaluateExpr('idx+1', scope)).toThrow(ExprError);
  });
});
