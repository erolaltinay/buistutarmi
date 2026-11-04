// Rapor modeli: bütün metinler çevrilmiş, sayılar biçimlenmiş gelir. Bu paket metin üretmez
// (CLAUDE.md kural 3 ve 4); sadece yerleşimi bilir.

export type Tone = 'good' | 'mid' | 'bad';

export interface Cell {
  text: string;
  /** Tıklanabilir bağlantı (mevzuat kaynağı). */
  href?: string;
  color?: 'pos' | 'neg';
}

export interface Column {
  head: string;
  /** Sayfa genişliğine göre pay; bir tablodaki toplamı 1'dir. */
  width: number;
  right?: boolean;
  bold?: boolean;
}

export type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'kv'; rows: { k: string; v: string; bold?: boolean }[] }
  | { kind: 'table'; columns: Column[]; rows: Cell[][]; small?: boolean }
  | { kind: 'para'; text: string; muted?: boolean }
  | { kind: 'bullets'; items: string[]; negative?: boolean; muted?: boolean }
  | { kind: 'notice'; text: string }
  | { kind: 'image'; src: string };

export interface ReportModel {
  /** PDF üst verisi ve kapak. */
  brand: string;
  title: string;
  subtitle: string;
  verdict: {
    tone: Tone;
    eyebrow: string;
    label: string;
    why: string;
    /** "Ön değerlendirme" etiketi (SPEC-architecture §7). */
    preliminary?: string;
    confidence: string;
  };
  /** 6 temel sayı. */
  tiles: { value: string; label: string }[];
  chart: { title: string; note: string; values: number[] };
  blocks: Block[];
  /** Her sayfanın altındaki yatırım tavsiyesi uyarısı (CLAUDE.md kural 10). */
  disclaimer: string;
  /** `{page}` ve `{total}` yer tutucularıyla. */
  pageLabel: string;
}
