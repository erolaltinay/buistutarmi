// Gösterim biçimleri. Motor ham sayı döner; yuvarlama sadece burada (CLAUDE.md kural 3).
export const numberLocale = (locale: string) => (locale === 'tr' ? 'tr-TR' : 'en-US');

export interface Format {
  num: (v: number, digits?: number) => string;
  money: (v: number) => string;
  /** Grafik eksenleri için kısa para biçimi. */
  compactMoney: (v: number) => string;
  /** Yüzde değeri (12.5 → "%12,5" / "12.5%"). */
  pct: (v: number, digits?: number) => string;
}

export function makeFormat(locale: string, currency: string): Format {
  const loc = numberLocale(locale);
  const fraction =
    new Intl.NumberFormat(loc, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 0;
  const num = (v: number, digits = 0) =>
    new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  // Küsuratlı para birimlerinde küçük tutarlar kuruşuyla gösterilir (5,75 $).
  const money = (v: number) => {
    const d = fraction > 0 && Math.abs(v) < 100 ? fraction : 0;
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    }).format(v);
  };
  const compactMoney = (v: number) =>
    new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);
  const pct = (v: number, digits = 1) =>
    new Intl.NumberFormat(loc, {
      style: 'percent',
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(v / 100);
  return { num, money, compactMoney, pct };
}
