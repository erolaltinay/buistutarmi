// PDF rapor: girdi tarayıcıdan gelir (proje şimdilik orada durur), hesap ve dizgi sunucuda yapılır
// (SPEC-architecture §5.6). İP-1.1'de proje veritabanından okunur ve `reports`'a yazılır.
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { z } from 'zod';
import { renderReport } from '@bitm/pdf';
import { routing } from '../../../i18n/routing';
import { MAX_CANDIDATES } from '../../../lib/compare';
import { IS_RELEASE, PERMIT_STATUSES } from '../../../lib/permits';
import type { ProjectDoc } from '../../../lib/project';
import { buildReport, reportFilename } from '../../../lib/report';
import type { Translate } from '../../../lib/verdict-text';

export const runtime = 'nodejs';

const MAX_BODY = 4_000_000;
const MAX_ROWS = 200;

const Input = z.looseObject({
  cur: z.string().length(3),
  area: z.string().max(200),
  capex: z.array(z.unknown()).max(MAX_ROWS),
  fixed: z.array(z.unknown()).max(MAX_ROWS),
  items: z.array(z.unknown()).max(MAX_ROWS),
  comp: z.array(z.looseObject({ s: z.array(z.string()), w: z.array(z.string()) })).max(MAX_ROWS),
});

const Permits = z.record(z.string(), z.looseObject({ status: z.enum(PERMIT_STATUSES) }));

const Body = z.object({
  locale: z.enum(routing.locales),
  options: z.object({ monthly: z.boolean(), cmp: z.boolean(), shop: z.boolean() }),
  shopImage: z
    .string()
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  doc: z.looseObject({
    v: z.literal(1),
    id: z.string(),
    sector: z.string(),
    country: z.string(),
    input: Input,
    permits: Permits.optional(),
    candidates: z
      .array(z.looseObject({ name: z.string().max(100), input: Input }))
      .max(MAX_CANDIDATES)
      .optional(),
  }),
});

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { locale, options, shopImage } = parsed.data;
  const doc = parsed.data.doc as unknown as ProjectDoc;

  try {
    const messages = (await import(`../../../messages/${locale}.json`)).default;
    const t = createTranslator({ locale, messages }) as unknown as Translate;
    const model = buildReport({
      doc,
      locale,
      t,
      options,
      ...(shopImage ? { shopImage } : {}),
      today: new Date(),
      release: IS_RELEASE,
    });
    const pdf = await renderReport(model, { fontDir: join(process.cwd(), '../../packages/pdf/fonts') });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reportFilename(doc)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('rapor üretilemedi', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
