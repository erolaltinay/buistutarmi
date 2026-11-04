import { describe, expect, it } from 'vitest';
import { makeFormat } from './format';

describe('gösterim biçimi', () => {
  it('sıfır tutar eksi işaretsiz ve kuruşsuz', () => {
    const f = makeFormat('tr', 'TRY');
    expect(f.money(-0)).toBe(f.money(0));
    expect(f.money(0)).not.toMatch(/[-−]|,00/);
  });

  it('küçük tutar kuruşuyla', () => {
    expect(makeFormat('en', 'USD').money(5.75)).toBe('$5.75');
  });
});
