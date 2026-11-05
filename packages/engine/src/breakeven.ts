// §6 Başabaş, senaryolar, geri ödeme
import { finiteOrNull, n } from './math';
import type { ProjectionRow, Triple } from './types';

export const SENSITIVITY_FACTORS = [1, 0.9, 0.8] as const;

export interface BreakEven {
  perMonth: number;
  perDay: number;
  perDayWithoutManager: number;
  sensitivity: (number | null)[];
}

export function breakEven(cashFixed: number, cm: number, days: number, managerLoaded: number): BreakEven {
  const perMonth = cm > 0 ? cashFixed / cm : Infinity;
  const perDay = perMonth / days;
  const perDayWithoutManager = cm > 0 ? (cashFixed - managerLoaded) / cm / days : Infinity;
  const sensitivity = SENSITIVITY_FACTORS.map((f) => {
    const c = cm * f;
    return c > 0 ? finiteOrNull(cashFixed / c / days) : null;
  });
  return { perMonth, perDay, perDayWithoutManager, sensitivity };
}

/** 1. ay fiyatlarıyla, vergi öncesi aylık nakit. */
export function scenarioNets(scen: Triple, days: number, cm: number, cashFixed: number): Triple {
  return [scen[0], scen[1], scen[2]].map((d) => n(d) * days * cm - cashFixed) as Triple;
}

/** Hizmet arketipinde günlük azami kapasite: istasyon × saat × 60 ÷ hizmet süresi. */
export function maxDailyCapacity(cap: Triple): number {
  const stations = n(cap[0]);
  const hours = n(cap[1]);
  const minutes = n(cap[2]);
  return minutes > 0 ? (stations * hours * 60) / minutes : 0;
}

export interface Payback {
  startup: number;
  total: number;
}

/** Birikimli (net kâr + amortisman) ilk kez yatırımı geçtiği ay + bekleme ayları (§5.1); 60 ayda olmuyorsa ∞. */
export function payback(
  rows: ProjectionRow[],
  capexTotal: number,
  invest: number,
  preOpenMonths: number,
): Payback {
  let cum = 0;
  let startup = Infinity;
  let total = Infinity;
  for (const r of rows) {
    cum += r.netIncome + r.dep;
    if (startup === Infinity && cum >= capexTotal) startup = r.m + preOpenMonths;
    if (total === Infinity && cum >= invest) total = r.m + preOpenMonths;
  }
  return { startup, total };
}
