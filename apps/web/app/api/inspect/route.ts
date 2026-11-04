// Dış cephe incelemesi (SPEC-ai §3.1). Kareler tarayıcıda yüzleri kapatılarak gelir ve burada saklanmaz.
// Şema bilinmeyen alanı reddeder, böylece koordinat bu isteğe giremez (SPEC-architecture §5.8).
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FRAME_SLOTS, inspectStorefront } from '@bitm/ai';
import { getSector } from '@bitm/archetypes';
import { routing } from '../../../i18n/routing';
import { MAX_BODY_CHARS } from '../../../lib/frames';
import { IS_RELEASE } from '../../../lib/permits';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DATA_PREFIX = 'data:image/jpeg;base64,';

const Body = z.strictObject({
  locale: z.enum(routing.locales),
  sector: z.string().max(40),
  area: z.string().max(200),
  consent: z.literal(true),
  frames: z
    .array(
      z.strictObject({
        slot: z.enum(FRAME_SLOTS),
        data: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
      }),
    )
    .min(1)
    .max(FRAME_SLOTS.length)
    .refine((f) => new Set(f.map((x) => x.slot)).size === f.length),
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  // Kullanıcı başına limit (İP-1.1) gelene kadar yayın derlemesinde kapalı: harcaması sınırsız bir uç açılmaz.
  if (IS_RELEASE) return fail('not_available', 503);

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return fail('too_large', 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('invalid', 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail('invalid', 400);
  const { locale, sector: sectorId, area, frames } = parsed.data;

  let sector;
  try {
    sector = getSector(sectorId);
  } catch {
    return fail('invalid', 400);
  }

  const model = process.env.AI_MODEL_VISION;
  if (!model || !process.env.ANTHROPIC_API_KEY) return fail('not_configured', 503);

  try {
    const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
    const out = await inspectStorefront(client, {
      model,
      locale,
      businessNoun: sector.name.en,
      area,
      marketingRestricted: sector.regulated?.marketingRestricted ?? false,
      frames: frames.map((f) => ({ slot: f.slot, base64: f.data.slice(DATA_PREFIX.length) })),
    });
    if (!out.ok) return fail(out.error, 502);
    // usage_events (İP-2.6) gelene kadar maliyet izi; görsel ve kullanıcı metni yazılmaz.
    console.info('ai_called', JSON.stringify({ kind: 'ext', model, frames: frames.length, ...out.usage }));
    return NextResponse.json({ result: out.result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail('busy', 429);
    if (e instanceof Anthropic.APIError) {
      console.error('inceleme başarısız', e.status);
      return fail('upstream', 502);
    }
    console.error('inceleme başarısız', e);
    return fail('upstream', 502);
  }
}
