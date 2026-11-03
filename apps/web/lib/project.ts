// Analiz projesi ve bu cihazdaki deposu. İP-1.1'de aynı arayüzün arkasına Supabase gelir
// (SPEC-architecture §3–4); o zamana kadar proje tarayıcının localStorage'ında durur.
import type { AnalysisInput } from '@bitm/engine';
import { buildSampleInput, getSector, sampleCountry } from '@bitm/archetypes';

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
  /** Başlangıç örneği ("Örneğe dön" bunu yeniden yükler). */
  sample: string;
  country: string;
  input: AnalysisInput;
  shop: Shop;
  updatedAt: string;
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

export function createProject(sector: string, sample: string): ProjectDoc {
  const doc = projectFromSample(sector, sample, crypto.randomUUID());
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
