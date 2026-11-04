// Karar gerekçesi ve bayrak metinleri; ekran ve PDF aynı cümleleri kullanır.
import type { FinalReason, FinancialReason, LocationFlag } from '@bitm/engine';
import type { ChecklistItem } from '@bitm/archetypes';
import type { Format } from './format';
import type { Lang } from './labels';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export const makeFlagLabel =
  (t: Translate, checklist: ChecklistItem[], lang: Lang) =>
  (flag: LocationFlag): string =>
    flag.kind === 'checklist'
      ? (checklist.find((i) => i.k === flag.key)?.flag?.[lang] ?? flag.key)
      : t(`result.flag.${flag.kind}`);

export function makeVerdictText(t: Translate, fmt: Format, flagLabel: (f: LocationFlag) => string) {
  const why = (key: string, values?: Record<string, string | number>) => t(`result.why.${key}`, values);
  const fin = (r: FinancialReason): string => {
    switch (r.code) {
      case 'negativeMargin':
        return why('negativeMargin');
      case 'capacity':
        return why('capacity');
      case 'belowBreakEven':
      case 'thinMargin':
        return why(r.code, { base: fmt.num(r.base), be: fmt.num(Math.ceil(r.bePerDay)) });
      case 'longPayback':
        return why('longPayback', { months: r.paybackMonths === null ? '60+' : fmt.num(r.paybackMonths) });
      case 'go':
        return why('go', {
          margin: fmt.num(r.marginPct),
          months: r.paybackMonths === null ? '60+' : fmt.num(r.paybackMonths),
        });
    }
  };
  return (r: FinalReason): string => {
    switch (r.code) {
      case 'permitBlocked':
        return why('permitBlocked');
      case 'locationFlags':
        return why('locationFlags', { flags: r.flags.map(flagLabel).join(', ') });
      case 'locationFlag':
        return why('locationFlag', { flag: flagLabel(r.flag) });
      case 'financialWithFlag':
        return `${fin(r.financial)} ${why('alsoFlag', { flag: flagLabel(r.flag) })}`;
      case 'financial':
        return fin(r.financial);
    }
  };
}
