// Mevzuat yol haritası: dosya kaydı, birleştirme ve CI doğrulama kuralları (SPEC-legal §2, §4).
import trBarber from '../legal/TR/barber.json';
import trCoffee from '../legal/TR/coffee.json';
import trCommon from '../legal/TR/common.json';
import usCommon from '../legal/US/common.json';
import usNyc from '../legal/US/regions/US-NY-NYC.json';
import usAustin from '../legal/US/regions/US-TX-AUSTIN.json';
import { LegalFileSchema, type LegalFile, type LegalItem } from './schema';

/** Yol: packages/archetypes/ altına göre. Yeni dosya buraya da eklenir (legal:check denetler). */
export const legalFiles: Readonly<Record<string, LegalFile>> = {
  'legal/TR/common.json': LegalFileSchema.parse(trCommon),
  'legal/TR/coffee.json': LegalFileSchema.parse(trCoffee),
  'legal/TR/barber.json': LegalFileSchema.parse(trBarber),
  'legal/US/common.json': LegalFileSchema.parse(usCommon),
  'legal/US/regions/US-NY-NYC.json': LegalFileSchema.parse(usNyc),
  'legal/US/regions/US-TX-AUSTIN.json': LegalFileSchema.parse(usAustin),
};

const appliesToSector = (item: LegalItem, sector: string) =>
  item.appliesTo.sectors === 'all' || item.appliesTo.sectors.includes(sector);

/**
 * common → sector → region; aynı id sonradan gelenle geçersiz kılınır, `removed: true` kaldırır.
 * `files` verilmezse paketteki kayıt kullanılır.
 */
export function mergeLegal(
  country: string,
  sector: string,
  region?: string,
  files: Readonly<Record<string, LegalFile>> = legalFiles,
): LegalItem[] {
  const list = Object.values(files).filter((f) => f.country === country);
  const layers = [
    ...list.filter((f) => f.scope === 'common'),
    ...list.filter((f) => f.scope === sector),
    ...list.filter((f) => f.scope === 'region' && f.region === region),
  ];
  const byId = new Map<string, LegalItem>();
  for (const f of layers)
    for (const item of f.items) {
      byId.delete(item.id);
      if (!item.removed) byId.set(item.id, item);
    }
  return [...byId.values()].filter((item) => appliesToSector(item, sector));
}

export interface LegalIssue {
  level: 'error' | 'warning';
  rule: string;
  file?: string;
  itemId?: string;
  message: string;
}

export interface LegalCheckOptions {
  /** Production derlemesi: taslak madde ve boş kaynak hata olur (§4.1–4.2). */
  production: boolean;
  /** Bugünün tarihi (YYYY-MM-DD); motor dışı kod verir. */
  today: string;
  fullCountries: string[];
  sectors: string[];
  files?: Readonly<Record<string, LegalFile>>;
}

const monthsBetween = (from: string, to: string) => {
  const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split('-').map(Number) as [number, number, number];
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

function findCycle(items: LegalItem[]): string[] | null {
  const deps = new Map(items.map((i) => [i.id, i.dependsOn]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'visiting') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'visiting');
    stack.push(id);
    for (const d of deps.get(id) ?? []) {
      const c = visit(d);
      if (c) return c;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };
  for (const id of deps.keys()) {
    const c = visit(id);
    if (c) return c;
  }
  return null;
}

/** SPEC-legal §4'teki CI kuralları. */
export function checkLegal(opts: LegalCheckOptions): LegalIssue[] {
  const files = opts.files ?? legalFiles;
  const issues: LegalIssue[] = [];

  for (const [file, f] of Object.entries(files)) {
    const full = opts.fullCountries.includes(f.country);
    // Katmanlar arası aynı id geçersiz kılmadır (§2); aynı dosyada tekrar ise hatadır.
    const seen = new Set<string>();
    for (const item of f.items) {
      const ctx = { file, itemId: item.id };
      if (seen.has(item.id))
        issues.push({ level: 'error', rule: 'unique-id', ...ctx, message: 'Aynı dosyada tekrarlanan id' });
      seen.add(item.id);
      if (!item.id.startsWith(`${f.country.toLowerCase()}.`))
        issues.push({ level: 'error', rule: 'id-prefix', ...ctx, message: `id ülke koduyla başlamalı` });

      // §4.1 Taslak madde production'a çıkamaz.
      if (full && item.verification.status === 'draft')
        issues.push({
          level: opts.production ? 'error' : 'warning',
          rule: 'no-draft-in-production',
          ...ctx,
          message: 'Taslak — doğrulanmadı',
        });
      // §4.2 Yayındaki her maddenin resmi kaynağı olur.
      if (full && item.sourceUrl === '')
        issues.push({
          level: opts.production ? 'error' : 'warning',
          rule: 'source-url',
          ...ctx,
          message: 'sourceUrl boş',
        });
      if (item.verification.status === 'verified' && !item.verification.reviewedBy)
        issues.push({
          level: 'error',
          rule: 'reviewed-by',
          ...ctx,
          message: 'Doğrulanmış maddede reviewedBy boş olamaz',
        });
      // §4.3 Güncellik.
      const age = monthsBetween(item.verification.lastReviewed, opts.today);
      if (age >= 12)
        issues.push({
          level: 'warning',
          rule: 'stale-12m',
          ...ctx,
          message: 'Güncelliği doğrulanmadı (12 aydan eski)',
        });
      else if (age >= 6)
        issues.push({ level: 'warning', rule: 'stale-6m', ...ctx, message: 'Son kontrol 6 aydan eski' });
    }
  }

  // §4.4 ve §4.5: birleştirilmiş listeler üzerinden.
  for (const country of opts.fullCountries) {
    const regions = [
      undefined,
      ...Object.values(files)
        .filter((f) => f.country === country && f.scope === 'region')
        .map((f) => f.region),
    ];
    for (const sector of opts.sectors) {
      for (const region of regions) {
        const merged = mergeLegal(country, sector, region, files);
        const ids = new Set(merged.map((i) => i.id));
        const where = `${country}/${sector}${region ? `/${region}` : ''}`;
        for (const item of merged)
          for (const dep of item.dependsOn)
            if (!ids.has(dep))
              issues.push({
                level: 'error',
                rule: 'depends-on',
                itemId: item.id,
                message: `${where}: bilinmeyen bağımlılık ${dep}`,
              });
        const cycle = findCycle(merged);
        if (cycle)
          issues.push({ level: 'error', rule: 'no-cycle', message: `${where}: döngü ${cycle.join(' → ')}` });
        if (region === undefined && !merged.some((i) => i.critical))
          issues.push({
            level: 'error',
            rule: 'critical-item',
            message: `${where}: en az bir kritik madde olmalı`,
          });
      }
    }
  }
  return issues;
}
