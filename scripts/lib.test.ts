import { describe, expect, it } from 'vitest';
import { isProductionRelease, keyDiff, messageKeys } from './lib';

describe('i18n anahtar karşılaştırması', () => {
  it('iç içe anahtarları düzleştirir', () => {
    expect(messageKeys({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual(['a.b', 'a.c.d', 'e']);
  });
  it('iki yöndeki eksikleri bulur', () => {
    expect(keyDiff(['a', 'b'], ['b', 'c'])).toEqual({ onlyA: ['a'], onlyB: ['c'] });
  });
});

describe('production derlemesi tespiti', () => {
  it('Vercel production, açık işaret veya BITM_RELEASE', () => {
    expect(isProductionRelease([], { VERCEL_ENV: 'production' })).toBe(true);
    expect(isProductionRelease([], { VERCEL_ENV: 'preview' })).toBe(false);
    expect(isProductionRelease(['--production'], {})).toBe(true);
    expect(isProductionRelease([], { BITM_RELEASE: 'production' })).toBe(true);
    expect(isProductionRelease([], {})).toBe(false);
  });
});
