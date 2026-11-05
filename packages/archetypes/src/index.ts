// Sektör ve ülke ayarlarının kaydı; motora giden yapıların üretimi.
// Ülkeye göre davranış sadece ülke dosyasındaki alanlardan gelir (CLAUDE.md kural 13).
import type { AnalysisInput, EngineArchetype, EngineCountry, FinParams } from '@bitm/engine';
import analysisDefaultsJson from '../analysis-defaults.json';
import genericJson from '../countries/GENERIC.json';
import trJson from '../countries/TR.json';
import usJson from '../countries/US.json';
import barberJson from '../sectors/barber.json';
import coffeeJson from '../sectors/coffee.json';
import {
  AnalysisDefaultsSchema,
  commonChecklist,
  commonResearchChecks,
  CountrySchema,
  FinSchema,
  SectorSchema,
  type ChecklistItem,
  type Country,
  type Fin,
  type ResearchCheck,
  type ResearchGroup,
  type Sector,
} from './schema';

export * from './schema';
export * from './legal';

export const sectors: Readonly<Record<string, Sector>> = {
  coffee: SectorSchema.parse(coffeeJson),
  barber: SectorSchema.parse(barberJson),
};

export const countries: Readonly<Record<string, Country>> = {
  TR: CountrySchema.parse(trJson),
  US: CountrySchema.parse(usJson),
};

export const genericCountry: Country = CountrySchema.parse(genericJson);
export const checklist = commonChecklist;
export const analysisDefaults = AnalysisDefaultsSchema.parse(analysisDefaultsJson);

export function getSector(id: string): Sector {
  const s = sectors[id];
  if (!s) throw new Error(`Bilinmeyen sektör: ${id}`);
  return s;
}

/** Listede olmayan her ülke GENERIC şablonunu kullanır. */
export function getCountry(code: string): Country {
  return countries[code] ?? genericCountry;
}

/** Rakip kartındaki kontrol listesi: sektörün grupları sırasıyla, ortak maddeler ve sektörün eklediği maddeler. */
export function researchChecks(sector: Sector): { group: ResearchGroup; checks: ResearchCheck[] }[] {
  const all = [...commonResearchChecks, ...sector.research.checks];
  return sector.research.groups.map((group) => ({ group, checks: all.filter((c) => c.group === group) }));
}

/** Para biriminin ondalık hanesi yoksa 1, varsa 0,25 (generic ülkeler için). */
export function priceRoundingForCurrency(currency: string): number {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  return digits === 0 ? 1 : 0.25;
}

export function engineCountry(code: string, currency?: string): EngineCountry {
  const c = getCountry(code);
  const cur = currency ?? c.currency;
  const priceRounding = c.priceRounding ?? (cur ? priceRoundingForCurrency(cur) : 1);
  return { code: c.code, priceRounding };
}

/** Sektörün son kontrol listesi: ortak liste − `checklist.remove` + `checklist.add` (SPEC-archetypes §2.1). */
export function sectorChecklist(s: Sector): ChecklistItem[] {
  const remove = s.checklist?.remove ?? [];
  return [
    ...checklist.groups.flatMap((g) => g.items).filter((it) => !remove.includes(it.k)),
    ...(s.checklist?.add ?? []),
  ];
}

/** Ülkenin doğrulanmış taban fiyatları (kalem anahtarı → taban); yoksa boş (SPEC-calc-engine §12.1). */
export function priceFloors(s: Sector, countryCode: string): Record<string, number> {
  return s.defaults[getCountry(countryCode).code]?.priceFloors?.items ?? {};
}

export function engineArchetype(id: string): EngineArchetype {
  return toEngineArchetype(getSector(id));
}

export function toEngineArchetype(s: Sector): EngineArchetype {
  return {
    id: s.id,
    model: s.model,
    competition: {
      saturationPeoplePerBusiness: s.competition.saturationPeoplePerBusiness,
      qualityWeaknessKeys: s.competition.qualityWeaknessKeys,
      overpricedWeaknessKey: s.competition.overpricedWeaknessKey,
    },
    demandFit: { features: s.demandFit.features },
    location: {
      captureRatePct: s.location.captureRatePct,
      rentToSalesPct: s.location.rentToSalesPct,
      footTraffic: s.location.footTraffic,
    },
    checklist: sectorChecklist(s).map((it) => ({ k: it.k, critical: it.critical, blocker: it.blocker })),
  };
}

/** Birleştirme sırası: ülke.fin → sektör.defaults[ülke].fin → kullanıcı girdisi (SPEC-archetypes §3). */
export function mergeFin(countryCode: string, sectorId: string, user: Partial<Fin> = {}): Fin {
  const c = getCountry(countryCode);
  const sectorFin = getSector(sectorId).defaults[c.code]?.fin ?? {};
  return FinSchema.parse({ ...c.fin, ...sectorFin, ...user });
}

/** Kullanıcı doldurana kadar eksik kalan fin alanları ("eksik veri" uyarısı için). */
export function missingFinFields(fin: Fin): (keyof Fin)[] {
  return (Object.keys(fin) as (keyof Fin)[]).filter((k) => fin[k] === null);
}

/**
 * Sektörün örnek verisinden ("Videodaki örneği yükle") tam analiz girdisi kurar.
 * Satırlar şablondaki açık `type` / `depreciable` / `kind` alanlarını ve ülkenin taban fiyatlarını taşır.
 */
export function buildSampleInput(sectorId: string, sampleId: string): AnalysisInput {
  const s = getSector(sectorId);
  const sample = s.samples[sampleId];
  if (!sample) throw new Error(`${sectorId}: örnek yok: ${sampleId}`);
  const d = analysisDefaults;
  const fin: FinParams = mergeFin(sample.country, sectorId);
  const chk = Object.fromEntries(sectorChecklist(s).map((it) => [it.k, it.sampleAnswer]));
  const floors = priceFloors(s, sample.country);
  return {
    biz: s.id,
    city: sampleId,
    cur: sample.currency,
    fin,
    contPct: d.contPct,
    wcMonths: d.wcMonths,
    days: sample.days,
    scen: [...sample.scen],
    cap: sample.cap ? [...sample.cap] : null,
    capex: s.capexTemplate.map((t) => ({
      k: t.k,
      n: null,
      v: sample.capex[t.k] ?? 0,
      ...(t.depreciable !== undefined ? { depreciable: t.depreciable } : {}),
    })),
    fixed: s.fixedTemplate.map((t) => ({ k: t.k, n: null, v: sample.fixed[t.k] ?? 0, type: t.type })),
    items: s.itemTemplate.map((t) => ({
      k: t.k,
      n: null,
      ...(sample.items[t.k] ?? { price: 0, cost: 0, mix: 0 }),
      ...(t.kind !== undefined ? { kind: t.kind } : {}),
      ...(floors[t.k] !== undefined ? { minPrice: floors[t.k] } : {}),
    })),
    area: sample.area,
    pop: sample.pop,
    demo: { ...sample.demo, turnout: '', elec: '' },
    loc: {
      foot: { wd: [...sample.loc.foot.wd], we: [...sample.loc.foot.we] },
      countMin: d.countMin,
      openH: sample.loc.openH,
      hist: { ...sample.loc.hist, talked: false },
      founder: {
        role: d.founder.role,
        mgr: sample.loc.mgr,
        years: d.founder.years,
        runway: d.founder.runway,
        equity: d.founder.equity,
      },
      chk,
    },
    comp: sample.comp.map((c) => ({ ...c, n: null, s: [...c.s], w: [...c.w], note: '' })),
  };
}

/**
 * Genel mod: örnek veri olmadan boş girdi. Sadece sektörün yapısı (kalem adları, türler, kapasite, çalışma
 * düzeni) ve ülkeden bağımsız yöntem varsayılanları kalır; tutar, oran ve bölge bilgisi kullanıcıdan gelir.
 * Satış payları eşit başlar. Çalışma günü sektörün işleyişidir, sektörün her örneğinde aynıdır.
 */
export function buildBlankInput(sectorId: string, countryCode: string, currency: string): AnalysisInput {
  const s = getSector(sectorId);
  const d = analysisDefaults;
  const count = s.itemTemplate.length;
  const mix = Math.floor(100 / count);
  return {
    biz: s.id,
    city: '',
    cur: currency,
    fin: mergeFin(countryCode, sectorId),
    contPct: d.contPct,
    wcMonths: d.wcMonths,
    days: Object.values(s.samples)[0]?.days ?? null,
    scen: [0, 0, 0],
    cap: s.capacity
      ? [s.capacity.defaults.stations, s.capacity.defaults.hours, s.capacity.defaults.serviceMin]
      : null,
    capex: s.capexTemplate.map((t) => ({
      k: t.k,
      n: null,
      v: null,
      ...(t.depreciable !== undefined ? { depreciable: t.depreciable } : {}),
    })),
    fixed: s.fixedTemplate.map((t) => ({ k: t.k, n: null, v: null, type: t.type })),
    items: s.itemTemplate.map((t, i) => ({
      k: t.k,
      n: null,
      price: null,
      cost: null,
      mix: i === 0 ? 100 - mix * (count - 1) : mix,
      ...(t.kind !== undefined ? { kind: t.kind } : {}),
    })),
    area: '',
    pop: null,
    demo: {
      inc: null,
      incCity: null,
      a1: null,
      a2: null,
      a3: null,
      hh: null,
      day: null,
      turnout: '',
      elec: '',
    },
    loc: {
      foot: { wd: [0, 0, 0], we: [0, 0, 0] },
      countMin: d.countMin,
      openH: null,
      hist: { turnover: null, reason: 'unknown', closures: null, talked: false },
      founder: {
        role: d.founder.role,
        mgr: null,
        years: d.founder.years,
        runway: d.founder.runway,
        equity: d.founder.equity,
      },
      chk: {},
    },
    comp: [],
  };
}

/** Örnek kimliğinden ülke kodu (golden fixture'daki `city` alanı için). */
export function sampleCountry(sectorId: string, sampleId: string): string {
  const sample = getSector(sectorId).samples[sampleId];
  if (!sample) throw new Error(`${sectorId}: örnek yok: ${sampleId}`);
  return sample.country;
}

export { ISO_REGIONS } from './regions';
