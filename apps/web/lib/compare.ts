// Aday karşılaştırma (İP-1.5): prototipteki 12 satır ve "en iyi değer" vurgu kuralı.
import type { AnalysisResult } from '@bitm/engine';
import type { Format } from './format';
import type { ProjectDoc } from './project';
import type { Translate } from './verdict-text';

export const MAX_CANDIDATES = 4;

export type CmpRow =
  | 'verdict'
  | 'beDay'
  | 'invest'
  | 'trough'
  | 'pay'
  | 'sum24'
  | 'fit'
  | 'rivals'
  | 'rent'
  | 'capture'
  | 'locScore'
  | 'flags';

/** Satırlar ve hangi yönün iyi olduğu; karar satırında vurgu yok. */
export const CMP_ROWS: [CmpRow, 'low' | 'high' | null][] = [
  ['verdict', null],
  ['beDay', 'low'],
  ['invest', 'low'],
  ['trough', 'low'],
  ['pay', 'low'],
  ['sum24', 'high'],
  ['fit', 'high'],
  ['rivals', 'low'],
  ['rent', 'low'],
  ['capture', 'low'],
  ['locScore', 'high'],
  ['flags', 'low'],
];

/** Para birimiyle ifade edilen satırlar; farklı para birimleri arasında vurgulanmaz. */
const MONEY_ROWS: CmpRow[] = ['invest', 'trough', 'sum24'];

export interface CmpColumn {
  cur: string;
  result: AnalysisResult;
}

/** Satırın karşılaştırılan ham değeri; hesaplanamayan değer (null) en iyi sayılmaz. */
export function rowValue(r: AnalysisResult, row: CmpRow): number | null {
  switch (row) {
    case 'verdict':
      return null;
    case 'beDay':
      return r.breakEven.perDay;
    case 'invest':
      return r.investment.total;
    case 'trough':
      return r.investment.cashTrough;
    case 'pay':
      return r.projection.paybackTotalMonths;
    case 'sum24':
      return r.projection.sum24NetProfit;
    case 'fit':
      return r.demandFit.score;
    case 'rivals':
      return r.competition.rivalsWithin1km;
    case 'rent':
      return r.location.rentToSalesPct;
    case 'capture':
      return r.location.captureNeededPct;
    case 'locScore':
      return r.location.score;
    case 'flags':
      return r.location.redFlagCount;
  }
}

/**
 * Her satırda en iyi değeri taşıyan sütunlar. Tek sütunda vurgu yok; eşitlikte hepsi işaretlenir;
 * para satırları yalnız tüm sütunlar aynı para birimindeyse karşılaştırılır.
 */
export function bestCells(cols: CmpColumn[]): Record<CmpRow, boolean[]> {
  const sameCur = cols.every((c) => c.cur === cols[0]?.cur);
  const out = {} as Record<CmpRow, boolean[]>;
  for (const [row, better] of CMP_ROWS) {
    const vals = cols.map((c) => rowValue(c.result, row));
    const known = vals.filter((v): v is number => v !== null);
    const eligible =
      better !== null && cols.length > 1 && known.length > 0 && (sameCur || !MONEY_ROWS.includes(row));
    const best = eligible ? (better === 'low' ? Math.min(...known) : Math.max(...known)) : null;
    out[row] = vals.map((v) => best !== null && v === best);
  }
  return out;
}

/** Satırın gösterim metni; ekran ve PDF ortak (karar satırı dahil). */
export function cmpCell(r: AnalysisResult, row: CmpRow, f: Format, t: Translate): string {
  const pct = (v: number | null) => (v === null ? '—' : f.pct(v));
  switch (row) {
    case 'verdict':
      return t(`result.label.${r.verdict}`);
    case 'beDay':
      return r.breakEven.perDay === null
        ? '—'
        : t('result.perDay', { value: f.num(Math.ceil(r.breakEven.perDay)) });
    case 'invest':
      return f.money(r.investment.total);
    case 'trough':
      return f.money(r.investment.cashTrough);
    case 'pay':
      return r.projection.paybackTotalMonths === null
        ? t('result.never')
        : t('result.months', { count: f.num(r.projection.paybackTotalMonths) });
    case 'sum24':
      return f.money(r.projection.sum24NetProfit);
    case 'fit':
      return `${f.num(r.demandFit.score)} / 100`;
    case 'rivals': {
      const sat = r.competition.saturation;
      return f.num(r.competition.rivalsWithin1km) + (sat ? ` · ${t(`area.sat.${sat}`)}` : '');
    }
    case 'rent':
      return pct(r.location.rentToSalesPct);
    case 'capture':
      return pct(r.location.captureNeededPct);
    case 'locScore':
      return `${f.num(r.location.score)} / 100`;
    case 'flags':
      return f.num(r.location.redFlagCount);
  }
}

/** Aday adı alanının sınırı (prototip). */
export const CAND_NAME_MAX = 40;

/** Şu anki analizi aday olarak ekler; sınır doluysa false döner ve dokunmaz. */
export function addCandidate(d: ProjectDoc, name: string, id: string, now: string): boolean {
  const list = d.candidates ?? [];
  if (list.length >= MAX_CANDIDATES) return false;
  const clean = name.trim().slice(0, CAND_NAME_MAX) || d.input.area;
  d.candidates = [
    ...list,
    { id, name: clean, savedAt: now, input: structuredClone(d.input), sources: d.sources },
  ];
  return true;
}

/** Adayın verisini şu anki analizle değiştirir. */
export function updateCandidate(d: ProjectDoc, id: string, now: string): void {
  d.candidates = (d.candidates ?? []).map((c) =>
    c.id === id ? { ...c, savedAt: now, input: structuredClone(d.input), sources: d.sources } : c,
  );
}

/** Adayı şu anki analiz olarak açar (kaynak etiketleriyle birlikte). */
export function loadCandidate(d: ProjectDoc, id: string): void {
  const c = d.candidates?.find((x) => x.id === id);
  if (!c) return;
  d.input = structuredClone(c.input);
  d.sources = c.sources;
}

export function removeCandidate(d: ProjectDoc, id: string): void {
  d.candidates = (d.candidates ?? []).filter((c) => c.id !== id);
}
