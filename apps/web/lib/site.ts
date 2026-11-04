// Dükkân önü kaydı (SPEC-ai §3.1, SPEC-architecture §5.8): konum okuması ve Claude incelemesi.
// Kayıt motora ve puana girmez; incelemeden veriye yalnız kullanıcı "Uygula" deyince bir şey geçer.
import { z } from 'zod';
import { FRAME_SLOTS, PALETTE_KEYS, STYLE_KEYS, StorefrontInspection } from '@bitm/ai/schema';
import type { ProjectDoc } from './project';

/** Bundan kötü doğrulukta kullanıcıya açık alanda yeniden denemesi önerilir. */
export const POOR_ACCURACY_M = 100;

export const Checkin = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0),
  capturedAt: z.string().max(40),
});
export type Checkin = z.infer<typeof Checkin>;

export const SiteCheck = z.object({
  checkin: Checkin.optional(),
  inspection: z
    .object({
      result: StorefrontInspection,
      at: z.string().max(40),
      slots: z.array(z.enum(FRAME_SLOTS)).max(FRAME_SLOTS.length),
    })
    .optional(),
});
export type SiteCheck = z.infer<typeof SiteCheck>;

export const isPoorAccuracy = (c: Checkin) => c.accuracyM > POOR_ACCURACY_M;

export const mapUrl = (c: Checkin) =>
  `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=19/${c.lat}/${c.lng}`;

export type Suggestion =
  | { kind: 'chk'; key: 'visible' | 'access' | 'anchor'; value: 0 | 1 }
  | { kind: 'style'; value: number }
  | { kind: 'palette'; value: number }
  | { kind: 'awning'; value: boolean }
  | { kind: 'comp'; name: string; note: string };

/** Uygulanabilir öneriler. Bilinmeyen (null) alan öneri olmaz; sektörün listesinde olmayan madde de. */
export function suggestionsFrom(r: StorefrontInspection, checklistKeys: readonly string[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const key of ['visible', 'access', 'anchor'] as const) {
    const v = r[key];
    if (v !== null && checklistKeys.includes(key)) out.push({ kind: 'chk', key, value: v ? 1 : 0 });
  }
  if (r.facade.style) out.push({ kind: 'style', value: STYLE_KEYS.indexOf(r.facade.style) });
  if (r.facade.palette) out.push({ kind: 'palette', value: PALETTE_KEYS.indexOf(r.facade.palette) });
  if (r.facade.awning !== null) out.push({ kind: 'awning', value: r.facade.awning });
  for (const n of r.neighbors)
    if (n.sameSector === true) out.push({ kind: 'comp', name: n.name ?? n.type, note: n.type });
  return out;
}

export function isApplied(doc: ProjectDoc, s: Suggestion): boolean {
  switch (s.kind) {
    case 'chk':
      return doc.input.loc.chk[s.key] === s.value;
    case 'style':
      return doc.shop.style === s.value;
    case 'palette':
      return doc.shop.palette === s.value;
    case 'awning':
      return doc.shop.awning === s.value;
    case 'comp':
      return doc.input.comp.some((c) => c.n === s.name);
  }
}

export function applySuggestion(d: ProjectDoc, s: Suggestion): void {
  switch (s.kind) {
    case 'chk':
      d.input.loc.chk[s.key] = s.value;
      break;
    case 'style':
      d.shop.style = s.value;
      break;
    case 'palette':
      d.shop.palette = s.value;
      break;
    case 'awning':
      d.shop.awning = s.value;
      break;
    case 'comp':
      d.input.comp.push({
        k: null,
        n: s.name,
        dist: 0,
        price: 0,
        rating: 0,
        reviews: 0,
        s: [],
        w: [],
        note: s.note,
      });
      break;
  }
}
