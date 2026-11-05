// §12.2 Fiyat haritası: `analyze()`'dan ayrı, karara ve puana girmez. Bugün `asOf` olarak gelir.
import { avg, sum } from './math';
import type {
  BundleDiscount,
  ChannelGap,
  Level,
  PriceChange,
  PriceChannel,
  PriceMapCell,
  PriceMapChannel,
  PriceMapInput,
  PriceMapItemRow,
  PriceMapResult,
  PriceMapRivalRow,
  PriceObservation,
} from './types';

const CHANNELS: readonly PriceChannel[] = ['in_store', 'online', 'unknown', 'delivery'];
export const PRICE_MAP_MIN = { rivals: 3, itemsPerRival: 2, rivalsPerItem: 2 } as const;

/** ISO günün takvim sayısı (Hinnant, days_from_civil); motor `Date` kullanamaz. */
function dayNumber(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe;
}

export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const averageOrNull = (xs: number[], min: number): number | null => (xs.length >= min ? avg(xs) : null);

/** Gün sırasına dizer; aynı gündeki gözlemler girildiği sırada kalır (sıralama kararlı). */
const byDate = (xs: PriceObservation[]): PriceObservation[] =>
  [...xs].sort((a, b) => dayNumber(a.observedOn) - dayNumber(b.observedOn));

function bundleDiscounts(
  bundles: PriceMapInput['bundles'],
  priceOf: (key: string) => number | null,
): BundleDiscount[] {
  return bundles.flatMap(({ key, parts }) => {
    const price = priceOf(key);
    const partPrices = parts.map(priceOf);
    if (price === null || partPrices.includes(null)) return [];
    return [{ key, discount: 1 - price / sum(partPrices as number[]) }];
  });
}

export function priceMap(input: PriceMapInput): PriceMapResult {
  const { asOf, staleAfterDays, currency, levels, items, bundles, rivals } = input;
  const keys = items.map((it) => it.key);
  const ignored = { otherCurrency: 0, unmatched: 0 };

  const usable = rivals.map((r) =>
    r.observations.filter((o) => {
      if (!(o.price > 0)) return false;
      if (o.currency !== currency) {
        ignored.otherCurrency += 1;
        return false;
      }
      if (o.itemKey === null || !keys.includes(o.itemKey)) {
        ignored.unmatched += 1;
        return false;
      }
      return true;
    }),
  );

  const isStale = (o: PriceObservation) => daysBetween(o.observedOn, asOf) > staleAfterDays;
  const levelOf = (x: number | null): Level | null =>
    x === null ? null : x < levels.low ? 'lo' : x > levels.high ? 'hi' : 'mid';

  /** Rakip + kalem + kanal başına gözlemler, eskiden yeniye. */
  const history = (rival: number, key: string, channel: PriceChannel) =>
    byDate(usable[rival]!.filter((o) => o.itemKey === key && o.channel === channel));

  const cellOf = (rival: number, key: string, channel: PriceChannel): PriceMapCell | null => {
    const o = history(rival, key, channel).at(-1);
    if (!o) return null;
    return {
      price: o.price,
      source: o.source,
      observedOn: o.observedOn,
      sizeNote: o.sizeNote,
      stale: isStale(o),
    };
  };
  const fresh = (cell: PriceMapCell | null | undefined): number | null =>
    cell && !cell.stale ? cell.price : null;

  const channelResult = (channel: PriceChannel): PriceMapChannel => {
    const grid = rivals.map((_, rival) => keys.map((key) => cellOf(rival, key, channel)));
    const freshPerRival = grid.map((row) => row.filter((c) => fresh(c) !== null).length);
    const qualifiedRivals = freshPerRival.filter((x) => x >= PRICE_MAP_MIN.itemsPerRival).length;
    const sufficient = qualifiedRivals >= PRICE_MAP_MIN.rivals;
    const compareOwn = channel !== 'delivery';

    const itemRows: PriceMapItemRow[] = items.map(({ key, price }, k) => {
      const cells = grid.map((row) => row[k]);
      const prices = cells.map(fresh).filter((x): x is number => x !== null);
      const med = prices.length ? median(prices) : null;
      const own = compareOwn && price !== null && price > 0 ? price : null;
      const comparable = sufficient && prices.length >= PRICE_MAP_MIN.rivalsPerItem;
      return {
        key,
        count: prices.length,
        staleCount: cells.filter((c) => c?.stale).length,
        min: prices.length ? Math.min(...prices) : null,
        median: med,
        max: prices.length ? Math.max(...prices) : null,
        own,
        ownRatio: comparable && own !== null && med !== null ? own / med : null,
      };
    });

    const rivalRows: PriceMapRivalRow[] = rivals.map((r, rival) => {
      const row = grid[rival]!;
      const ratios = itemRows.flatMap((it, k) => {
        const price = fresh(row[k]);
        return price !== null && it.count >= PRICE_MAP_MIN.rivalsPerItem && it.median !== null
          ? [price / it.median]
          : [];
      });
      const index = sufficient ? averageOrNull(ratios, PRICE_MAP_MIN.itemsPerRival) : null;
      const cells: PriceMapRivalRow['cells'] = {};
      keys.forEach((key, k) => {
        const cell = row[k];
        if (cell) cells[key] = cell;
      });
      return {
        rival,
        serviceFee: r.serviceFee,
        cells,
        index,
        level: levelOf(index),
        missing: keys.filter((_, k) => fresh(row[k]) === null),
        bundles: bundleDiscounts(bundles, (key) => fresh(cells[key])),
      };
    });

    const ownRatios = itemRows.flatMap((it) => (it.ownRatio === null ? [] : [it.ownRatio]));
    const ownIndex = averageOrNull(ownRatios, PRICE_MAP_MIN.itemsPerRival);
    return {
      channel,
      sufficient,
      qualifiedRivals,
      rivalsNeeded: Math.max(0, PRICE_MAP_MIN.rivals - qualifiedRivals),
      items: itemRows,
      rivals: rivalRows,
      own: compareOwn ? { index: ownIndex, level: levelOf(ownIndex) } : null,
    };
  };

  const channels = CHANNELS.filter((c) => usable.some((obs) => obs.some((o) => o.channel === c))).map(
    channelResult,
  );

  const channelGaps: ChannelGap[] = rivals.flatMap((_, rival) =>
    keys.flatMap((itemKey) => {
      const inStore = fresh(cellOf(rival, itemKey, 'in_store'));
      const delivery = fresh(cellOf(rival, itemKey, 'delivery'));
      return inStore !== null && delivery !== null
        ? [{ rival, itemKey, inStore, delivery, ratio: delivery / inStore }]
        : [];
    }),
  );

  const changes: PriceChange[] = rivals.flatMap((_, rival) =>
    keys.flatMap((itemKey) =>
      CHANNELS.flatMap((channel) => {
        const seen = history(rival, itemKey, channel);
        const to = seen.at(-1);
        const from = seen.filter((o) => o.observedOn !== to?.observedOn).at(-1);
        if (!to || !from) return [];
        return [
          {
            rival,
            itemKey,
            channel,
            fromPrice: from.price,
            fromOn: from.observedOn,
            toPrice: to.price,
            toOn: to.observedOn,
            days: daysBetween(from.observedOn, to.observedOn),
            pct: to.price / from.price - 1,
          },
        ];
      }),
    ),
  );

  const ownPrice = (key: string) => {
    const price = items.find((it) => it.key === key)?.price ?? null;
    return price !== null && price > 0 ? price : null;
  };

  return {
    asOf,
    channels,
    ownBundles: bundleDiscounts(bundles, ownPrice),
    channelGaps,
    changes,
    ignored,
  };
}
