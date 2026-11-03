import { describe, expect, it } from 'vitest';
import { buildSampleInput } from '@bitm/archetypes';
import {
  changedGroups,
  confidence,
  GROUPS,
  PRELIMINARY_BELOW,
  sourceOf,
  untrustedGroups,
} from './confidence';

describe('veri güveni (SPEC-architecture §7)', () => {
  it('ağırlıklar toplamı 100', () => {
    expect(Object.values(GROUPS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('örnekle açılan analizde güven 0, ön değerlendirme eşiğinin altında', () => {
    expect(confidence(undefined)).toBe(0);
    expect(confidence({})).toBeLessThan(PRELIMINARY_BELOW);
    expect(sourceOf({}, 'fin')).toBe('estimate');
    expect(sourceOf({}, 'rent')).toBe('sample');
  });

  it('kira, personel ve fiyat girilince güven artar', () => {
    const a = confidence({});
    const b = confidence({ rent: 'user' });
    const c = confidence({ rent: 'user', staff: 'user', price: 'user' });
    expect(b).toBeGreaterThan(a);
    expect(c).toBe(40);
  });

  it('api ve ölçüm de güvenilir sayılır; tahmin sayılmaz', () => {
    expect(confidence({ foot: 'measured', area: 'api', fin: 'estimate' })).toBe(15);
  });

  it('hızlı mod cevapları ön değerlendirme eşiğini geçer', () => {
    const quick = Object.fromEntries(
      ['area', 'rent', 'staff', 'founder', 'price', 'cost', 'base', 'capex'].map((g) => [g, 'user']),
    );
    expect(confidence(quick)).toBe(76);
    expect(untrustedGroups(quick)).toEqual(['foot', 'comp', 'otherFixed', 'site', 'fin']);
  });

  it('değişen grup tespiti: yalnız değişen grup döner', () => {
    const a = buildSampleInput('coffee', 'ist');
    const b = structuredClone(a);
    b.fixed.find((r) => r.type === 'rent')!.v = 50000;
    b.items[0]!.cost = 40;
    expect(changedGroups(a, b)).toEqual(['rent', 'cost']);
    expect(changedGroups(a, structuredClone(a))).toEqual([]);
  });

  it('satır türü değişince iki grup birden değişir', () => {
    const a = buildSampleInput('coffee', 'ist');
    const b = structuredClone(a);
    b.fixed.find((r) => r.k === 'otherFixed')!.type = 'staff';
    expect(changedGroups(a, b).sort()).toEqual(['otherFixed', 'staff']);
  });
});
