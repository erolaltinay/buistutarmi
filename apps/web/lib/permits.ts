// Mevzuat yol haritası (SPEC-legal §5): madde listesi, kullanıcının işaretlediği durumlar ve kritik yol.
import { getCountry, getSector, mergeLegal, type LegalItem } from '@bitm/archetypes';
import type { ProjectDoc } from './project';

export const PERMIT_STATUSES = ['unknown', 'todo', 'applied', 'done', 'na'] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];
export type Permits = Record<string, { status: PermitStatus; updatedAt: string }>;

export const STAGES = ['before_lease', 'before_opening', 'after_opening'] as const;

/** Yayın derlemesinde taslak veya kaynaksız madde hiçbir yerde gösterilmez (CLAUDE.md kural 11). */
export const IS_RELEASE = process.env.NEXT_PUBLIC_BITM_RELEASE === '1';

const STALE_DAYS = 365;

export const isDraft = (i: LegalItem) => i.verification.status === 'draft' || !i.sourceUrl;

/** Ülke dosyası mevzuat listesi tanımlıyor mu; desteklenmeyen ülkede liste yerine genel uyarı çıkar. */
export const hasLegalList = (doc: Pick<ProjectDoc, 'country'>) => Boolean(getCountry(doc.country).legal);

export function legalItems(doc: ProjectDoc, release: boolean = IS_RELEASE): LegalItem[] {
  if (!hasLegalList(doc)) return [];
  const region = getSector(doc.sector).samples[doc.sample]?.legalRegion;
  const items = mergeLegal(doc.country, doc.sector, region);
  return release ? items.filter((i) => !isDraft(i)) : items;
}

export const permitStatus = (permits: Permits | undefined, id: string): PermitStatus =>
  permits?.[id]?.status ?? 'unknown';

/** Durumu değiştirir; "bilmiyorum"a dönen madde kayıttan düşer. */
export function setPermit(d: ProjectDoc, id: string, status: PermitStatus, now: string): void {
  const next = { ...d.permits };
  if (status === 'unknown') delete next[id];
  else next[id] = { status, updatedAt: now };
  d.permits = next;
}

/** Tamamlanmamış kritik maddeler; "bana uygulanmaz" denen madde sayılmaz. */
export const openCritical = (items: LegalItem[], permits: Permits | undefined): LegalItem[] =>
  items.filter((i) => {
    const s = permitStatus(permits, i.id);
    return i.critical && s !== 'done' && s !== 'na';
  });

export interface CriticalPath {
  /** Bağımlılık zincirlerinin en uzunu, takvim günü. */
  min: number;
  max: number;
  /** Açılışı bekleten ama süresi bilinmeyen madde sayısı; varsa toplam eksik hesaplanmıştır. */
  unknownDays: number;
  /** Açılışı bekleten, tamamlanmamış madde sayısı. */
  pending: number;
}

/**
 * Açılıştan önce bitmesi gereken, henüz tamamlanmamış maddelerde `dependsOn` zincirinin en uzunu.
 * Açılıştan sonraki maddeler açılışı bekletmez; tamamlanan veya uygulanmayan madde süre eklemez ama
 * bağımlılık zincirini kesmez. Süresi bilinmeyen madde 0 gün sayılır ve `unknownDays`'e yazılır.
 */
export function criticalPath(items: LegalItem[], permits: Permits | undefined): CriticalPath {
  const relevant = items.filter((i) => i.stage !== 'after_opening');
  const byId = new Map(relevant.map((i) => [i.id, i]));
  const isPending = (i: LegalItem) => {
    const s = permitStatus(permits, i.id);
    return s !== 'done' && s !== 'na';
  };
  const memo = new Map<string, [number, number]>();
  const finish = (i: LegalItem): [number, number] => {
    const known = memo.get(i.id);
    if (known) return known;
    // legal:check döngüye izin vermez; yine de bozuk veride sonsuz özyineleme olmasın.
    memo.set(i.id, [0, 0]);
    let before: [number, number] = [0, 0];
    for (const dep of i.dependsOn) {
      const d = byId.get(dep);
      if (!d) continue;
      const [a, b] = finish(d);
      before = [Math.max(before[0], a), Math.max(before[1], b)];
    }
    const own = isPending(i) ? (i.typicalDays ?? [0, 0]) : [0, 0];
    const total: [number, number] = [before[0] + own[0]!, before[1] + own[1]!];
    memo.set(i.id, total);
    return total;
  };
  const pending = relevant.filter(isPending);
  let min = 0;
  let max = 0;
  for (const i of relevant) {
    const [a, b] = finish(i);
    min = Math.max(min, a);
    max = Math.max(max, b);
  }
  return { min, max, pending: pending.length, unknownDays: pending.filter((i) => !i.typicalDays).length };
}

/** Bütün liste en eski kontrol tarihi kadar günceldir (YYYY-MM-DD). */
export const oldestReview = (items: LegalItem[]): string | null =>
  items.map((i) => i.verification.lastReviewed).sort()[0] ?? null;

/** SPEC-legal §4: 12 aydan eski kontrol "güncelliği doğrulanmadı" rozetiyle gösterilir. */
export const isStale = (i: LegalItem, today: Date): boolean =>
  today.getTime() - new Date(i.verification.lastReviewed).getTime() > STALE_DAYS * 86_400_000;
