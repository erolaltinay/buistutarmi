import { describe, expect, it } from 'vitest';
import { analyze } from '@bitm/engine';
import { buildSampleInput, engineArchetype, engineCountry } from '@bitm/archetypes';
import {
  applyQuick,
  isAnswered,
  QUICK_STEPS,
  quickCountries,
  sampleAnswers,
  type QuickAnswers,
} from './quick';

const LABELS = { staff: 'Personel' };
const full = (over: Partial<QuickAnswers> = {}) => ({ ...sampleAnswers('coffee', 'TR'), ...over });

describe('hızlı mod cevapları', () => {
  it('10 soru', () => {
    expect(QUICK_STEPS).toHaveLength(10);
  });

  it('videodaki örneğin cevapları örnek girdisini birebir kurar', () => {
    for (const sector of ['coffee', 'barber'])
      for (const country of ['TR', 'US']) {
        const sample = country === 'TR' ? 'ist' : 'nyc';
        const { input } = applyQuick(sampleAnswers(sector, country), LABELS);
        expect(input).toEqual(buildSampleInput(sector, sample));
      }
  });

  it('kira ilk kira satırına yazılır, diğer kira satırları sıfırlanır', () => {
    const { input } = applyQuick(full({ rent: 55000 }), LABELS);
    const rent = input.fixed.filter((r) => r.type === 'rent');
    expect(rent[0]!.v).toBe(55000);
    expect(rent.slice(1).every((r) => r.v === 0)).toBe(true);
  });

  it('personel gideri değişince satır adı genel etikete döner', () => {
    const { input } = applyQuick(full({ staff: 80000 }), LABELS);
    const staff = input.fixed.find((r) => r.type === 'staff')!;
    expect(staff).toMatchObject({ v: 80000, n: 'Personel' });
  });

  it('açılış yatırımı kalemlere oranla dağıtılır', () => {
    const { input } = applyQuick(full({ capex: 1_000_000 }), LABELS);
    const total = input.capex.reduce((a, r) => a + Number(r.v), 0);
    expect(Math.abs(total - 1_000_000)).toBeLessThanOrEqual(input.capex.length);
  });

  it('imza fiyatı değişince diğer kalemler aynı oranla kayar ve yuvarlanır', () => {
    const base = buildSampleInput('coffee', 'ist');
    const { input } = applyQuick(full({ price: 240 }), LABELS);
    expect(input.items[0]!.price).toBe(240);
    // İkinci kalem 90 ₺ → ×2 = 180; TR yuvarlama adımı 5.
    expect(input.items[1]!.price).toBe(Number(base.items[1]!.price) * 2);
    expect(input.items.every((r) => Number(r.price) % 5 === 0)).toBe(true);
  });

  it('günlük satış baz senaryodur; kötümser ve iyimser örnekteki oranla kurulur', () => {
    const { input } = applyQuick(full({ daily: 260 }), LABELS);
    expect(input.scen).toEqual([140, 260, 380]);
  });

  it('rol ve öz sermaye girişimci profiline yazılır', () => {
    const { input } = applyQuick(full({ role: 'investor', equity: 30 }), LABELS);
    expect(input.loc.founder).toMatchObject({ role: 'investor', equity: 30 });
    const r = analyze(input, engineArchetype('coffee'), engineCountry('TR'));
    expect(r.fixed.managerLoaded).toBeGreaterThan(0);
  });

  it('ülke seçenekleri sektörün örneği olan full ülkelerdir', () => {
    expect(quickCountries('coffee')).toEqual(['TR', 'US']);
  });

  it('cevap kontrolü: boş, sıfır veya aralık dışı ilerletmez', () => {
    const a = full();
    expect(isAnswered('rent', a)).toBe(true);
    expect(isAnswered('rent', { ...a, rent: undefined })).toBe(false);
    expect(isAnswered('price', { ...a, price: 0 })).toBe(false);
    expect(isAnswered('equity', { ...a, equity: 0 })).toBe(true);
    expect(isAnswered('equity', { ...a, equity: 120 })).toBe(false);
    expect(isAnswered('area', { ...a, area: '  ' })).toBe(false);
  });
});
