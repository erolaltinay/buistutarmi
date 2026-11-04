// Karar için gereken temel girdiler boşsa motor sonucu karar gibi gösterilmez ("eksik veri",
// SPEC-archetypes §3). Motor değişmez; bu yalnız gösterim kuralıdır.
import type { AnalysisInput, AnalysisResult } from '@bitm/engine';

export type IncompleteField = 'price' | 'base' | 'days' | 'cap';

const positive = (v: unknown) => Number(v) > 0;

export function incompleteFields(input: AnalysisInput): IncompleteField[] {
  const out: IncompleteField[] = [];
  if (!input.items.some((r) => positive(r.price))) out.push('price');
  if (!positive(input.scen[1])) out.push('base');
  if (!positive(input.days)) out.push('days');
  if (input.cap && !input.cap.every(positive)) out.push('cap');
  return out;
}

/** Yaya sayımı ve kontrol listesi hiç doldurulmadıysa puan veriden gelmez; gösterilmez. */
export function locationScore(r: AnalysisResult): number | null {
  const { hasFootCount, checklistCounts: c, score } = r.location;
  return hasFootCount || c.yes > 0 || c.no > 0 ? score : null;
}
