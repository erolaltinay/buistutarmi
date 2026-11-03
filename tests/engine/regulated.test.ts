// SPEC-calc-engine §15: düzenlemeli meslek eklemeleri (§6 svcShare, §10.1 yaya modu,
// §10.5 sektöre özel liste, §12.1 taban fiyat). Henüz diş hekimi / veteriner dosyası yok;
// testler mevcut arketiplerin değiştirilmiş kopyalarıyla çalışır.
import { describe, expect, it } from 'vitest';
import { analyze, serviceShare, type AnalysisInput, type EngineArchetype } from '@bitm/engine';
import { buildSampleInput, engineArchetype, engineCountry } from '@bitm/archetypes';

const coffee = () => buildSampleInput('coffee', 'ist');
const barber = () => buildSampleInput('barber', 'nyc');
const run = (input: AnalysisInput, archetype: EngineArchetype, country: string) =>
  analyze(input, archetype, engineCountry(country));

describe('§6 hizmet payı (svcShare)', () => {
  const items = [
    { k: 'exam', price: 100, cost: 0, mix: 30, kind: 'service' as const },
    { k: 'food', price: 50, cost: 30, mix: 60, kind: 'product' as const },
    { k: 'vaccine', price: 80, cost: 20, mix: 10, kind: 'service' as const },
  ];

  it('service 1, product 0, hybrid hizmet kalemlerinin pay oranı', () => {
    expect(serviceShare(items, 'service')).toBe(1);
    expect(serviceShare(items, 'product')).toBe(0);
    expect(serviceShare(items, 'hybrid')).toBeCloseTo(0.4, 12);
  });

  it('hybrid: kind yazılmamış kalem hizmet sayılır (kapasite açısından ihtiyatlı)', () => {
    const noKind = items.map(({ kind: _kind, ...rest }, i) => (i === 1 ? rest : items[i]!));
    expect(serviceShare(noKind, 'hybrid')).toBe(1);
  });

  it('hybrid: satış payı toplamı 0 ise 0', () => {
    expect(
      serviceShare(
        items.map((r) => ({ ...r, mix: 0 })),
        'hybrid',
      ),
    ).toBe(0);
  });

  it('hibritte kapasite yalnız hizmet payına uygulanır', () => {
    const input = barber();
    const svcMix = input.items.reduce((a, r) => a + Number(r.mix), 0);
    input.items = [
      ...input.items.map((r) => ({ ...r, kind: 'service' as const })),
      { k: 'retail', n: null, price: 20, cost: 8, mix: svcMix, kind: 'product' as const },
    ];
    const hybrid: EngineArchetype = { ...engineArchetype('barber'), model: 'hybrid' };
    const service: EngineArchetype = { ...engineArchetype('barber'), model: 'service' };

    const probe = run(input, hybrid, 'US');
    expect(probe.breakEven.serviceShare).toBeCloseTo(0.5, 12);
    const beDay = probe.breakEven.perDay!;
    // Günlük kapasite, toplam başabaşın %75'i: hizmet payı (%50) sığar, toplam sığmaz.
    input.cap = [1, 1, 60 / (beDay * 0.75)];

    const h = run(input, hybrid, 'US');
    const s = run(input, service, 'US');
    expect(h.breakEven.maxDaily).toBeCloseTo(beDay * 0.75, 9);
    expect(h.financial.reason.code).not.toBe('capacity');
    expect(s.breakEven.serviceShare).toBe(1);
    expect(s.financial).toMatchObject({ verdict: 'NO', reason: { code: 'capacity' } });
  });

  it('kapasite kararı hizmet başına başabaşı gösterir', () => {
    const input = barber();
    input.cap = [1, 4, 60];
    const r = run(input, engineArchetype('barber'), 'US');
    expect(r.financial.reason).toMatchObject({ code: 'capacity', maxDaily: 4 });
    if (r.financial.reason.code === 'capacity')
      expect(r.financial.reason.serviceBePerDay).toBeCloseTo(r.breakEven.perDay!, 12);
  });
});

describe('§10.1 yaya trafiği bilgi modu', () => {
  const info = (): EngineArchetype => {
    const a = engineArchetype('barber');
    return { ...a, location: { ...a.location, footTraffic: 'info' } };
  };

  it('sayım zayıf olsa da yaya bayrağı yok, durum null; sayılar bilgi olarak döner', () => {
    const input = barber();
    input.loc.foot = { wd: [1, 1, 1], we: [1, 1, 1] };
    const scored = run(input, engineArchetype('barber'), 'US');
    expect(scored.location.foot).toBe('bad');
    expect(scored.location.redFlags).toContainEqual({ kind: 'foot' });

    const r = run(input, info(), 'US');
    expect(r.location.foot).toBeNull();
    expect(r.location.redFlags).not.toContainEqual({ kind: 'foot' });
    expect(r.location.dailyPassersby).toBeCloseTo(scored.location.dailyPassersby, 12);
    expect(r.location.captureNeededPct).toBeCloseTo(scored.location.captureNeededPct!, 12);
    expect(r.location.captureBasePct).toBeCloseTo(scored.location.captureBasePct!, 12);
  });

  it('yaya bloğu puana girmez', () => {
    const r = run(barber(), info(), 'US');
    const l = r.location;
    const points = { good: 100, mid: 60, bad: 20 } as const;
    const blocks = [l.rentStatus, l.history, l.founder, l.checklist].filter((s) => s !== null);
    expect(l.score).toBeCloseTo(blocks.reduce((a, s) => a + points[s], 0) / blocks.length, 10);
  });

  it('sayım yokken teyit listesine "say" eklenmez', () => {
    const input = barber();
    input.loc.foot = { wd: [0, 0, 0], we: [0, 0, 0] };
    expect(run(input, engineArchetype('barber'), 'US').location.confirm).toContainEqual({
      kind: 'footCount',
    });
    expect(run(input, info(), 'US').location.confirm).not.toContainEqual({ kind: 'footCount' });
  });
});

describe('§10.5 sektöre özel kontrol listesi', () => {
  const custom = (): EngineArchetype => {
    const a = engineArchetype('barber');
    return {
      ...a,
      checklist: [
        ...a.checklist.filter((i) => i.k !== 'outdoor'),
        { k: 'healthUseOk', critical: true, blocker: false },
        { k: 'licenseOk', critical: true, blocker: true },
      ],
    };
  };

  it('motor arketipteki listeyi olduğu gibi kullanır', () => {
    const input = barber();
    input.loc.chk = { ...input.loc.chk, healthUseOk: 0, licenseOk: 1, outdoor: 0 };
    const r = run(input, custom(), 'US');
    const { yes, no, unknown } = r.location.checklistCounts;
    expect(yes + no + unknown).toBe(13);
    expect(r.location.checklistNo).not.toContain('outdoor');
    expect(r.location.redFlags).toContainEqual({ kind: 'checklist', key: 'healthUseOk' });
    expect(r.location.blocker).toBe(false);
  });

  it('eklenen engel madde "hayır" ise karar TUTMAZ', () => {
    const input = barber();
    input.loc.chk = { ...input.loc.chk, licenseOk: 0 };
    const r = run(input, custom(), 'US');
    expect(r.location.blocker).toBe(true);
    expect(r.verdict).toBe('NO');
  });

  it('cevaplanmamış eklenen kritik madde teyit listesine girer', () => {
    const r = run(barber(), custom(), 'US');
    expect(r.location.confirm).toContainEqual({ kind: 'checklist', key: 'healthUseOk' });
  });
});

describe('§12.1 taban fiyat', () => {
  const archetype = engineArchetype('coffee');

  it('taban yoksa hiçbir kart tabana çekilmez, uyarı boş', () => {
    const r = run(coffee(), archetype, 'TR');
    expect(r.pricing.belowFloor).toEqual([]);
    expect(r.pricing.cards.every((c) => !c.floored)).toBe(true);
  });

  it('hiçbir kart tabanın altına düşmez; now kartı ve öneri değişmez', () => {
    const plain = run(coffee(), archetype, 'TR');
    const input = coffee();
    // Her kalemin tabanı mevcut fiyatının %20 üstü: penetrasyon ve eşleşme kartları tabana takılır.
    input.items = input.items.map((r) => ({ ...r, minPrice: Number(r.price) * 1.2 }));
    const r = run(input, archetype, 'TR');

    const now = r.pricing.cards.find((c) => c.k === 'now')!;
    const plainNow = plain.pricing.cards.find((c) => c.k === 'now')!;
    // Kalemler minPrice alanını taşır; fiyatlar ve sonuçlar aynı kalmalı.
    const numbers = ({ items, ...card }: typeof now) => ({ ...card, prices: items.map((it) => it.price) });
    expect(numbers(now)).toEqual(numbers(plainNow));
    expect(now.floored).toBe(false);
    expect(r.pricing.recommended).toBe(plain.pricing.recommended);
    expect(r.pricing.reason).toBe(plain.pricing.reason);

    for (const card of r.pricing.cards.filter((c) => c.k !== 'now')) {
      card.items.forEach((it, i) =>
        expect(Number(it.price)).toBeGreaterThanOrEqual(input.items[i]!.minPrice!),
      );
      expect(card.price).toBe(card.items[0]!.price);
    }
    expect(r.pricing.cards.find((c) => c.k === 'pen')!.floored).toBe(true);
  });

  it('tabana çekilen kartın birim ekonomisi yeni fiyatlarla hesaplanır', () => {
    const plain = run(coffee(), archetype, 'TR');
    const input = coffee();
    input.items = input.items.map((r) => ({ ...r, minPrice: Number(r.price) * 1.2 }));
    const pen = run(input, archetype, 'TR').pricing.cards.find((c) => c.k === 'pen')!;
    const plainPen = plain.pricing.cards.find((c) => c.k === 'pen')!;
    expect(pen.cm).toBeGreaterThan(plainPen.cm);
  });

  it('kullanıcının fiyatı tabanın altındaysa uyarı verir, karar değişmez', () => {
    const plain = run(coffee(), archetype, 'TR');
    const input = coffee();
    const [first, second] = input.items;
    input.items[0] = { ...first!, minPrice: Number(first!.price) + 5 };
    input.items[1] = { ...second!, minPrice: Number(second!.price) };
    const r = run(input, archetype, 'TR');
    expect(r.pricing.belowFloor).toEqual([first!.k]);
    expect(r.verdict).toBe(plain.verdict);
    expect(r.financial).toEqual(plain.financial);
  });
});
