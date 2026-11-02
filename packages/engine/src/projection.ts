// §5 60 aylık projeksiyon (baz senaryo)
import { clamp, n, pc } from './math';
import type { FinParams, MaybeNumber, ProjectionRow } from './types';

export const PROJECTION_MONTHS = 60;
/** Nakit açığı penceresi (§5): hiç kâra geçmeyen işin 60 aylık zararı işletme sermayesi sayılmaz. */
export const TROUGH_WINDOW_MONTHS = 24;

export interface ProjectionParams {
  fin: FinParams;
  base: number;
  days: number;
  ticket: number;
  costAvg: number;
  feeRate: number;
  rent0: number;
  staff0: number;
  other0: number;
  managerLoaded: number;
  owner: number;
  depBase: number;
  loan: number;
  pmt: number;
}

export interface Projection {
  rows: ProjectionRow[];
  /** Pozitif tutar. */
  trough: number;
  troughMonth: number;
  firstProfitMonth: number | null;
  sum24: number;
}

export function project(p: ProjectionParams): Projection {
  const f = p.fin;
  const kdv = pc(f.kdv);
  const waste = pc(f.waste);
  const taxRate = pc(f.profitTax);
  const r = pc(f.loanRate) / 12;
  const rs = clamp(pc(f.rampStart));
  const rm = Math.max(1, Math.round(n(f.rampMonths)));
  const dep = p.depBase / (Math.max(1, n(f.depYears)) * 12);
  // Aylık bileşik (fiyat, maliyet) ve yıllık basamak (kira, maaş).
  const g = (rate: MaybeNumber, m: number) => Math.pow(1 + pc(rate), (m - 1) / 12);
  const st = (rate: MaybeNumber, m: number) => Math.pow(1 + pc(rate), Math.floor((m - 1) / 12));

  let bal = p.loan;
  let cash = 0;
  let trough = 0;
  let troughMonth = 0;
  let lossPool = 0;
  let firstProfitMonth: number | null = null;
  let sum24 = 0;
  const rows: ProjectionRow[] = [];

  for (let m = 1; m <= PROJECTION_MONTHS; m++) {
    const ramp = m >= rm ? 1 : rs + ((1 - rs) * (m - 1)) / Math.max(1, rm - 1);
    const units = p.base * p.days * ramp;
    const gross = units * p.ticket * g(f.priceInc, m);
    const net = gross / (1 + kdv);
    const cogs = units * p.costAvg * (1 + waste) * g(f.inflCost, m);
    const fees = gross * p.feeRate;
    const fixed =
      p.rent0 * st(f.rentInc, m) +
      (p.staff0 + p.managerLoaded + p.owner) * st(f.wageInc, m) +
      p.other0 * g(f.inflCost, m);
    const ebitda = net - cogs - fees - fixed;
    const interest = bal > 0 ? bal * r : 0;
    const pay = bal > 0 ? Math.min(p.pmt, bal + interest) : 0;
    const principal = Math.max(0, pay - interest);
    bal = Math.max(0, bal - principal);
    const ebt = ebitda - dep - interest;
    let taxable = 0;
    if (ebt > 0) {
      const use = Math.min(lossPool, ebt);
      lossPool -= use;
      taxable = ebt - use;
    } else lossPool += -ebt;
    const tax = taxable * taxRate;
    const netIncome = ebt - tax;
    const cf = netIncome + dep - principal;
    cash += cf;
    if (m <= TROUGH_WINDOW_MONTHS && cash < trough) {
      trough = cash;
      troughMonth = m;
    }
    if (firstProfitMonth === null && netIncome > 0) firstProfitMonth = m;
    if (m <= TROUGH_WINDOW_MONTHS) sum24 += netIncome;
    rows.push({
      m,
      units,
      gross,
      net,
      cogs,
      fees,
      fixed,
      ebitda,
      interest,
      principal,
      tax,
      netIncome,
      dep,
      cf,
      cash,
    });
  }
  return { rows, trough: -trough, troughMonth, firstProfitMonth, sum24 };
}
