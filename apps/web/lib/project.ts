// Analiz projesi ve bu cihazdaki deposu. İP-1.1'de aynı arayüzün arkasına Supabase gelir
// (SPEC-architecture §3–4); o zamana kadar proje tarayıcının localStorage'ında durur.
import type { AnalysisInput } from '@bitm/engine';
import { buildBlankInput, buildSampleInput, getSector, sampleCountry } from '@bitm/archetypes';
import type { Group, Sources } from './confidence';
import type { Permits } from './permits';
import type { SiteCheck } from './site';

export interface Shop {
  name: string;
  slogan: string;
  palette: number;
  style: number;
  awning: boolean;
}

export interface ProjectDoc {
  v: 1;
  id: string;
  sector: string;
  /** Başlangıç örneği ("Örneğe dön" bunu yeniden yükler); genel modda boş. */
  sample: string;
  country: string;
  input: AnalysisInput;
  shop: Shop;
  /** Hızlı moddan geldiyse karar ekranı hangi verinin örnekten geldiğini söyler. */
  origin?: 'quick';
  /** Girdi gruplarının kaynak etiketleri; yazılmayan grup başlangıç değerindedir (SPEC-architecture §7). */
  sources?: Sources;
  /** Mevzuat maddelerinin durumu; işaretlenmeyen madde "bilmiyorum"dur (SPEC-legal §5). */
  permits?: Permits;
  /** Dükkân önü konum okuması ve Claude incelemesi; lokasyona bağlıdır, adayla gezer. */
  site?: SiteCheck | undefined;
  /**
   * Kaydedilmiş aday lokasyonlar (en fazla 4). Prototip gibi her aday analizin tam kopyasını
   * tutar; İP-1.1'de lokasyona bağlı kısım `candidates` tablosuna ayrılır (SPEC-architecture §3).
   */
  candidates?: Candidate[];
  updatedAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  savedAt: string;
  input: AnalysisInput;
  sources?: Sources;
  permits?: Permits;
  site?: SiteCheck | undefined;
}

const KEY = 'bitm:project:';

export function projectFromSample(sector: string, sample: string, id: string): ProjectDoc {
  return {
    v: 1,
    id,
    sector,
    sample,
    country: sampleCountry(sector, sample),
    input: buildSampleInput(sector, sample),
    shop: { name: getSector(sector).storefront.sampleName, slogan: '', palette: 0, style: 0, awning: true },
    updatedAt: new Date().toISOString(),
  };
}

/** Genel mod: örnek veri olmadan, seçilen ülke ve para birimiyle boş proje. */
export function blankProject(sector: string, country: string, currency: string, id: string): ProjectDoc {
  return {
    v: 1,
    id,
    sector,
    sample: '',
    country,
    input: buildBlankInput(sector, country, currency),
    shop: { name: '', slogan: '', palette: 0, style: 0, awning: true },
    updatedAt: new Date().toISOString(),
  };
}

export function createBlankProject(sector: string, country: string, currency: string): ProjectDoc {
  const doc = blankProject(sector, country, currency, crypto.randomUUID());
  saveProject(doc);
  return doc;
}

/** "Örneğe dön" / "Temizle": projenin başlangıç hali; kayıtlı adaylar korunur. */
export function resetProject(doc: ProjectDoc): ProjectDoc {
  const fresh = doc.sample
    ? projectFromSample(doc.sector, doc.sample, doc.id)
    : blankProject(doc.sector, doc.country, doc.input.cur, doc.id);
  return doc.candidates ? { ...fresh, candidates: doc.candidates } : fresh;
}

export function createProject(sector: string, sample: string): ProjectDoc {
  const doc = projectFromSample(sector, sample, crypto.randomUUID());
  saveProject(doc);
  return doc;
}

/** Hızlı modda cevaplanan gruplar kullanıcı verisi sayılır (SPEC-architecture §7). */
export const QUICK_GROUPS: Group[] = ['area', 'rent', 'staff', 'founder', 'price', 'cost', 'base', 'capex'];

/** Hızlı mod sonunda: cevaplarla kurulmuş girdiden proje. */
export function createQuickProject(
  sector: string,
  sample: string,
  input: AnalysisInput,
  answered: Group[] = QUICK_GROUPS,
  country?: string,
): ProjectDoc {
  const id = crypto.randomUUID();
  const doc: ProjectDoc = {
    ...(sample ? projectFromSample(sector, sample, id) : blankProject(sector, country!, input.cur, id)),
    input,
    origin: 'quick',
    sources: Object.fromEntries(answered.map((g) => [g, 'user'])),
  };
  saveProject(doc);
  return doc;
}

export function loadProject(id: string): ProjectDoc | null {
  try {
    const raw = localStorage.getItem(KEY + id);
    if (!raw) return null;
    const doc = JSON.parse(raw) as ProjectDoc;
    return doc.v === 1 && doc.id === id ? doc : null;
  } catch {
    return null;
  }
}

export function saveProject(doc: ProjectDoc): boolean {
  try {
    localStorage.setItem(KEY + doc.id, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}
