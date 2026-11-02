// §8 Rekabet (1 km)
import { n } from './math';
import type { AnalysisInput, CompetitionResult, Competitor, EngineArchetype, Level, TagShare } from './types';

export const COMPETITION_RADIUS_M = 1000;
export const MAJORITY_SHARE = 0.5;

/** Etiket payları: ilk görülme sırası, sonra paya göre azalan kararlı sıralama. */
function tagShares(within: Competitor[], kind: 's' | 'w'): TagShare[] {
  const counts = new Map<string, number>();
  for (const c of within) for (const k of c[kind] ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
  const total = within.length;
  return [...counts.entries()]
    .map(([k, count]) => ({ k, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.share - a.share);
}

export function competition(input: AnalysisInput, archetype: EngineArchetype): CompetitionResult {
  const withinIndexes: number[] = [];
  input.comp.forEach((c, i) => {
    if (n(c.dist) <= COMPETITION_RADIUS_M) withinIndexes.push(i);
  });
  const within = withinIndexes.map((i) => input.comp[i] as Competitor);
  const count = within.length;
  const pop = n(input.pop);
  const peoplePerBusiness = pop > 0 ? pop / (count + 1) : null;
  const [t0, t1] = archetype.competition.saturationPeoplePerBusiness;
  const saturation: Level | null =
    peoplePerBusiness === null ? null : peoplePerBusiness < t0 ? 'hi' : peoplePerBusiness < t1 ? 'mid' : 'lo';

  const prices = within.map((c) => n(c.price)).filter((v) => v > 0);
  const priceMin = prices.length ? Math.min(...prices) : null;
  const priceMax = prices.length ? Math.max(...prices) : null;
  const priceAvg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const rated = within.filter((c) => n(c.rating) > 0);
  const ratingAvg = rated.length ? rated.reduce((a, c) => a + n(c.rating), 0) / rated.length : null;

  const weaknesses = tagShares(within, 'w');
  const strengths = tagShares(within, 's');
  const majorityWeak = weaknesses.filter((x) => x.share >= MAJORITY_SHARE);
  const gaps = (majorityWeak.length ? majorityWeak : weaknesses.slice(0, 2)).map((x) => x.k);
  const stakes = strengths.filter((x) => x.share >= MAJORITY_SHARE).map((x) => x.k);

  let leaderIndex: number | null = null;
  let leaderScore = -Infinity;
  for (const i of withinIndexes) {
    const c = input.comp[i] as Competitor;
    const score = n(c.rating) * Math.log10(n(c.reviews) + 10);
    if (leaderIndex === null || score > leaderScore) {
      leaderIndex = i;
      leaderScore = score;
    }
  }

  return {
    rivalsWithin1km: count,
    withinIndexes,
    peoplePerBusiness,
    saturation,
    priceMin,
    priceAvg,
    priceMax,
    ratingAvg,
    weaknesses,
    strengths,
    gaps,
    stakes,
    leaderIndex,
    densityPerKm2: count / Math.PI,
    signaturePrice: n(input.items[0]?.price),
  };
}

export const tagShare = (shares: TagShare[], key: string): number =>
  shares.find((x) => x.k === key)?.share ?? 0;
