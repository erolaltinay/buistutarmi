// Sektör, ülke, kontrol listesi ve mevzuat dosyalarının zod şemaları.
// Kaynak: docs/SPEC-archetypes.md, docs/SPEC-legal.md §3.
import { z } from 'zod';
import { parseExpr } from '@bitm/engine';
import checklistJson from '../checklist.json';

export const Localized = z.object({ tr: z.string().min(1), en: z.string().min(1) });
const Pair = z.tuple([z.number(), z.number()]);
const IncreasingPair = Pair.refine(([a, b]) => a <= b, 'İlk eşik ikinciden büyük olamaz');
const Triple = z.tuple([z.number(), z.number(), z.number()]);
const Key = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);

const Expr = z.string().superRefine((src, ctx) => {
  try {
    parseExpr(src);
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: `Geçersiz ifade: ${(e as Error).message}` });
  }
});

export const FinSchema = z.object({
  rampStart: z.number().nullable(),
  rampMonths: z.number().nullable(),
  priceInc: z.number().nullable(),
  inflCost: z.number().nullable(),
  rentInc: z.number().nullable(),
  wageInc: z.number().nullable(),
  ownerSalary: z.number().nullable(),
  kdv: z.number().nullable(),
  cardShare: z.number().nullable(),
  cardFee: z.number().nullable(),
  platShare: z.number().nullable(),
  platFee: z.number().nullable(),
  waste: z.number().nullable(),
  stopaj: z.number().nullable(),
  employer: z.number().nullable(),
  profitTax: z.number().nullable(),
  loanRate: z.number().nullable(),
  loanTerm: z.number().nullable(),
  depYears: z.number().nullable(),
});
export type Fin = z.infer<typeof FinSchema>;
export const FIN_KEYS = Object.keys(FinSchema.shape) as (keyof Fin)[];

const Sample = z.object({
  country: z.string(),
  currency: z.string().length(3),
  area: z.string(),
  pop: z.number(),
  days: z.number(),
  scen: Triple,
  cap: Triple.nullable(),
  demo: z.object({
    inc: z.number(),
    incCity: z.number(),
    a1: z.number(),
    a2: z.number(),
    a3: z.number(),
    hh: z.number(),
    day: z.number(),
  }),
  capex: z.record(z.string(), z.number()),
  fixed: z.record(z.string(), z.number()),
  items: z.record(z.string(), z.object({ price: z.number(), cost: z.number(), mix: z.number() })),
  comp: z.array(
    z.object({
      k: z.string(),
      dist: z.number(),
      price: z.number(),
      rating: z.number(),
      reviews: z.number(),
      s: z.array(z.string()),
      w: z.array(z.string()),
    }),
  ),
  loc: z.object({
    foot: z.object({ wd: Triple, we: Triple }),
    openH: z.number(),
    mgr: z.number(),
    hist: z.object({
      turnover: z.number(),
      reason: z.enum(['unknown', 'grew', 'personal', 'rent', 'noProfit']),
      closures: z.number(),
    }),
  }),
});

const ChecklistItemSchema = z.object({
  k: Key,
  critical: z.boolean(),
  blocker: z.boolean(),
  /** null: etiket sektöre göre değişir (sector.location.checklistOverrides). */
  label: Localized.nullable(),
  flag: Localized.optional(),
  sampleAnswer: z.union([z.literal(1), z.literal(0), z.null()]),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistSchema = z.object({
  groups: z.array(z.object({ label: Localized, items: z.array(ChecklistItemSchema) })),
});
export type Checklist = z.infer<typeof ChecklistSchema>;

/** Ortak kontrol listesi; sektör dosyasının liste farkı (§2.1) buna göre doğrulanır. */
export const commonChecklist: Checklist = ChecklistSchema.parse(checklistJson);
const commonItems = commonChecklist.groups.flatMap((g) => g.items);

/** SPEC-archetypes §2.1: taban fiyatlar mevzuat maddesi gibi kaynaklı ve doğrulanmış olur (legal:check). */
export const PriceFloorsSchema = z.object({
  sourceUrl: z.url().or(z.literal('')),
  lastReviewed: z.iso.date(),
  reviewedBy: z.string().optional(),
  /** Kalem anahtarı → taban fiyat (ülke para biriminde). */
  items: z.record(Key, z.number().nonnegative()),
});
export type PriceFloors = z.infer<typeof PriceFloorsSchema>;

export const SectorSchema = z
  .object({
    id: Key,
    version: z.number().int().positive(),
    model: z.enum(['product', 'service', 'hybrid']),
    name: Localized,
    unit: z.object({ tr: z.tuple([z.string(), z.string()]), en: z.tuple([z.string(), z.string()]) }),
    googlePlaceTypes: z.array(z.string()).min(1),
    osmTags: z.array(z.record(z.string(), z.string())).min(1),
    siteRequirements: z
      .object({
        minM2: z.number().nullable(),
        maxM2: z.number().nullable(),
        groundFloor: z.boolean().nullable(),
        hood: z.boolean().nullable(),
        water: z.boolean().nullable(),
      })
      .nullable(),
    requiresCertificate: z.string().nullable(),
    /** Ruhsatı meslek lisansına bağlı, reklamı kısıtlı meslekler (§2.1). */
    regulated: z.object({ profession: Key, marketingRestricted: z.boolean() }).optional(),
    capexTemplate: z.array(
      z.object({
        k: Key,
        type: z.enum(['equipment', 'furniture', 'buildout', 'inventory', 'permit', 'other']),
        depreciable: z.boolean().optional(),
        label: Localized,
      }),
    ),
    fixedTemplate: z.array(z.object({ k: Key, type: z.enum(['rent', 'staff', 'other']), label: Localized })),
    itemTemplate: z
      .array(
        z.object({
          k: Key,
          signature: z.boolean().optional(),
          /** hybrid'de zorunlu (SPEC-calc-engine §6 svcShare). */
          kind: z.enum(['product', 'service']).optional(),
          label: Localized,
        }),
      )
      .min(1),
    capacity: z
      .object({ defaults: z.object({ stations: z.number(), hours: z.number(), serviceMin: z.number() }) })
      .nullable(),
    competition: z.object({
      saturationPeoplePerBusiness: IncreasingPair,
      qualityWeaknessKeys: z.array(z.string()).min(1),
      overpricedWeaknessKey: z.string(),
      tags: z.object({
        strengths: z.record(z.string(), Localized),
        weaknesses: z.record(z.string(), Localized.extend({ tactic: Localized.optional() })),
      }),
      sampleCompetitorNames: z.record(z.string(), Localized),
    }),
    demandFit: z.object({
      features: z.array(z.object({ key: Key, weight: z.number().positive(), expr: Expr })).min(1),
    }),
    location: z.object({
      captureRatePct: IncreasingPair,
      rentToSalesPct: IncreasingPair,
      /** SPEC-calc-engine §10.1; randevulu mesleklerde `info`. */
      footTraffic: z.enum(['scored', 'info']).default('scored'),
      checklistOverrides: z.record(z.string(), Localized),
    }),
    /** Ortak kontrol listesine göre fark (§2.1); engel maddeler çıkarılamaz. */
    checklist: z
      .object({
        remove: z.array(Key).default([]),
        add: z.array(ChecklistItemSchema.extend({ label: Localized })).default([]),
      })
      .optional(),
    defaults: z.record(
      z.string(),
      z.object({
        sample: z.string().nullable(),
        fin: FinSchema.partial(),
        priceFloors: PriceFloorsSchema.optional(),
      }),
    ),
    samples: z.record(z.string(), Sample),
    ai: z.object({ businessNoun: Localized, promptHints: z.string().optional() }),
    storefront: z.object({
      sampleName: z.string(),
      /** Cephe taslağında vitrindeki simge ve berber direği (SPEC-archetypes §2). */
      decal: z.enum(['cup', 'scissors', 'none']).default('none'),
      pole: z.boolean().default(false),
    }),
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message: `${s.id}: ${message}` });
    const weights = s.demandFit.features.reduce((a, f) => a + f.weight, 0);
    if (weights !== 100) issue(`talep uyumu ağırlıkları toplamı 100 olmalı (${weights})`);
    if (s.model === 'product' && s.capacity) issue('product arketipinde kapasite olmaz');
    if (s.model !== 'product' && !s.capacity) issue('hizmet arketipinde kapasite varsayılanı gerekli');
    if (s.itemTemplate[0]?.signature !== true) issue('ilk ürün/hizmet imza kalemi olmalı');
    if (s.regulated && s.requiresCertificate !== s.regulated.profession)
      issue('regulated.profession requiresCertificate ile aynı olmalı');

    // Kalem türü: hybrid'de zorunlu; diğer modellerde modelle çelişemez.
    if (s.model === 'hybrid') {
      if (s.itemTemplate.some((t) => !t.kind)) issue('hybrid arketipte her kalemin kind alanı olmalı');
      if (!s.itemTemplate.some((t) => t.kind === 'service'))
        issue('hybrid arketipte en az bir hizmet kalemi olmalı');
    } else if (s.itemTemplate.some((t) => t.kind && t.kind !== s.model))
      issue(`${s.model} arketipinde kalem türü modelle aynı olmalı`);

    // Kontrol listesi farkı (§2.1) ve sektöre göre değişen etiketler.
    const remove = s.checklist?.remove ?? [];
    const add = s.checklist?.add ?? [];
    for (const k of remove) {
      const common = commonItems.find((i) => i.k === k);
      if (!common) issue(`checklist.remove: ortak listede yok: ${k}`);
      else if (common.blocker) issue(`checklist.remove: engel madde çıkarılamaz: ${k}`);
    }
    const addKeys = add.map((i) => i.k);
    for (const k of addKeys)
      if (commonItems.some((i) => i.k === k) || addKeys.indexOf(k) !== addKeys.lastIndexOf(k))
        issue(`checklist.add: anahtar ortak listede veya tekrarlı: ${k}`);
    const needsLabel = commonItems
      .filter((i) => i.label === null && !remove.includes(i.k))
      .map((i) => i.k)
      .sort()
      .join(',');
    if (Object.keys(s.location.checklistOverrides).sort().join(',') !== needsLabel)
      issue(`location.checklistOverrides tam olarak şu maddeleri içermeli: ${needsLabel || '(yok)'}`);
    const weak = Object.keys(s.competition.tags.weaknesses);
    for (const k of [...s.competition.qualityWeaknessKeys, s.competition.overpricedWeaknessKey])
      if (!weak.includes(k)) issue(`zayıflık etiketi tanımlı değil: ${k}`);
    const itemKeys = s.itemTemplate.map((t) => t.k);
    for (const [country, d] of Object.entries(s.defaults)) {
      if (d.sample !== null && s.samples[d.sample]?.country !== country)
        issue(`defaults.${country}.sample bu ülkeye ait bir örnek değil`);
      for (const k of Object.keys(d.priceFloors?.items ?? {}))
        if (!itemKeys.includes(k)) issue(`defaults.${country}.priceFloors: şablonda olmayan kalem ${k}`);
    }
    const keys = (rows: { k: string }[]) =>
      rows
        .map((r) => r.k)
        .sort()
        .join(',');
    for (const [id, sample] of Object.entries(s.samples)) {
      if (keys(s.capexTemplate) !== Object.keys(sample.capex).sort().join(','))
        issue(`samples.${id}.capex şablonla aynı anahtarlara sahip olmalı`);
      if (keys(s.fixedTemplate) !== Object.keys(sample.fixed).sort().join(','))
        issue(`samples.${id}.fixed şablonla aynı anahtarlara sahip olmalı`);
      if (keys(s.itemTemplate) !== Object.keys(sample.items).sort().join(','))
        issue(`samples.${id}.items şablonla aynı anahtarlara sahip olmalı`);
      for (const c of sample.comp) {
        for (const t of c.s)
          if (!(t in s.competition.tags.strengths)) issue(`samples.${id}: bilinmeyen güçlü etiket ${t}`);
        for (const t of c.w)
          if (!(t in s.competition.tags.weaknesses)) issue(`samples.${id}: bilinmeyen zayıf etiket ${t}`);
      }
    }
  });
export type Sector = z.infer<typeof SectorSchema>;

export const CountrySchema = z
  .object({
    code: z.string().regex(/^([A-Z]{2}|GENERIC)$/),
    currency: z.string().length(3).nullable(),
    locale: z.string().nullable(),
    supportLevel: z.enum(['full', 'generic']),
    launched: z.boolean(),
    priceRounding: z.number().positive().nullable(),
    pricing: z
      .object({ detailedReport: z.number().positive().nullable(), currency: z.string().length(3) })
      .nullable(),
    legal: z.string().nullable(),
    /** Sektöre bağlı alanlar (kdv, platShare, waste) sektör dosyasından gelir. */
    fin: FinSchema.partial(),
    taxNote: Localized,
    dataSources: z.record(z.string(), z.string().nullable()),
    lastReviewed: z.iso.date(),
  })
  .superRefine((c, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message: `${c.code}: ${message}` });
    if (c.supportLevel === 'full') {
      if (!c.currency || !c.locale || c.priceRounding === null)
        issue('full ülkede para birimi, locale ve yuvarlama dolu olmalı');
      if (!c.legal) issue('full ülkede mevzuat klasörü tanımlı olmalı');
    } else {
      if (c.legal !== null) issue('generic ülkede mevzuat listesi olmaz');
      if (Object.keys(c.dataSources).length) issue('generic ülkede otomatik veri kaynağı olmaz');
    }
  });
export type Country = z.infer<typeof CountrySchema>;

export const AnalysisDefaultsSchema = z.object({
  contPct: z.number(),
  wcMonths: z.number(),
  countMin: z.number(),
  founder: z.object({
    role: z.enum(['full', 'part', 'investor']),
    years: z.number(),
    runway: z.number(),
    equity: z.number(),
  }),
});

// ---------- Mevzuat (SPEC-legal §3) ----------

export const LegalItemSchema = z.object({
  id: z.string().regex(/^[a-z]{2}\.[a-z0-9_]+\.[a-z0-9_]+$/),
  title: Localized,
  what: Localized,
  authority: Localized,
  sourceUrl: z.url().or(z.literal('')),
  appliesTo: z.object({
    sectors: z.array(z.string()).or(z.literal('all')),
    condition: z
      .enum(['always', 'hasEmployees', 'servesFood', 'outdoorSeating', 'hasSign', 'sellsAlcohol', 'other'])
      .default('always'),
  }),
  stage: z.enum(['before_lease', 'before_opening', 'after_opening']),
  critical: z.boolean(),
  typicalDays: z.tuple([z.number(), z.number()]).nullable(),
  typicalCost: z.object({ min: z.number(), max: z.number(), currency: z.string() }).nullable(),
  dependsOn: z.array(z.string()).default([]),
  verification: z.object({
    status: z.enum(['draft', 'verified']),
    reviewedBy: z.string().optional(),
    lastReviewed: z.iso.date(),
  }),
  notes: Localized.optional(),
  removed: z.boolean().optional(),
});
export type LegalItem = z.infer<typeof LegalItemSchema>;

export const LegalFileSchema = z.object({
  _note: z.string().optional(),
  country: z.string().regex(/^[A-Z]{2}$/),
  /** 'common', 'region' ya da sektör id'si. */
  scope: z.string(),
  region: z.string().optional(),
  items: z.array(LegalItemSchema),
});
export type LegalFile = z.infer<typeof LegalFileSchema>;
