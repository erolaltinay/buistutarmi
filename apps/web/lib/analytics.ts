// Video → uygulama ölçümü (STRATEGY §4, SPEC-architecture §9). Şimdilik her şey bu cihazda kalır, dışarı
// veri gitmez. İP-1.1'de ilk kaynak `attribution` tablosuna, olaylar PostHog'a yazılır; arayüz değişmez.

const ATTRIBUTION_KEY = 'bitm:attribution';
const EVENTS_KEY = 'bitm:events';
const SESSION_KEY = 'bitm:visit';
const MAX_EVENTS = 200;
const MAX_LEN = 100;
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

export type EventName =
  | 'visit'
  | 'project_created'
  | 'quick_mode_completed'
  | 'verdict_shown'
  | 'candidate_added'
  | 'compare_viewed'
  | 'pdf_downloaded';

type Props = Record<string, string | number | boolean>;

export interface Attribution {
  first_utm: Partial<Record<(typeof UTM_KEYS)[number], string>>;
  first_sector: string | null;
  first_seen_at: string;
}

export interface TrackedEvent {
  name: EventName;
  at: string;
  /** Kullanıcının ilk geldiği video (`utm_content`); video dışı girişte null. */
  video: string | null;
  props?: Props;
}

const read = <T>(store: Storage, key: string): T | null => {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (store: Storage, key: string, value: unknown) => {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama kapalıysa uygulama ölçümsüz çalışır */
  }
};

const clean = (v: string | null) => {
  const s = v?.trim().slice(0, MAX_LEN);
  return s ? s : null;
};

/** Adres çubuğundan yalnız bilinen UTM alanları ve sektör okunur. */
export function parseLanding(search: string): Pick<Attribution, 'first_utm' | 'first_sector'> {
  const q = new URLSearchParams(search);
  const first_utm: Attribution['first_utm'] = {};
  for (const k of UTM_KEYS) {
    const v = clean(q.get(`utm_${k}`));
    if (v) first_utm[k] = v;
  }
  return { first_utm, first_sector: clean(q.get('sector')) };
}

export const getAttribution = (): Attribution | null =>
  typeof localStorage === 'undefined' ? null : read<Attribution>(localStorage, ATTRIBUTION_KEY);

export const getEvents = (): TrackedEvent[] =>
  typeof localStorage === 'undefined' ? [] : (read<TrackedEvent[]>(localStorage, EVENTS_KEY) ?? []);

export function track(name: EventName, props?: Props, now = new Date()): void {
  if (typeof localStorage === 'undefined') return;
  const event: TrackedEvent = {
    name,
    at: now.toISOString(),
    video: getAttribution()?.first_utm.content ?? null,
    ...(props ? { props } : {}),
  };
  write(localStorage, EVENTS_KEY, [...getEvents(), event].slice(-MAX_EVENTS));
}

/**
 * Her sayfa açılışında çağrılır. İlk kaynak bir kez yazılır, sonraki linkler onu değiştirmez (first-touch).
 * `visit` oturum başına bir kez sayılır ve o anki videoyu da taşır: aynı kişi ikinci videodan da gelebilir.
 */
export function captureLanding(search: string, now = new Date()): void {
  if (typeof localStorage === 'undefined') return;
  const landing = parseLanding(search);
  if (!getAttribution())
    write(localStorage, ATTRIBUTION_KEY, {
      ...landing,
      first_seen_at: now.toISOString(),
    } satisfies Attribution);
  if (typeof sessionStorage === 'undefined' || read(sessionStorage, SESSION_KEY)) return;
  write(sessionStorage, SESSION_KEY, true);
  track('visit', landing.first_utm.content ? { utm_content: landing.first_utm.content } : undefined, now);
}

export interface VideoStats {
  visit: number;
  project_created: number;
  quick_mode_completed: number;
  pdf_downloaded: number;
}

/** Video başına sayımlar (STRATEGY §4); null: videodan gelmeyenler. */
export function statsByVideo(events: TrackedEvent[]): Map<string | null, VideoStats> {
  const out = new Map<string | null, VideoStats>();
  for (const e of events) {
    // Ziyaret o anki videoya, diğer olaylar kullanıcının ilk geldiği videoya yazılır.
    const video = e.name === 'visit' ? ((e.props?.utm_content as string | undefined) ?? e.video) : e.video;
    const row = out.get(video) ?? {
      visit: 0,
      project_created: 0,
      quick_mode_completed: 0,
      pdf_downloaded: 0,
    };
    if (e.name in row) row[e.name as keyof VideoStats]++;
    out.set(video, row);
  }
  return out;
}
