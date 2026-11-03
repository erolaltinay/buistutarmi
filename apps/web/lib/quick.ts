// Hızlı mod (İP-1.4): 10 cevap, sektörün o ülkedeki örnek girdisinin üzerine yazılır.
// Cevaplanmayan her şey (rakipler, bölge, yaya, kontrol listesi, vergiler) örnekten gelir;
// sonuç ekranı bunu söyler ve ayrıntılı moda yönlendirir.
import { roundPrice, type AnalysisInput, type FounderRole } from '@bitm/engine';
import { buildSampleInput, countries, engineCountry, getSector } from '@bitm/archetypes';

export const QUICK_STEPS = [
  'sector',
  'country',
  'area',
  'rent',
  'staff',
  'role',
  'price',
  'daily',
  'capex',
  'equity',
] as const;
export type QuickStep = (typeof QUICK_STEPS)[number];

export interface QuickAnswers {
  sector?: string;
  country?: string;
  area?: string;
  /** Aylık kira (tüm kira satırlarının yerine). */
  rent?: number;
  /** Aylık toplam personel maaşı (SGK işveren payı motor tarafından eklenir). */
  staff?: number;
  role?: FounderRole;
  /** İmza ürün / hizmet fiyatı ve birim maliyeti. */
  price?: number;
  cost?: number;
  /** Baz senaryo: günlük satış veya müşteri. */
  daily?: number;
  /** Açılış yatırımı (beklenmedik gider payı hariç). */
  capex?: number;
  /** Öz sermaye payı (%). */
  equity?: number;
}

export interface QuickState {
  v: 1;
  step: number;
  answers: QuickAnswers;
}

const sum = (rows: { v: unknown }[]) => rows.reduce((a, r) => a + (Number(r.v) || 0), 0);
const positive = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0;

/** Sektörün örneği olan, tam desteklenen ülkeler (genel mod İP-1.9'da). */
export function quickCountries(sector: string): string[] {
  const s = getSector(sector);
  return Object.values(countries)
    .filter((c) => c.supportLevel === 'full' && s.defaults[c.code]?.sample)
    .map((c) => c.code);
}

function sampleFor(sector: string, country: string): string {
  const sample = getSector(sector).defaults[country]?.sample;
  if (!sample) throw new Error(`${sector}: ${country} için örnek yok`);
  return sample;
}

/** "Videodaki örneği yükle": örnek girdinin hızlı mod cevapları. */
export function sampleAnswers(sector: string, country: string): QuickAnswers {
  const input = buildSampleInput(sector, sampleFor(sector, country));
  const first = input.items[0];
  return {
    sector,
    country,
    area: input.area,
    rent: sum(input.fixed.filter((r) => r.type === 'rent')),
    staff: sum(input.fixed.filter((r) => r.type === 'staff')),
    role: input.loc.founder.role,
    price: Number(first?.price) || 0,
    cost: Number(first?.cost) || 0,
    daily: input.scen[1],
    capex: sum(input.capex),
    equity: input.loc.founder.equity,
  };
}

export function isAnswered(step: QuickStep, a: QuickAnswers): boolean {
  switch (step) {
    case 'sector':
      return !!a.sector;
    case 'country':
      return !!a.country;
    case 'area':
      return !!a.area?.trim();
    case 'role':
      return !!a.role;
    case 'price':
      return positive(a.price) && a.cost !== undefined && a.cost >= 0;
    case 'equity':
      return a.equity !== undefined && a.equity >= 0 && a.equity <= 100;
    default:
      return positive(a[step]);
  }
}

/** Cevapları örnek girdinin üzerine uygular. Örnekle aynı cevaplar örnek girdisini değiştirmez. */
export function applyQuick(
  a: QuickAnswers,
  labels: { staff: string },
): { input: AnalysisInput; sample: string; country: string } {
  if (!a.sector || !a.country) throw new Error('sektör ve ülke gerekli');
  const sample = sampleFor(a.sector, a.country);
  const input = buildSampleInput(a.sector, sample);
  const base = sampleAnswers(a.sector, a.country);
  const step = engineCountry(a.country).priceRounding;

  if (a.area !== undefined) input.area = a.area.trim();

  if (a.rent !== undefined && a.rent !== base.rent) {
    const rows = input.fixed.filter((r) => r.type === 'rent');
    rows.forEach((r, i) => (r.v = i === 0 ? a.rent! : 0));
  }
  if (a.staff !== undefined && a.staff !== base.staff) {
    const rows = input.fixed.filter((r) => r.type === 'staff');
    rows.forEach((r, i) => {
      r.v = i === 0 ? a.staff! : 0;
      if (i === 0) r.n = labels.staff;
    });
  }
  if (a.role) input.loc.founder.role = a.role;

  const first = input.items[0];
  if (first && a.price !== undefined && a.price !== first.price) {
    const ratio = Number(first.price) > 0 ? a.price / Number(first.price) : 1;
    input.items.forEach((r, i) => {
      if (i > 0) r.price = roundPrice(Number(r.price) * ratio, step);
    });
    first.price = a.price;
  }
  if (first && a.cost !== undefined && a.cost !== first.cost) {
    const ratio = Number(first.cost) > 0 ? a.cost / Number(first.cost) : 1;
    input.items.forEach((r, i) => {
      if (i > 0) r.cost = Math.round(Number(r.cost) * ratio * 100) / 100;
    });
    first.cost = a.cost;
  }

  if (a.daily !== undefined && a.daily !== input.scen[1]) {
    const [lo, mid, hi] = input.scen;
    input.scen =
      mid > 0
        ? [Math.round((a.daily * lo) / mid), a.daily, Math.round((a.daily * hi) / mid)]
        : [a.daily, a.daily, a.daily];
  }

  const capexSum = sum(input.capex);
  if (a.capex !== undefined && a.capex !== capexSum && capexSum > 0) {
    const ratio = a.capex / capexSum;
    input.capex.forEach((r) => (r.v = Math.round((Number(r.v) || 0) * ratio)));
  }

  if (a.equity !== undefined) input.loc.founder.equity = a.equity;
  return { input, sample, country: a.country };
}
