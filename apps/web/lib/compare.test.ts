import { describe, expect, it } from 'vitest';
import { analyze } from '@bitm/engine';
import { buildSampleInput, engineArchetype, engineCountry, sampleCountry } from '@bitm/archetypes';
import {
  addCandidate,
  bestCells,
  CMP_ROWS,
  loadCandidate,
  MAX_CANDIDATES,
  removeCandidate,
  rowValue,
  updateCandidate,
} from './compare';
import { projectFromSample } from './project';

const run = (sector: string, sample: string, edit?: (i: ReturnType<typeof buildSampleInput>) => void) => {
  const input = buildSampleInput(sector, sample);
  edit?.(input);
  return {
    cur: input.cur,
    result: analyze(input, engineArchetype(sector), engineCountry(sampleCountry(sector, sample), input.cur)),
  };
};

describe('aday karşılaştırma (İP-1.5)', () => {
  it('prototipteki 12 satır, aynı sırada', () => {
    expect(CMP_ROWS.map(([k]) => k)).toEqual([
      'verdict',
      'beDay',
      'invest',
      'trough',
      'pay',
      'sum24',
      'fit',
      'rivals',
      'rent',
      'capture',
      'locScore',
      'flags',
    ]);
  });

  it('tek sütunda vurgu yok', () => {
    const best = bestCells([run('coffee', 'ist')]);
    expect(Object.values(best).flat().some(Boolean)).toBe(false);
  });

  it('her satırda iyi yöndeki değer işaretlenir; karar satırı işaretlenmez', () => {
    const a = run('coffee', 'ist');
    const b = run('coffee', 'ist', (i) => {
      i.fixed.find((r) => r.type === 'rent')!.v = 20000;
    });
    const best = bestCells([a, b]);
    expect(best.verdict).toEqual([false, false]);
    // Düşük kira: başabaş, kira/ciro ve 24 ay kâr ikinci sütunda daha iyi.
    expect(best.beDay).toEqual([false, true]);
    expect(best.rent).toEqual([false, true]);
    expect(best.sum24).toEqual([false, true]);
    // Kiradan etkilenmeyen satırlarda eşitlik: ikisi de işaretli.
    expect(best.fit).toEqual([true, true]);
    expect(best.rivals).toEqual([true, true]);
  });

  it('para satırları farklı para birimleri arasında vurgulanmaz', () => {
    const best = bestCells([run('coffee', 'ist'), run('coffee', 'nyc')]);
    expect(best.invest).toEqual([false, false]);
    expect(best.trough).toEqual([false, false]);
    expect(best.sum24).toEqual([false, false]);
    expect(best.fit.some(Boolean)).toBe(true);
  });

  it('hesaplanamayan değer en iyi sayılmaz', () => {
    const a = run('coffee', 'ist');
    const never = run('coffee', 'ist', (i) => {
      i.fixed.find((r) => r.type === 'rent')!.v = 900000;
    });
    expect(rowValue(never.result, 'pay')).toBeNull();
    expect(bestCells([a, never]).pay).toEqual([rowValue(a.result, 'pay') !== null, false]);
    expect(bestCells([never, never]).pay).toEqual([false, false]);
  });

  it('aday ekleme, güncelleme, yükleme ve silme', () => {
    const d = projectFromSample('coffee', 'ist', 'p1');
    expect(addCandidate(d, '  ', 'c1', 't1')).toBe(true);
    expect(d.candidates![0]!.name).toBe(d.input.area);
    addCandidate(d, 'x'.repeat(60), 'c2', 't1');
    expect(d.candidates![1]!.name).toHaveLength(40);

    // Kopya tutulur: şu anki analizi değiştirmek adayı değiştirmez.
    d.input.days = 20;
    expect(d.candidates![0]!.input.days).not.toBe(20);
    updateCandidate(d, 'c1', 't2');
    expect(d.candidates![0]).toMatchObject({ savedAt: 't2', input: { days: 20 } });

    d.input.days = 31;
    d.sources = { rent: 'user' };
    d.permits = { x: { status: 'done', updatedAt: 't' } };
    loadCandidate(d, 'c2');
    expect(d.permits).toBeUndefined();
    expect(d.input.days).not.toBe(31);
    expect(d.sources).toBeUndefined();

    removeCandidate(d, 'c1');
    expect(d.candidates!.map((c) => c.id)).toEqual(['c2']);
  });

  it(`en fazla ${MAX_CANDIDATES} aday`, () => {
    const d = projectFromSample('coffee', 'ist', 'p1');
    for (let i = 0; i < MAX_CANDIDATES; i++) expect(addCandidate(d, `A${i}`, `c${i}`, 't')).toBe(true);
    expect(addCandidate(d, 'fazla', 'cx', 't')).toBe(false);
    expect(d.candidates).toHaveLength(MAX_CANDIDATES);
  });
});
