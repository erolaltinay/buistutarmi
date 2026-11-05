// Fiyat haritası: proje girdisini motora çevirir, sonucu ekran ve PDF için ortak metne döker.
// Hesap `@bitm/engine` içinde (SPEC-calc-engine §12.2); burada formül yok.
import {
  PRICE_MAP_MIN,
  priceMap,
  type AnalysisInput,
  type PriceMapInput,
  type PriceMapResult,
  type PriceMapRivalRow,
} from '@bitm/engine';
import type { Country, Sector } from '@bitm/archetypes';
import { numberLocale, type Format } from './format';
import { competitorLabel, letter, type Lang } from './labels';
import { researchOf } from './research';
import type { Translate } from './verdict-text';

export function priceMapInput(
  input: AnalysisInput,
  sector: Sector,
  country: Country,
  asOf: string,
): PriceMapInput {
  return {
    asOf,
    staleAfterDays: country.research.staleAfterDays,
    currency: input.cur,
    levels: sector.research.levels,
    items: sector.itemTemplate.map(({ k }) => {
      const price = input.items.find((row) => row.k === k)?.price;
      return { key: k, price: typeof price === 'number' ? price : null };
    }),
    bundles: sector.research.bundles.map((b) => ({ key: b.k, parts: b.parts })),
    rivals: input.comp.map((c) => {
      const r = researchOf(c);
      return {
        serviceFee: r.serviceFee,
        observations: r.observations.map((o) => ({
          itemKey: o.itemKey,
          price: o.price,
          currency: o.currency,
          channel: o.channel,
          source: o.source,
          observedOn: o.observedOn,
          sizeNote: o.sizeNote,
        })),
      };
    }),
  };
}

export const projectPriceMap = (
  input: AnalysisInput,
  sector: Sector,
  country: Country,
  asOf: string,
): PriceMapResult => priceMap(priceMapInput(input, sector, country, asOf));

/** Kayıtlı ISO günü, saat dilimine kaymadan kullanıcının diline göre. */
export const showDay = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(numberLocale(locale), { timeZone: 'UTC' }).format(Date.parse(iso));

export const itemName = (sector: Sector, key: string, lang: Lang): string =>
  sector.itemTemplate.find((it) => it.k === key)?.label[lang] ?? key;

export const rivalName = (input: AnalysisInput, i: number, sector: Sector, lang: Lang): string => {
  const rival = input.comp[i];
  const name = rival ? competitorLabel(rival, sector, lang) : '';
  return name ? `${letter(i)} · ${name}` : letter(i);
};

/** Yeterlilik için gereken sayıda taze kalemi olmayan rakipler. */
export const incompleteRivals = (rivals: PriceMapRivalRow[], itemCount: number): PriceMapRivalRow[] =>
  rivals.filter((r) => itemCount - r.missing.length < PRICE_MAP_MIN.itemsPerRival);

export const insufficientText = (t: Translate, qualified: number): string =>
  `${t('priceMap.insufficient')} ${t('priceMap.insufficientRule', {
    rivals: PRICE_MAP_MIN.rivals,
    items: PRICE_MAP_MIN.itemsPerRival,
    count: qualified,
  })}`;

export interface PriceMapTextArgs {
  map: PriceMapResult;
  input: AnalysisInput;
  sector: Sector;
  lang: Lang;
  locale: string;
  fmt: Format;
  t: Translate;
}

/** Hesaplanmış sonucun cümleleri; ekran ve PDF aynı metni gösterir. */
export function priceMapLines({ map, input, sector, lang, locale, fmt, t }: PriceMapTextArgs) {
  const who = (i: number) => rivalName(input, i, sector, lang);
  const item = (key: string) => itemName(sector, key, lang);
  const pct = (v: number) => fmt.pct(Math.abs(v) * 100, 1);
  const bundle = (name: string, b: { key: string; discount: number }) =>
    t(b.discount >= 0 ? 'priceMap.bundleRow' : 'priceMap.bundleNeg', {
      who: name,
      item: item(b.key),
      pct: pct(b.discount),
    });
  const bundles = [
    ...map.ownBundles.map((b) => bundle(t('priceMap.you'), b)),
    ...map.channels.flatMap((ch) =>
      ch.rivals.flatMap((r) =>
        r.bundles.map((b) => bundle(`${who(r.rival)} (${t(`research.channel.${ch.channel}`)})`, b)),
      ),
    ),
  ];

  const gaps = map.channelGaps.map((g) => {
    const diff = g.ratio - 1;
    return t(diff > 0 ? 'priceMap.gapAbove' : diff < 0 ? 'priceMap.gapBelow' : 'priceMap.gapSame', {
      who: who(g.rival),
      item: item(g.itemKey),
      pct: pct(diff),
    });
  });

  const changes = map.changes.map((c) =>
    t('priceMap.changeRow', {
      who: who(c.rival),
      item: item(c.itemKey),
      channel: t(`research.channel.${c.channel}`),
      from: fmt.money(c.fromPrice),
      to: fmt.money(c.toPrice),
      pct: `${c.pct >= 0 ? '+' : '−'}${pct(c.pct)}`,
      fromOn: showDay(c.fromOn, locale),
      toOn: showDay(c.toOn, locale),
    }),
  );

  const policies = input.comp.flatMap((c, i) => {
    const r = researchOf(c);
    const parts = [
      ...(r.visibility === 'unknown' ? [] : [t(`research.visibility.${r.visibility}`)]),
      ...r.offers.map((o) => sector.research.offers[o.type]?.[lang] ?? o.type),
    ];
    return parts.length ? [`${who(i)}: ${parts.join(' · ')}`] : [];
  });

  return { bundles, gaps, changes, policies };
}
