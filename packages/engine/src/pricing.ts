// §12 Fiyat stratejisi
import { tagShare } from './competition';
import { finiteOrNull, n } from './math';
import { unitEconomics } from './unit';
import type {
  AnalysisInput,
  CompetitionResult,
  EngineArchetype,
  PriceCard,
  PriceCardKey,
  PricingReason,
  PricingResult,
} from './types';

export const PRICE_FACTORS = { pen: 0.9, match: 1, prem: 1.15 } as const;
export const INCOME_INDEX = { high: 125, low: 85 } as const;

/** Ülkenin yuvarlama adımına göre en yakın kat; en az bir adım. */
export const roundPrice = (v: number, step: number): number => Math.max(step, Math.round(v / step) * step);

export interface PricingContext {
  base: number;
  days: number;
  cashFixed: number;
  incomeIndex: number | null;
  priceRounding: number;
}

export function pricing(
  input: AnalysisInput,
  archetype: EngineArchetype,
  comp: CompetitionResult,
  ctx: PricingContext,
): PricingResult {
  const step = ctx.priceRounding;
  const signaturePrice = n(input.items[0]?.price);
  const reference = comp.priceAvg || signaturePrice;
  const list: [PriceCardKey, number][] = [
    ['now', signaturePrice],
    ['pen', roundPrice(reference * PRICE_FACTORS.pen, step)],
    ['match', roundPrice(reference * PRICE_FACTORS.match, step)],
    ['prem', roundPrice(reference * PRICE_FACTORS.prem, step)],
  ];

  // Arketipin kalite etiketleri içinde en yüksek tek etiket payı.
  const qualityShare = Math.max(
    0,
    ...archetype.competition.qualityWeaknessKeys.map((k) => tagShare(comp.weaknesses, k)),
  );
  const overpricedShare = tagShare(comp.weaknesses, archetype.competition.overpricedWeaknessKey);

  let recommended: PriceCardKey = 'match';
  let reason: PricingReason = 'match';
  if (comp.priceAvg === null) {
    recommended = 'now';
    reason = null;
  } else if (comp.saturation === 'hi') {
    recommended = 'match';
    reason = 'sat';
  } else if (qualityShare >= 0.5) {
    recommended = 'prem';
    reason = 'prem';
  } else if (overpricedShare >= 0.5) {
    recommended = 'pen';
    reason = 'pen';
  } else if (ctx.incomeIndex !== null && ctx.incomeIndex >= INCOME_INDEX.high) {
    recommended = 'prem';
    reason = 'incHi';
  } else if (ctx.incomeIndex !== null && ctx.incomeIndex <= INCOME_INDEX.low) {
    recommended = 'pen';
    reason = 'incLo';
  }

  const cards: PriceCard[] = list.map(([k, price]) => {
    const ratio = signaturePrice > 0 ? price / signaturePrice : 1;
    const items = input.items.map((it, i) => ({
      ...it,
      price: i === 0 ? price : roundPrice(n(it.price) * ratio, step),
    }));
    const { cm } = unitEconomics(items, input.fin);
    const bePerDay = cm > 0 ? ctx.cashFixed / cm / ctx.days : Infinity;
    const baseNet = ctx.base * ctx.days * cm - ctx.cashFixed;
    return {
      k,
      price,
      items,
      cm,
      bePerDay: finiteOrNull(bePerDay),
      baseNet,
      overBase: Number.isFinite(bePerDay) && bePerDay > ctx.base,
    };
  });

  return { signaturePrice, reference, recommended, reason, cards };
}
