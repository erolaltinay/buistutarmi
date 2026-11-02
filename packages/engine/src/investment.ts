// §4 Yatırım ve kredi / nakit açığı sabit nokta iterasyonu
import { clamp, n, pc } from './math';
import { project, type Projection, type ProjectionParams } from './projection';
import type { AnalysisInput, CapexRow } from './types';

const NON_DEPRECIABLE_KEY = /^(stock|stockB|permits)$/;
export const FIXED_POINT_ROUNDS = 5;

/** Açık `depreciable` yoksa §4'teki anahtar kuralı. */
export const isDepreciable = (r: CapexRow): boolean =>
  r.depreciable !== undefined ? r.depreciable : !NON_DEPRECIABLE_KEY.test(r.k ?? '');

export function annuity(principal: number, rate: number, periods: number): number {
  if (!(principal > 0)) return 0;
  return rate > 0 ? (principal * rate) / (1 - Math.pow(1 + rate, -periods)) : principal / periods;
}

export interface Capex {
  capexSubtotal: number;
  capexTotal: number;
  nonDepreciable: number;
  depreciableBase: number;
}

export function capex(input: AnalysisInput): Capex {
  const capexSubtotal = input.capex.reduce((a, r) => a + n(r.v), 0);
  const capexTotal = capexSubtotal * (1 + n(input.contPct) / 100);
  const nonDepreciable = input.capex.filter((r) => !isDepreciable(r)).reduce((a, r) => a + n(r.v), 0);
  const depreciableBase = Math.max(0, capexTotal - nonDepreciable);
  return { capexSubtotal, capexTotal, nonDepreciable, depreciableBase };
}

export interface Financing {
  equityShare: number;
  cushion: number;
  loan: number;
  pmt: number;
  invest: number;
  workingCapital: number;
  projection: Projection;
}

/** Kredi nakit açığına, nakit açığı krediye bağlı: 5 tur sabit nokta (§4). */
export function solveFinancing(
  input: AnalysisInput,
  capexTotal: number,
  opFixed: number,
  params: Omit<ProjectionParams, 'loan' | 'pmt'>,
): Financing {
  const equityShare = clamp(pc(input.loc.founder.equity));
  const cushion = opFixed * n(input.wcMonths);
  const rate = pc(input.fin.loanRate) / 12;
  const periods = Math.max(1, Math.round(n(input.fin.loanTerm)));
  let trough = opFixed * 2;
  let loan = 0;
  let pmt = 0;
  let projection = project({ ...params, loan, pmt });
  for (let i = 0; i < FIXED_POINT_ROUNDS; i++) {
    const invest = capexTotal + trough + cushion;
    loan = invest * (1 - equityShare);
    pmt = annuity(loan, rate, periods);
    projection = project({ ...params, loan, pmt });
    trough = projection.trough;
  }
  const invest = capexTotal + trough + cushion;
  return { equityShare, cushion, loan, pmt, invest, workingCapital: trough + cushion, projection };
}
