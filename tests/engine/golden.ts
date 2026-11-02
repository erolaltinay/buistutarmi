// Golden fixture yardımcıları: motor çıktısını fixture'ın `expected` yapısına indirger ve
// göreli / mutlak toleransla karşılaştırır (SPEC-calc-engine §14–15).
import { readFileSync } from 'node:fs';
import type { AnalysisInput, AnalysisResult, ProjectionRow } from '@bitm/engine';

export interface GoldenCase {
  id: string;
  input: AnalysisInput & { lang?: string; shop?: unknown };
  expected: Record<string, unknown>;
}

export interface GoldenFile {
  generatedFrom: string;
  tolerance: { relative: number; absolute: number };
  cases: GoldenCase[];
}

export const loadGolden = (): GoldenFile =>
  JSON.parse(readFileSync(new URL('../fixtures/golden-cases.json', import.meta.url), 'utf8')) as GoldenFile;

const row = (r: ProjectionRow | undefined) =>
  r && { units: r.units, gross: r.gross, ebitda: r.ebitda, netIncome: r.netIncome, cash: r.cash };

export function toGoldenShape(r: AnalysisResult) {
  const month = (m: number) => row(r.projection.rows[m - 1]);
  return {
    unit: { ticket: r.unit.ticket, ticketNet: r.unit.ticketNet, cm: r.unit.cm },
    fixed: { opFixed: r.fixed.opFixed, loan: r.fixed.loan, monthlyLoanPayment: r.fixed.monthlyLoanPayment },
    breakEven: { perDay: r.breakEven.perDay, perMonth: r.breakEven.perMonth },
    investment: {
      capexTotal: r.investment.capexTotal,
      cashTrough: r.investment.cashTrough,
      troughMonth: r.investment.troughMonth,
      cushion: r.investment.cushion,
      total: r.investment.total,
    },
    projection: {
      firstProfitMonth: r.projection.firstProfitMonth,
      sum24NetProfit: r.projection.sum24NetProfit,
      paybackTotalMonths: r.projection.paybackTotalMonths,
      paybackStartupMonths: r.projection.paybackStartupMonths,
      month1: month(1),
      month12: month(12),
      month24: month(24),
    },
    scenarios: r.scenarios,
    competition: {
      rivalsWithin1km: r.competition.rivalsWithin1km,
      peoplePerBusiness: r.competition.peoplePerBusiness,
      saturation: r.competition.saturation,
      priceAvg: r.competition.priceAvg,
      gaps: r.competition.gaps,
      stakes: r.competition.stakes,
    },
    demandFit: { score: r.demandFit.score, level: r.demandFit.level, incomeIndex: r.demandFit.incomeIndex },
    location: {
      score: r.location.score,
      dailyPassersby: r.location.dailyPassersby,
      captureNeededPct: r.location.captureNeededPct,
      rentToSalesPct: r.location.rentToSalesPct,
      foot: r.location.foot,
      rent: r.location.rentStatus,
      history: r.location.history,
      founder: r.location.founder,
      checklist: r.location.checklist,
      redFlagCount: r.location.redFlagCount,
      blocker: r.location.blocker,
    },
    pricing: {
      recommended: r.pricing.recommended,
      reason: r.pricing.reason,
      cards: r.pricing.cards.map((c) => ({
        k: c.k,
        price: c.price,
        cm: c.cm,
        bePerDay: c.bePerDay,
        baseNet: c.baseNet,
      })),
    },
    verdict: r.verdict,
  };
}

/** Beklenen ağaçtaki her yaprağı gerçek değerle karşılaştırır; uyuşmayanların listesini döner. */
export function diffAgainstExpected(
  expected: unknown,
  actual: unknown,
  tol: { relative: number; absolute: number },
  path = '',
): string[] {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || !Number.isFinite(actual))
      return [`${path}: beklenen ${expected}, gelen ${String(actual)}`];
    const allowed = Math.max(tol.absolute, tol.relative * Math.abs(expected));
    return Math.abs(actual - expected) <= allowed ? [] : [`${path}: beklenen ${expected}, gelen ${actual}`];
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      return [`${path}: beklenen ${JSON.stringify(expected)}, gelen ${JSON.stringify(actual)}`];
    return expected.flatMap((e, i) => diffAgainstExpected(e, actual[i], tol, `${path}[${i}]`));
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object')
      return [`${path}: nesne bekleniyordu, gelen ${String(actual)}`];
    return Object.entries(expected).flatMap(([k, e]) =>
      diffAgainstExpected(e, (actual as Record<string, unknown>)[k], tol, path ? `${path}.${k}` : k),
    );
  }
  return expected === actual
    ? []
    : [`${path}: beklenen ${JSON.stringify(expected)}, gelen ${JSON.stringify(actual)}`];
}
