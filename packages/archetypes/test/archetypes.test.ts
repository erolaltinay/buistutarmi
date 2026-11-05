import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildSampleInput,
  checklist,
  countries,
  CountrySchema,
  engineArchetype,
  engineCountry,
  genericCountry,
  getCountry,
  mergeFin,
  missingFinFields,
  priceFloors,
  researchChecks,
  sectorChecklist,
  sectors,
  SectorSchema,
  toEngineArchetype,
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

describe('rakip inceleme ayarları', () => {
  it('kaynak sırası ülke dosyasından gelir; generic sıra dijital menüyle başlar', () => {
    expect(genericCountry.research.sources).toEqual(['digital_menu', 'website', 'asked', 'social']);
    expect(getCountry('TR').research.sources[0]).toBe('door');
    expect(getCountry('FR').research).toEqual(genericCountry.research);
  });

  it('tekrarlı kaynağı şema reddeder', () => {
    const bad = {
      ...structuredClone(genericCountry),
      research: { sources: ['website', 'website'], staleAfterDays: 90 },
    };
    expect(CountrySchema.safeParse(bad).success).toBe(false);
  });

  it.each(Object.keys(sectors))('%s: sepet şablonla aynı, kontrol grupları sektörden', (id) => {
    const s = sectors[id]!;
    expect(Object.keys(s.research.items).sort()).toEqual(s.itemTemplate.map((t) => t.k).sort());
    const groups = researchChecks(s);
    expect(groups.map((g) => g.group)).toEqual(s.research.groups);
    for (const g of groups) expect(g.checks.length).toBeGreaterThan(0);
  });

  it('berberde dijital menü ve teslimat grubu, kahvede randevu grubu çıkmaz', () => {
    const groups = (id: string) => researchChecks(sectors[id]!).map((g) => g.group);
    expect(groups('barber')).not.toContain('menu');
    expect(groups('barber')).not.toContain('delivery');
    expect(groups('coffee')).not.toContain('booking');
  });

  it('şablonda olmayan kalemi ve ortak listedeki anahtarı şema reddeder', () => {
    const extraItem = structuredClone(sectors.coffee!);
    extraItem.research.items.ghost = { aliases: { tr: [], en: [] } };
    expect(SectorSchema.safeParse(extraItem).success).toBe(false);

    const dupCheck = structuredClone(sectors.coffee!);
    dupCheck.research.checks.push({ k: 'fieldBusy', group: 'field', label: { tr: 'a', en: 'b' } });
    expect(SectorSchema.safeParse(dupCheck).success).toBe(false);
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

  it('GENERIC: vergi, komisyon ve faiz kullanıcı doldurana kadar boş; TR/US değeri sızmaz', () => {
    const fin = mergeFin('FR', 'coffee');
    expect(missingFinFields(fin)).toEqual(
      expect.arrayContaining([
        'kdv',
        'stopaj',
        'employer',
        'profitTax',
        'cardShare',
        'cardFee',
        'platShare',
        'platFee',
        'loanRate',
      ]),
    );
    for (const k of ['loanRate', 'cardFee', 'employer', 'priceInc'] as const) {
      expect(fin[k]).not.toBe(countries.TR!.fin[k]);
      expect(fin[k]).not.toBe(countries.US!.fin[k]);
    }
  });
});

describe('düzenlemeli meslek alanları (SPEC-archetypes §2.1)', () => {
  // Diş hekimi / veteriner dosyası henüz yok (İP-3.1); berberin değiştirilmiş kopyası kullanılır.
  const regulated = () => {
    const s = structuredClone(sectors.barber!);
    s.requiresCertificate = 'dentist';
    s.regulated = { profession: 'dentist', marketingRestricted: true };
    s.location.footTraffic = 'info';
    s.checklist = {
      remove: ['commuteSide', 'outdoor'],
      add: [
        {
          k: 'healthUseOk',
          critical: true,
          blocker: false,
          label: { tr: 'Bina sağlık hizmetine uygun', en: 'Building suits a health practice' },
          flag: { tr: 'Bina uygun değil', en: 'Building not suitable' },
          sampleAnswer: null,
        },
      ],
    };
    return s;
  };
  const parse = (s: unknown) => SectorSchema.safeParse(s);

  it('geçerli düzenlemeli sektör şemadan geçer', () => {
    expect(parse(regulated()).success).toBe(true);
  });

  it('mevcut sektörlerde varsayılanlar: yaya trafiği scored, liste farkı yok', () => {
    for (const id of Object.keys(sectors)) {
      expect(sectors[id]!.location.footTraffic).toBe('scored');
      expect(engineArchetype(id).location.footTraffic).toBe('scored');
    }
  });

  it('engel madde (permitOk) sektör listesinden çıkarılamaz', () => {
    const s = regulated();
    s.checklist!.remove.push('permitOk');
    expect(parse(s).success).toBe(false);
  });

  it('ortak listede olmayan madde çıkarılamaz; eklenen madde ortak listeyle çakışamaz', () => {
    const unknown = regulated();
    unknown.checklist!.remove.push('nope');
    expect(parse(unknown).success).toBe(false);
    const clash = regulated();
    clash.checklist!.add[0]!.k = 'anchor';
    expect(parse(clash).success).toBe(false);
  });

  it('sektör etiketi yalnız listede kalan etiketsiz maddeler için yazılır', () => {
    // staffAvail ortak listede etiketsizdir; etiketi sektörden gelir.
    const removed = regulated();
    removed.checklist!.remove.push('staffAvail');
    delete removed.location.checklistOverrides.staffAvail;
    expect(parse(removed).success).toBe(true);

    const missing = regulated();
    delete missing.location.checklistOverrides.staffAvail;
    expect(parse(missing).success).toBe(false);

    const extra = regulated();
    extra.checklist!.remove.push('staffAvail');
    expect(parse(extra).success).toBe(false);
  });

  it('meslek anahtarı requiresCertificate ile aynı olmalı', () => {
    const s = regulated();
    s.requiresCertificate = 'barber';
    expect(parse(s).success).toBe(false);
  });

  it('hybrid arketipte her kalemin kind alanı zorunlu ve en az bir hizmet kalemi olur', () => {
    const s = regulated();
    s.model = 'hybrid';
    expect(parse(s).success).toBe(false);
    s.itemTemplate = s.itemTemplate.map((t) => ({ ...t, kind: 'product' as const }));
    expect(parse(s).success).toBe(false);
    s.itemTemplate[0]!.kind = 'service';
    expect(parse(s).success).toBe(true);
  });

  it('kind arketip modeliyle çelişemez', () => {
    const s = regulated();
    s.itemTemplate[0]!.kind = 'product';
    expect(parse(s).success).toBe(false);
  });

  it('taban fiyat yalnız şablondaki kalemlere yazılır', () => {
    const s = regulated();
    const [first] = s.itemTemplate;
    s.defaults.US!.priceFloors = {
      sourceUrl: 'https://example.org/tarife',
      lastReviewed: '2026-10-01',
      reviewedBy: 'meslek odası tarifesi',
      items: { [first!.k]: 50 },
    };
    expect(parse(s).success).toBe(true);
    s.defaults.US!.priceFloors.items.nope = 10;
    expect(parse(s).success).toBe(false);
  });

  it('motor yapısı: liste farkı uygulanır, yaya modu taşınır', () => {
    const s = SectorSchema.parse(regulated());
    const a = toEngineArchetype(s);
    const keys = a.checklist.map((i) => i.k);
    expect(a.location.footTraffic).toBe('info');
    expect(keys).toHaveLength(11);
    expect(keys).not.toContain('commuteSide');
    expect(keys).not.toContain('outdoor');
    expect(keys).toContain('permitOk');
    expect(a.checklist.find((i) => i.k === 'healthUseOk')).toEqual({
      k: 'healthUseOk',
      critical: true,
      blocker: false,
    });
    expect(sectorChecklist(s).find((i) => i.k === 'healthUseOk')?.label?.tr).toBe(
      'Bina sağlık hizmetine uygun',
    );
  });

  it('taban fiyatlar ülkeye göre kalem anahtarıyla döner; tanımsızsa boş', () => {
    const s = regulated();
    s.defaults.US!.priceFloors = {
      sourceUrl: 'https://example.org/tarife',
      lastReviewed: '2026-10-01',
      reviewedBy: 'meslek odası tarifesi',
      items: { [s.itemTemplate[0]!.k]: 50 },
    };
    const parsed = SectorSchema.parse(s);
    expect(priceFloors(parsed, 'US')).toEqual({ [s.itemTemplate[0]!.k]: 50 });
    expect(priceFloors(parsed, 'TR')).toEqual({});
    expect(priceFloors(parsed, 'FR')).toEqual({});
  });

  it('mevcut sektörlerin örnek girdisinde taban ve kind yok (golden girdisi değişmez)', () => {
    const input = buildSampleInput('barber', 'nyc');
    for (const it of input.items) {
      expect(it).not.toHaveProperty('minPrice');
      expect(it).not.toHaveProperty('kind');
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
