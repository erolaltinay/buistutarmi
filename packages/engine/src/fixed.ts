// §3 Sabit giderler
import { n, pc } from './math';
import type { AnalysisInput, FixedCosts, FixedRow, FixedType } from './types';

const RENT_NAME = /kira|rent/i;
const STAFF_NAME = /personel|staff|maaş|wage|payroll/i;

/** §3.2: açık `type` yoksa anahtar, anahtar da yoksa ad üzerinden tahmin (eski veri). */
export function fixedRowType(r: FixedRow): FixedType {
  if (r.type) return r.type;
  const k = r.k ?? '';
  const name = r.n ?? '';
  if (k === 'rent' || (!k && RENT_NAME.test(name))) return 'rent';
  if (/^staff/.test(k) || (!k && STAFF_NAME.test(name))) return 'staff';
  return 'other';
}

export function fixedCosts(input: AnalysisInput): FixedCosts {
  const fin = input.fin;
  const stp = Math.min(0.9, pc(fin.stopaj));
  const emp = pc(fin.employer);
  let rent0 = 0;
  let staff0 = 0;
  let other0 = 0;
  let hasRent = false;
  for (const r of input.fixed) {
    const v = n(r.v);
    const type = fixedRowType(r);
    if (type === 'rent') {
      rent0 += v / (1 - stp);
      hasRent = true;
    } else if (type === 'staff') staff0 += v * (1 + emp);
    else other0 += v;
  }
  const founder = input.loc.founder;
  const managerRaw =
    founder.role === 'investor' ? n(founder.mgr) : founder.role === 'part' ? n(founder.mgr) / 2 : 0;
  const managerLoaded = managerRaw * (1 + emp);
  const owner = n(fin.ownerSalary);
  const opFixed = rent0 + staff0 + other0 + managerLoaded + owner;
  return { rent0, staff0, other0, hasRent, managerRaw, managerLoaded, owner, opFixed };
}
