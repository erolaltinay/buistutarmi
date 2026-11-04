// Dış cephe incelemesinin çıktı şeması (SPEC-ai §3.1). İstemci de okur, bu yüzden SDK'dan ayrı dosyada.
import { z } from 'zod';

export const FRAME_SLOTS = ['front', 'left', 'right', 'side'] as const;
export type FrameSlot = (typeof FRAME_SLOTS)[number];

/** Mağaza görseli ekranındaki stil ve palet sırasıyla aynı. */
export const STYLE_KEYS = ['modern', 'wood', 'minimal'] as const;
export const PALETTE_KEYS = ['ink', 'espresso', 'olive', 'white', 'terra'] as const;

export const StorefrontInspection = z.object({
  summary: z.string(),
  visible: z.boolean().nullable(),
  access: z.boolean().nullable(),
  anchor: z.boolean().nullable(),
  corner: z.boolean().nullable(),
  neighbors: z
    .array(
      z.object({
        side: z.enum(['left', 'right', 'opposite', 'unknown']),
        type: z.string(),
        name: z.string().nullable(),
        sameSector: z.boolean().nullable(),
      }),
    )
    .max(8),
  signage: z.object({
    fascia: z.enum(['none', 'limited', 'ample']).nullable(),
    projecting: z.boolean().nullable(),
    windowArea: z.boolean().nullable(),
    obstructions: z.array(z.string()).max(5),
    note: z.string(),
  }),
  facade: z.object({
    condition: z.enum(['good', 'fair', 'poor']).nullable(),
    ideas: z.array(z.object({ idea: z.string(), reason: z.string() })).max(4),
    style: z.enum(STYLE_KEYS).nullable(),
    palette: z.enum(PALETTE_KEYS).nullable(),
    awning: z.boolean().nullable(),
  }),
  strengths: z.array(z.string()).max(5),
  fixes: z.array(z.string()).max(5),
  notVisible: z.array(z.string()).max(6),
});
export type StorefrontInspection = z.infer<typeof StorefrontInspection>;
