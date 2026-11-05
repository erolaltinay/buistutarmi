// Saha sayacı (SPEC-architecture §5.4). Açık sayım her dokunuşta cihaza yazılır, sayfa kapansa da kaybolmaz.
// İP-1.1'e kadar biten sayım `input.loc.counts` içinde durur; motor bu alanı okumaz, aday kopyasıyla gezer.
import { z } from 'zod';
import type { LocationInput } from '@bitm/engine';
import type { ProjectDoc } from './project';

export const DEFAULT_COUNT_MIN = 15;
export const MIN_COUNT_MIN = 1;
export const MAX_COUNT_MIN = 120;

export const DAYS = ['wd', 'we'] as const;
export const SLOT_COUNT = 3;
export type CountDay = (typeof DAYS)[number];

const MINUTE_MS = 60_000;
const KEY = 'bitm:count:';

const Slot = z
  .number()
  .int()
  .min(0)
  .max(SLOT_COUNT - 1);

const CountSession = z.object({
  day: z.enum(DAYS),
  slot: Slot,
  minutes: z.number().min(MIN_COUNT_MIN).max(MAX_COUNT_MIN),
  startedAt: z.number(),
  stoppedAt: z.number().nullable(),
  count: z.number().int().nonnegative(),
  /** Sayım sürerken sayfa kapandı veya yenilendi; o aralıkta geçenler sayılmamış olabilir. */
  interrupted: z.boolean(),
});
export type CountSession = z.infer<typeof CountSession>;

const FootCount = z.object({
  day: z.enum(DAYS),
  slot: Slot,
  minutes: z.number().positive(),
  count: z.number().int().nonnegative(),
  /** Tabloya yazılan değer ve o anki sayım süresi; değer elle değişirse dilim artık "sayıldı" sayılmaz. */
  value: z.number().int().nonnegative(),
  countMin: z.number().positive(),
  countedAt: z.string(),
  interrupted: z.boolean(),
});
export type FootCount = z.infer<typeof FootCount>;

type Counted = LocationInput & { counts?: FootCount[] };

export const startCount = (day: CountDay, slot: number, minutes: number, now: number): CountSession => ({
  day,
  slot,
  minutes,
  startedAt: now,
  stoppedAt: null,
  count: 0,
  interrupted: false,
});

const endOf = (s: CountSession) => s.startedAt + s.minutes * MINUTE_MS;

export const isRunning = (s: CountSession, now: number): boolean => s.stoppedAt === null && now < endOf(s);

export const remainingMs = (s: CountSession, now: number): number =>
  Math.min(s.minutes * MINUTE_MS, Math.max(0, endOf(s) - (s.stoppedAt ?? now)));

export const tap = (s: CountSession, now: number): CountSession =>
  isRunning(s, now) ? { ...s, count: s.count + 1 } : s;

export const undoTap = (s: CountSession): CountSession => ({ ...s, count: Math.max(0, s.count - 1) });

export const stopCount = (s: CountSession, now: number): CountSession =>
  s.stoppedAt === null ? { ...s, stoppedAt: Math.max(s.startedAt, Math.min(now, endOf(s))) } : s;

/** Süresi dolan sayımı kapatır. Bitiş, ekrana dönülen an değil, sürenin dolduğu andır. */
export const settle = (s: CountSession, now: number): CountSession =>
  s.stoppedAt === null && now >= endOf(s) ? { ...s, stoppedAt: endOf(s) } : s;

export const elapsedMinutes = (s: CountSession): number =>
  s.stoppedAt === null ? 0 : (s.stoppedAt - s.startedAt) / MINUTE_MS;

export const canWrite = (s: CountSession): boolean => elapsedMinutes(s) >= MIN_COUNT_MIN;

type Tally = Pick<FootCount, 'count' | 'minutes'>;

/**
 * Motorda altı dilim tek sayım süresini paylaşır (SPEC-calc-engine §10.1); farklı süre o süreye çevrilir.
 * Birden çok sayım toplam kişi / toplam süre ile birleşir, uzun sayım daha ağır basar.
 */
export function slotValue(entries: Tally[], countMin: number): number {
  const minutes = entries.reduce((a, c) => a + c.minutes, 0);
  return minutes > 0 ? Math.round((entries.reduce((a, c) => a + c.count, 0) / minutes) * countMin) : 0;
}

export const DISAGREE_PCT = 30;

/** En yüksek hız en düşüğün %30'undan fazla üstündeyse sayımlar birbirini doğrulamıyor demektir. */
export function slotDisagrees(entries: Tally[]): boolean {
  if (entries.length < 2) return false;
  const rates = entries.map((c) => c.count / c.minutes);
  return Math.max(...rates) > Math.min(...rates) * (1 + DISAGREE_PCT / 100);
}

export const effectiveCountMin = (loc: LocationInput, minutes: number): number => {
  const current = Number(loc.countMin);
  return current > 0 ? current : minutes;
};

export function countsOf(loc: LocationInput): FootCount[] {
  const parsed = z.array(FootCount).safeParse((loc as Counted).counts);
  return parsed.success ? parsed.data : [];
}

export const slotCounts = (loc: LocationInput, day: CountDay, slot: number): FootCount[] =>
  countsOf(loc).filter((c) => c.day === day && c.slot === slot);

/** Tablodaki değer sayımdan geliyor mu? Elle değiştirilen veya süresi değişen dilim sayılmaz. */
export function isCounted(loc: LocationInput, day: CountDay, slot: number): boolean {
  const c = slotCounts(loc, day, slot).at(-1);
  return !!c && c.value === loc.foot[day][slot] && c.countMin === Number(loc.countMin);
}

/** Bu sayım yazılırsa tabloya girecek değer. */
export const previewValue = (loc: LocationInput, s: CountSession): number =>
  slotValue(
    [...slotCounts(loc, s.day, s.slot), { count: s.count, minutes: elapsedMinutes(s) }],
    effectiveCountMin(loc, s.minutes),
  );

const allSlots = () =>
  DAYS.flatMap((day) => Array.from({ length: SLOT_COUNT }, (_, slot) => ({ day, slot })));

export const countedSlotCount = (loc: LocationInput): number =>
  allSlots().filter(({ day, slot }) => isCounted(loc, day, slot)).length;

export const totalSlots = DAYS.length * SLOT_COUNT;

/** Henüz sayılmamış ilk dilim; hepsi sayıldıysa ilki. */
export const nextSlot = (loc: LocationInput): { day: CountDay; slot: number } =>
  allSlots().find(({ day, slot }) => !isCounted(loc, day, slot)) ?? { day: 'wd', slot: 0 };

/**
 * Biten sayımı Lokasyon'a yazar. Altı dilim de sayılınca grup `measured` olur; daha azında etiket değişmez,
 * çünkü kalan dilimlerde örnek rakamlar durabilir (SPEC-architecture §5.4).
 */
export function applyCount(doc: ProjectDoc, s: CountSession, countedAt: string): void {
  const loc = doc.input.loc;
  const countMin = effectiveCountMin(loc, s.minutes);
  const value = previewValue(loc, s);
  loc.countMin = countMin;
  loc.foot[s.day][s.slot] = value;
  (loc as Counted).counts = [
    ...countsOf(loc),
    {
      day: s.day,
      slot: s.slot,
      minutes: elapsedMinutes(s),
      count: s.count,
      value,
      countMin,
      countedAt,
      interrupted: s.interrupted,
    },
  ];
  if (countedSlotCount(loc) === totalSlots) doc.sources = { ...doc.sources, foot: 'measured' };
}

/** Bir sayımı siler, dilimin ortalamasını yeniden hesaplar; altı dilim bozulursa `measured` kalkar. */
export function removeCount(doc: ProjectDoc, day: CountDay, slot: number, index: number): void {
  const loc = doc.input.loc;
  const entries = slotCounts(loc, day, slot);
  const target = entries[index];
  if (!target) return;
  const countMin = effectiveCountMin(loc, target.countMin);
  const remaining = entries.filter((_, i) => i !== index);
  const value = slotValue(remaining, countMin);
  const last = remaining.at(-1);
  (loc as Counted).counts = [
    ...countsOf(loc).filter((c) => !(c.day === day && c.slot === slot)),
    ...remaining.slice(0, -1),
    ...(last ? [{ ...last, value, countMin }] : []),
  ];
  loc.foot[day][slot] = value;
  if (doc.sources?.foot === 'measured' && countedSlotCount(loc) < totalSlots)
    doc.sources = { ...doc.sources, foot: 'user' };
}

export function loadSession(projectId: string): CountSession | null {
  try {
    const raw = localStorage.getItem(KEY + projectId);
    if (!raw) return null;
    const parsed = CountSession.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveSession(projectId: string, s: CountSession): boolean {
  try {
    localStorage.setItem(KEY + projectId, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(projectId: string): void {
  try {
    localStorage.removeItem(KEY + projectId);
  } catch {
    // Depolama kapalıysa silinecek bir şey de yoktur.
  }
}
