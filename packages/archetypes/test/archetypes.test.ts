import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checklist,
  countries,
  engineArchetype,
  engineCountry,
  genericCountry,
  getCountry,
  mergeFin,
  missingFinFields,
  sectors,
  SectorSchema,
} from '../src';

const engineSrc = new URL('../../engine/src/', import.meta.url);

describe('sektör dosyaları', () => {
  it.each(Object.keys(sectors))('%s şemadan geçer ve motor yapısına dönüşür', (id) => {
    const a = engineArchetype(id);
    expect(a.id).toBe(id);
    expect(a.checklist).toHaveLength(12);
  });

  it('talep ağırlıkları 100 değilse şema reddeder', () => {
    const bad = structuredClone(sectors.coffee!);
    bad.demandFit.features[0]!.weight = 41;
    expect(SectorSchema.safeParse(bad).success).toBe(false);
  });

  it('beyaz liste dışı ifadeyi şema reddeder', () => {
    const bad = structuredClone(sectors.coffee!);
    bad.demandFit.features[0]!.expr = 'globalThis.x';
    expect(SectorSchema.safeParse(bad).success).toBe(false);
  });

  it('sektöre göre değişen kontrol listesi etiketleri her sektörde tanımlı', () => {
    const sectorSpecific = checklist.groups.flatMap((g) =>
      g.items.filter((i) => i.label === null).map((i) => i.k),
    );
    for (const s of Object.values(sectors))
      expect(Object.keys(s.location.checklistOverrides).sort()).toEqual([...sectorSpecific].sort());
  });
});

describe('kontrol listesi', () => {
  const items = checklist.groups.flatMap((g) => g.items);
  it('12 madde; kritikler noDisrupt ve permitOk; engel yalnız permitOk', () => {
    expect(items).toHaveLength(12);
    expect(items.filter((i) => i.critical).map((i) => i.k)).toEqual(['noDisrupt', 'permitOk']);
    expect(items.filter((i) => i.blocker).map((i) => i.k)).toEqual(['permitOk']);
  });
  it('kritik maddelerin bayrak metni var', () => {
    for (const i of items.filter((x) => x.critical)) expect(i.flag).toBeDefined();
  });
});

describe('ülke dosyaları', () => {
  it('TR ve US full; listede olmayan ülke GENERIC şablonunu kullanır', () => {
    expect(countries.TR!.supportLevel).toBe('full');
    expect(countries.US!.supportLevel).toBe('full');
    expect(getCountry('FR')).toBe(genericCountry);
    expect(genericCountry.supportLevel).toBe('generic');
    expect(genericCountry.legal).toBeNull();
  });

  it('fiyat yuvarlama: ülke dosyası, yoksa para birimi', () => {
    expect(engineCountry('TR').priceRounding).toBe(5);
    expect(engineCountry('US').priceRounding).toBe(0.25);
    expect(engineCountry('FR', 'EUR').priceRounding).toBe(0.25);
    expect(engineCountry('JP', 'JPY').priceRounding).toBe(1);
  });

  it('birleştirme sırası: ülke → sektör → kullanıcı', () => {
    expect(mergeFin('TR', 'coffee').kdv).toBe(10);
    expect(mergeFin('TR', 'barber').kdv).toBe(20);
    expect(mergeFin('TR', 'coffee').loanRate).toBe(45);
    expect(mergeFin('TR', 'coffee', { loanRate: 30 }).loanRate).toBe(30);
  });

  it('GENERIC: vergi alanları 0, komisyon ve faiz kullanıcı doldurana kadar boş; TR/US değeri sızmaz', () => {
    const fin = mergeFin('FR', 'coffee');
    expect(fin).toMatchObject({ kdv: 0, stopaj: 0, employer: 0, profitTax: 0 });
    expect(missingFinFields(fin)).toEqual(
      expect.arrayContaining(['cardShare', 'cardFee', 'platShare', 'platFee', 'loanRate']),
    );
    for (const k of ['loanRate', 'cardFee', 'employer', 'priceInc'] as const) {
      expect(fin[k]).not.toBe(countries.TR!.fin[k]);
      expect(fin[k]).not.toBe(countries.US!.fin[k]);
    }
  });
});

describe('motorda sektöre / ülkeye özel kod yok (CLAUDE.md kural 13)', () => {
  const ids = [...Object.keys(sectors), ...Object.keys(countries), 'TRY', 'USD', 'EUR'];
  const files = readdirSync(engineSrc).filter((f) => f.endsWith('.ts'));
  it.each(files)('%s', (file) => {
    const code = readFileSync(new URL(file, engineSrc), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
    for (const id of ids) expect(code, `${file} içinde '${id}'`).not.toMatch(new RegExp(`['"\`]${id}['"\`]`));
  });
});
