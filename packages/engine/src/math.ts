import type { MaybeNumber } from './types';

/** Sayı değilse 0 (prototipteki pf()). */
export const n = (v: MaybeNumber): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Yüzde girdisini kesire çevirir. */
export const pc = (v: MaybeNumber): number => n(v) / 100;

export const clamp = (x: number): number => Math.min(1, Math.max(0, x));

/** ∞ ve NaN çıktıda `null` olur (SPEC §14). */
export const finiteOrNull = (x: number): number | null => (Number.isFinite(x) ? x : null);

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export const avg = (xs: number[]): number => sum(xs) / xs.length;
