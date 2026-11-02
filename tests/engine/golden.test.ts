// CLAUDE.md kural 2: bu 30 vaka geçmeden motorda yapılan hiçbir değişiklik birleştirilmez.
import { describe, expect, it } from 'vitest';
import { analyze, type AnalysisInput } from '@bitm/engine';
import { buildSampleInput, engineArchetype, engineCountry, sampleCountry } from '@bitm/archetypes';
import { diffAgainstExpected, loadGolden, toGoldenShape } from './golden';

const golden = loadGolden();

const run = (input: AnalysisInput) =>
  toGoldenShape(
    analyze(input, engineArchetype(input.biz), engineCountry(sampleCountry(input.biz, input.city))),
  );

/** Fixture satırlarında `type` / `depreciable` yoktur; ürün satırlarında vardır. */
const withoutExplicitTypes = (input: AnalysisInput) => ({
  ...input,
  capex: input.capex.map(({ depreciable: _d, ...r }) => r),
  fixed: input.fixed.map(({ type: _t, ...r }) => r),
});

describe('golden-cases.json', () => {
  it('30 vaka içerir', () => {
    expect(golden.cases).toHaveLength(30);
  });

  it('karşılaştırıcı tolerans dışı farkı, eksik alanı ve null/∞ farkını yakalar', () => {
    const tol = golden.tolerance;
    expect(diffAgainstExpected({ a: 100 }, { a: 100.4 }, tol)).toEqual([]);
    expect(diffAgainstExpected({ a: 100 }, { a: 100.6 }, tol)).toHaveLength(1);
    expect(diffAgainstExpected({ a: 0.01 }, { a: 0.059 }, tol)).toEqual([]);
    expect(diffAgainstExpected({ a: { b: 1 } }, { a: {} }, tol)).toHaveLength(1);
    expect(diffAgainstExpected({ a: null }, { a: 0 }, tol)).toHaveLength(1);
    expect(diffAgainstExpected({ a: ['x', 'y'] }, { a: ['y', 'x'] }, tol)).toHaveLength(2);
  });

  describe.each(golden.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    it('beklenen çıktıyı toleransla üretir (eski veri yolu: satır tipi anahtardan)', () => {
      expect(diffAgainstExpected(c.expected, run(c.input), golden.tolerance)).toEqual([]);
    });
  });
});

describe('arketip dosyalarından kurulan örnek girdi', () => {
  const defaults = golden.cases.filter((c) => c.id.endsWith('-default'));

  it('her sektör × şehir için bir varsayılan vaka var', () => {
    expect(defaults).toHaveLength(6);
  });

  describe.each(defaults.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const built = buildSampleInput(c.input.biz, c.input.city);

    it('prototipin durum nesnesiyle birebir aynı', () => {
      const { lang: _lang, shop: _shop, ...fixtureInput } = c.input;
      expect(withoutExplicitTypes(built)).toEqual(fixtureInput);
    });

    it('açık satır tipleriyle de aynı sonucu verir', () => {
      expect(built.fixed.every((r) => r.type !== undefined)).toBe(true);
      expect(diffAgainstExpected(c.expected, run(built), golden.tolerance)).toEqual([]);
    });
  });
});
