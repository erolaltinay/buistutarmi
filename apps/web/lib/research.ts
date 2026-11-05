// Rakip inceleme kaydı (SPEC-competitor-research §6). İP-1.1'e kadar `input.comp[i].research` içinde durur;
// motor bu alanı okumaz. Rakibin fiyatına gözlemden yalnız kullanıcı "Uygula" deyince değer geçer.
import { z } from 'zod';
import { daysBetween, type Competitor } from '@bitm/engine';
import { RESEARCH_SOURCES, type ResearchSource } from '@bitm/archetypes';

export const LINK_KINDS = [
  'website',
  'digital_menu',
  'instagram',
  'facebook',
  'tiktok',
  'delivery',
  'booking',
  'other',
] as const;
export const CHANNELS = ['in_store', 'delivery', 'online', 'unknown'] as const;
export const VISIBILITIES = ['open', 'ask', 'in_store', 'unknown'] as const;

export type LinkKind = (typeof LINK_KINDS)[number];
export type Channel = (typeof CHANNELS)[number];
export type Visibility = (typeof VISIBILITIES)[number];

const IsoDate = z.iso.date();
const Source = z.enum(RESEARCH_SOURCES);

const Observation = z.object({
  /** Sektörün kalem anahtarı; eşleşmeyen kalemde null ve karşılaştırmaya girmez. */
  itemKey: z.string().nullable(),
  rawName: z.string().min(1).max(80),
  price: z.number().positive(),
  currency: z.string().length(3),
  sizeNote: z.string().max(60),
  channel: z.enum(CHANNELS),
  source: Source,
  sourceUrl: z.string().nullable(),
  /** Kullanıcının gözlem tarihi. */
  observedOn: IsoDate,
  /** Kaynakta yazan tarih, varsa. */
  sourceDatedOn: IsoDate.nullable(),
});
export type Observation = z.infer<typeof Observation>;

const Offer = z.object({
  type: z.string().min(1),
  note: z.string().max(120),
  source: Source,
  observedOn: IsoDate,
});
export type Offer = z.infer<typeof Offer>;

const SourceLink = z.object({ kind: z.enum(LINK_KINDS), url: z.string(), addedOn: IsoDate });
export type SourceLink = z.infer<typeof SourceLink>;

export const CompetitorResearch = z.object({
  sources: z.array(SourceLink),
  observations: z.array(Observation),
  offers: z.array(Offer),
  /** İşaretlenen kontrol maddelerinin anahtarları. */
  checks: z.array(z.string()),
  serviceFee: z.number().nonnegative().nullable(),
  visibility: z.enum(VISIBILITIES),
});
export type CompetitorResearch = z.infer<typeof CompetitorResearch>;

type Researched = Competitor & { research?: CompetitorResearch };

export const emptyResearch = (): CompetitorResearch => ({
  sources: [],
  observations: [],
  offers: [],
  checks: [],
  serviceFee: null,
  visibility: 'unknown',
});

export function researchOf(c: Competitor): CompetitorResearch {
  const parsed = CompetitorResearch.safeParse((c as Researched).research);
  return parsed.success ? parsed.data : emptyResearch();
}

export function withResearch(c: Competitor, research: CompetitorResearch): void {
  (c as Researched).research = research;
}

/** Yalnız http/https; kullanıcı adı ve şifre içeren adres reddedilir. */
export function normalizeUrl(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  if (raw.includes('://') ? !/^https?:\/\//i.test(raw) : /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw)) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (url.username || url.password || !url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function addSource(
  r: CompetitorResearch,
  kind: LinkKind,
  text: string,
  today: string,
): { research: CompetitorResearch } | { error: 'url' | 'duplicate' } {
  const url = normalizeUrl(text);
  if (!url) return { error: 'url' };
  if (r.sources.some((s) => s.url === url)) return { error: 'duplicate' };
  return { research: { ...r, sources: [...r.sources, { kind, url, addedOn: today }] } };
}

type DateError = 'date' | 'future';

function dateError(date: string, today: string): DateError | null {
  if (!IsoDate.safeParse(date).success) return 'date';
  return date > today ? 'future' : null;
}

export interface ObservationRow {
  /** Şablondaki kalem; "başka kalem" satırında null. */
  itemKey: string | null;
  name: string;
  price: number | null;
  sizeNote: string;
}

export interface ObservationDraft {
  source: ResearchSource | '';
  observedOn: string;
  sourceDatedOn: string;
  channel: Channel;
  sourceUrl: string;
  rows: ObservationRow[];
}

export type DraftError = 'source' | DateError | 'url' | 'name' | 'prices';

/** Kaynak ve gözlem tarihi olmadan gözlem çıkmaz; fiyat yazılmayan satır atlanır. */
export function buildObservations(
  draft: ObservationDraft,
  ctx: { today: string; currency: string },
): { ok: true; observations: Observation[] } | { ok: false; errors: DraftError[] } {
  const errors: DraftError[] = [];
  if (!draft.source) errors.push('source');
  const date = dateError(draft.observedOn, ctx.today);
  if (date) errors.push(date);

  const urlText = draft.sourceUrl.trim();
  const sourceUrl = urlText ? normalizeUrl(urlText) : null;
  if (urlText && !sourceUrl) errors.push('url');

  const sourceDatedOn = IsoDate.safeParse(draft.sourceDatedOn).success ? draft.sourceDatedOn : null;

  const priced = draft.rows.filter((row) => row.price !== null);
  if (priced.some((row) => row.itemKey === null && !row.name.trim())) errors.push('name');
  if (!priced.length || priced.some((row) => row.price! <= 0)) {
    if (!errors.includes('name')) errors.push('prices');
  }
  if (errors.length || !draft.source) return { ok: false, errors };

  const source = draft.source;
  return {
    ok: true,
    observations: priced.map((row) => ({
      itemKey: row.itemKey,
      rawName: row.name.trim(),
      price: row.price!,
      currency: ctx.currency,
      sizeNote: row.sizeNote.trim(),
      channel: draft.channel,
      source,
      sourceUrl,
      observedOn: draft.observedOn,
      sourceDatedOn,
    })),
  };
}

/** Kaynağa göre önerilen kanal; kullanıcı değiştirebilir. */
export function defaultChannel(source: ResearchSource | ''): Channel {
  if (source === 'delivery') return 'delivery';
  if (
    source === 'door' ||
    source === 'in_store_note' ||
    source === 'menu_photo' ||
    source === 'digital_menu' ||
    source === 'website' ||
    source === 'asked' ||
    source === 'booking'
  )
    return 'in_store';
  return 'unknown';
}

/** Yalnız imza kaleminin aynı para birimindeki gözlemi; teslimat fiyatı dükkân fiyatının yerine geçmez (§3). */
export const canApply = (o: Observation, signatureKey: string | undefined, currency: string): boolean =>
  o.itemKey !== null && o.itemKey === signatureKey && o.channel !== 'delivery' && o.currency === currency;

export function applyObservation(c: Competitor, o: Observation): void {
  c.price = o.price;
}

export function addOffer(
  r: CompetitorResearch,
  draft: { type: string; note: string; source: ResearchSource | ''; observedOn: string },
  today: string,
): { research: CompetitorResearch } | { error: 'type' | 'source' | DateError } {
  if (!draft.type) return { error: 'type' };
  if (!draft.source) return { error: 'source' };
  const date = dateError(draft.observedOn, today);
  if (date) return { error: date };
  const offer: Offer = {
    type: draft.type,
    note: draft.note.trim(),
    source: draft.source,
    observedOn: draft.observedOn,
  };
  return { research: { ...r, offers: [...r.offers, offer] } };
}

/** Ülke dosyasındaki sıra önce; kalan kaynaklar da seçilebilir kalır. */
export function orderedSources(countrySources: readonly ResearchSource[]): {
  recommended: ResearchSource[];
  others: ResearchSource[];
} {
  return {
    recommended: [...countrySources],
    others: RESEARCH_SOURCES.filter((s) => !countrySources.includes(s)),
  };
}

/** Eskime kuralı motordakiyle aynıdır (SPEC-calc-engine §12.2). */
export const isStale = (observedOn: string, asOf: string, staleAfterDays: number): boolean =>
  daysBetween(observedOn, asOf) > staleAfterDays;

/** Kullanıcının yerel günü; `toISOString` gece yarısına yakın bir önceki güne kayar. */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
