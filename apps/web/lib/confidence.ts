// Veri güveni (SPEC-architecture §7): girdi grupları, ağırlıklar ve kaynak etiketleri.
import type { AnalysisInput } from '@bitm/engine';

export type Source = 'sample' | 'estimate' | 'api' | 'user' | 'measured';

export const GROUPS = {
  rent: 15,
  staff: 13,
  price: 12,
  base: 12,
  cost: 10,
  foot: 10,
  capex: 7,
  area: 5,
  comp: 5,
  otherFixed: 4,
  site: 3,
  fin: 2,
  founder: 2,
} as const;
export type Group = keyof typeof GROUPS;
export type Sources = Partial<Record<Group, Source>>;

export const GROUP_KEYS = Object.keys(GROUPS) as Group[];
/** Ekranda "kendi verin" sayılan kaynaklar. */
const TRUSTED: Source[] = ['user', 'api', 'measured'];
export const PRELIMINARY_BELOW = 50;

/** Hangi sekmede düzenlendiği (karar ekranındaki bağlantı için). */
export const GROUP_TAB: Record<Group, 'finance' | 'area' | 'location'> = {
  rent: 'finance',
  staff: 'finance',
  price: 'finance',
  base: 'finance',
  cost: 'finance',
  foot: 'location',
  capex: 'finance',
  area: 'area',
  comp: 'area',
  otherFixed: 'finance',
  site: 'location',
  fin: 'finance',
  founder: 'location',
};

export const sourceOf = (sources: Sources | undefined, g: Group): Source =>
  sources?.[g] ?? (g === 'fin' ? 'estimate' : 'sample');

/** Kendi verine dayanan pay, 0–100. */
export function confidence(sources: Sources | undefined): number {
  return GROUP_KEYS.reduce((a, g) => a + (TRUSTED.includes(sourceOf(sources, g)) ? GROUPS[g] : 0), 0);
}

/** Örnek veya tahmini veriye dayanan gruplar, ağırlığa göre azalan. */
export const untrustedGroups = (sources: Sources | undefined): Group[] =>
  GROUP_KEYS.filter((g) => !TRUSTED.includes(sourceOf(sources, g)));

/** Her grubun girdideki karşılığı; değişiklik tespiti için. */
export function groupSlices(input: AnalysisInput): Record<Group, unknown> {
  const fixed = (type: string) => input.fixed.filter((r) => (r.type ?? 'other') === type);
  return {
    rent: fixed('rent'),
    staff: fixed('staff'),
    otherFixed: fixed('other'),
    price: input.items.map((r) => [r.k, r.n, r.price, r.mix]),
    cost: input.items.map((r) => r.cost),
    base: [input.scen, input.days, input.cap],
    foot: [input.loc.foot, input.loc.countMin, input.loc.openH],
    capex: [input.capex, input.contPct, input.wcMonths],
    area: [input.area, input.pop, input.demo],
    comp: input.comp,
    site: [input.loc.hist, input.loc.chk],
    fin: input.fin,
    founder: input.loc.founder,
  };
}

/** İki girdi arasında değişen gruplar. */
export function changedGroups(before: AnalysisInput, after: AnalysisInput): Group[] {
  const a = groupSlices(before);
  const b = groupSlices(after);
  return GROUP_KEYS.filter((g) => JSON.stringify(a[g]) !== JSON.stringify(b[g]));
}
