// §7 Finansal karar ve §11 nihai karar
import { finiteOrNull } from './math';
import type { FinalReason, FinancialReason, LocationResult, Verdict } from './types';

export const THIN_MARGIN_FACTOR = 1.25;
export const LONG_PAYBACK_MONTHS = 36;

export interface FinancialContext {
  cm: number;
  base: number;
  bePerDay: number;
  maxDaily: number | null;
  /** §6 svcShare; kapasite yalnız hizmet işlemlerine uygulanır. */
  serviceShare: number;
  paybackTotal: number;
}

/** Sırayla, ilk eşleşen döner. */
export function financialVerdict(c: FinancialContext): { verdict: Verdict; reason: FinancialReason } {
  if (!(c.cm > 0)) return { verdict: 'NO', reason: { code: 'negativeMargin' } };
  const serviceBePerDay = c.bePerDay * c.serviceShare;
  if (c.maxDaily !== null && serviceBePerDay > c.maxDaily)
    return {
      verdict: 'NO',
      reason: { code: 'capacity', maxDaily: c.maxDaily, bePerDay: c.bePerDay, serviceBePerDay },
    };
  if (c.base < c.bePerDay)
    return { verdict: 'NO', reason: { code: 'belowBreakEven', base: c.base, bePerDay: c.bePerDay } };
  if (c.base < c.bePerDay * THIN_MARGIN_FACTOR)
    return { verdict: 'MID', reason: { code: 'thinMargin', base: c.base, bePerDay: c.bePerDay } };
  if (c.paybackTotal > LONG_PAYBACK_MONTHS)
    return { verdict: 'MID', reason: { code: 'longPayback', paybackMonths: finiteOrNull(c.paybackTotal) } };
  return {
    verdict: 'GO',
    reason: {
      code: 'go',
      marginPct: (c.base / c.bePerDay - 1) * 100,
      paybackMonths: finiteOrNull(c.paybackTotal),
    },
  };
}

export function finalVerdict(
  financial: { verdict: Verdict; reason: FinancialReason },
  loc: LocationResult,
): { verdict: Verdict; reason: FinalReason } {
  const flags = loc.redFlags;
  const [first] = flags;
  if (loc.blocker) return { verdict: 'NO', reason: { code: 'permitBlocked' } };
  if (financial.verdict !== 'NO' && flags.length >= 2)
    return { verdict: 'NO', reason: { code: 'locationFlags', flags } };
  if (financial.verdict === 'GO' && flags.length === 1 && first)
    return { verdict: 'MID', reason: { code: 'locationFlag', flag: first } };
  if (financial.verdict === 'MID' && flags.length === 1 && first)
    return {
      verdict: 'MID',
      reason: { code: 'financialWithFlag', financial: financial.reason, flag: first },
    };
  return { verdict: financial.verdict, reason: { code: 'financial', financial: financial.reason } };
}
