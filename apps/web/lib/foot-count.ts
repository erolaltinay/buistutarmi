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

/** Motorda altı dilim tek sayım süresini paylaşır (SPEC-calc-engine §10.1); farklı süre o süreye çevrilir. */
export const countValue = (s: CountSession, countMin: number): number =>
  Math.round((s.count / elapsedMinutes(s)) * countMin);

export const effectiveCountMin = (loc: LocationInput, minutes: number): number => {
  const current = Number(loc.countMin);
  return current > 0 ? current : minutes;
};

export function countsOf(loc: LocationInput): FootCount[] {
  const parsed = z.array(FootCount).safeParse((loc as Counted).counts);
  return parsed.success ? parsed.data : [];
}

/** Tablodaki değer sayımdan geliyor mu? Elle değiştirilen veya süresi değişen dilim sayılmaz. */
export function isCounted(loc: LocationInput, day: CountDay, slot: number): boolean {
  const c = countsOf(loc).find((x) => x.day === day && x.slot === slot);
  return !!c && c.value === loc.foot[day][slot] && c.countMin === Number(loc.countMin);
}

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
  const value = countValue(s, countMin);
  loc.countMin = countMin;
  loc.foot[s.day][s.slot] = value;
  (loc as Counted).counts = [
    ...countsOf(loc).filter((c) => !(c.day === s.day && c.slot === s.slot)),
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
