// Genel mod (STRATEGY §2, İP-1.9): `supportLevel: generic` ülkede yerel veri ve varsayılan yoktur.
// Ülke kodu kontrol edilmez (CLAUDE.md kural 13); davranış yalnız ülke dosyasından gelir.
import { countries, getCountry, ISO_REGIONS } from '@bitm/archetypes';
import { numberLocale } from './format';

export const isGeneric = (code: string) => getCountry(code).supportLevel === 'generic';

/** Başka ülke listesi: kendi dosyası olanlar dışındaki bütün ülkeler, seçili dilde sıralı. */
export function otherCountries(locale: string): { code: string; name: string }[] {
  const loc = numberLocale(locale);
  const names = new Intl.DisplayNames([loc], { type: 'region' });
  return ISO_REGIONS.filter((c) => !countries[c])
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, loc));
}

/** Seçilebilir para birimleri; artık kullanılmayan (adında yıl geçen) birimler listelenmez. */
export function currencyOptions(locale: string): { code: string; name: string }[] {
  const loc = numberLocale(locale);
  const names = new Intl.DisplayNames([loc], { type: 'currency' });
  return Intl.supportedValuesOf('currency')
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .filter((c) => !/\d{4}/.test(c.name) && c.name !== c.code)
    .sort((a, b) => a.name.localeCompare(b.name, loc));
}

type Tree = { [k: string]: string | Tree };

function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const cur = out[k];
    out[k] = typeof v === 'object' && typeof cur === 'object' ? merge(cur, v) : v;
  }
  return out;
}

/**
 * Genel modda ülkeye özgü terimler (KDV, SGK, stopaj) ve "örnek" sözü yerine geçen metinler.
 * Geçersiz kılınacak metinler `genericTerms` altında, asıl yapının aynısıyla durur.
 */
export function withGenericTerms<T extends object>(messages: T): T {
  const tree = messages as unknown as Tree;
  return merge(tree, tree.genericTerms as Tree) as unknown as T;
}

export const messagesFor = <T extends object>(messages: T, country: string): T =>
  isGeneric(country) ? withGenericTerms(messages) : messages;
