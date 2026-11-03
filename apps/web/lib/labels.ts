// Satır, rakip ve kontrol listesi etiketleri sektör dosyasından gelir; kullanıcı adı yazdıysa o kullanılır.
import type { Sector } from '@bitm/archetypes';

export type Lang = 'tr' | 'en';
export const langOf = (locale: string): Lang => (locale === 'en' ? 'en' : 'tr');

type Row = { k?: string | null; n?: string | null };
type Template = { k: string; label: Record<Lang, string> }[];

export function rowLabel(row: Row, template: Template, lang: Lang): string {
  if (row.n != null) return row.n;
  return template.find((t) => t.k === row.k)?.label[lang] ?? '';
}

export function competitorLabel(row: Row, sector: Sector, lang: Lang): string {
  if (row.n != null) return row.n;
  return (row.k && sector.competition.sampleCompetitorNames[row.k]?.[lang]) || '';
}

export const letter = (i: number) => String.fromCharCode(65 + i);
