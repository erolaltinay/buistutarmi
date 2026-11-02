// §2 Birim ekonomisi
import { n, pc } from './math';
import type { FinParams, ItemRow, UnitEconomics } from './types';

export function feeRate(fin: FinParams): number {
  return pc(fin.cardShare) * pc(fin.cardFee) + pc(fin.platShare) * pc(fin.platFee);
}

export function unitEconomics(items: ItemRow[], fin: FinParams): UnitEconomics {
  const kdv = pc(fin.kdv);
  const waste = pc(fin.waste);
  const fr = feeRate(fin);
  const mixSum = items.reduce((a, r) => a + n(r.mix), 0);
  if (!(mixSum > 0)) return { mixSum, feeRate: fr, ticket: 0, ticketNet: 0, costAvg: 0, cm: 0 };
  const w = (r: ItemRow) => n(r.mix) / mixSum;
  const ticket = items.reduce((a, r) => a + n(r.price) * w(r), 0);
  const costAvg = items.reduce((a, r) => a + n(r.cost) * w(r), 0);
  const ticketNet = ticket / (1 + kdv);
  const cm = ticketNet - costAvg * (1 + waste) - ticket * fr;
  return { mixSum, feeRate: fr, ticket, ticketNet, costAvg, cm };
}
