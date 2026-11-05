// İP-2.9 kabul: SPEC-calc-engine §12.2. Önce bu testler yazıldı.
import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  priceMap,
  type PriceChannel,
  type PriceMapInput,
  type PriceMapRival,
  type PriceObservation,
} from '../src';

const ASOF = '2026-11-05';

const obs = (
  itemKey: string | null,
  price: number,
  over: Partial<Omit<PriceObservation, 'itemKey' | 'price'>> = {},
): PriceObservation => ({
  itemKey,
  price,
  currency: 'TRY',
  channel: 'in_store',
  source: 'door',
  observedOn: '2026-10-20',
  sizeNote: '',
  ...over,
});

const rival = (observations: PriceObservation[], serviceFee: number | null = null): PriceMapRival => ({
  serviceFee,
  observations,
});

const input = (rivals: PriceMapRival[], over: Partial<PriceMapInput> = {}): PriceMapInput => ({
  asOf: ASOF,
  staleAfterDays: 90,
  currency: 'TRY',
  levels: { low: 0.9, high: 1.1 },
  items: [
    { key: 'cut', price: 600 },
    { key: 'beard', price: 300 },
    { key: 'combo', price: 800 },
  ],
  bundles: [{ key: 'combo', parts: ['cut', 'beard'] }],
  rivals,
  ...over,
});

/** Üç rakip, ikişer kalem: cut 500/600/800 (medyan 600), beard 200/300/400 (medyan 300). */
const threeRivals = () => [
  rival([obs('cut', 500), obs('beard', 200)]),
  rival([obs('cut', 600), obs('beard', 300)]),
  rival([obs('cut', 800), obs('beard', 400)]),
];

const channel = (r: ReturnType<typeof priceMap>, c: PriceChannel) => {
  const found = r.channels.find((x) => x.channel === c);
  if (!found) throw new Error(`kanal yok: ${c}`);
  return found;
};
const item = (ch: ReturnType<typeof channel>, key: string) => {
  const found = ch.items.find((x) => x.key === key);
  if (!found) throw new Error(`kalem yok: ${key}`);
  return found;
};

describe('daysBetween', () => {
  it('artık yıl ve yıl dönümünü doğru sayar', () => {
    expect(daysBetween('2026-11-05', '2026-11-05')).toBe(0);
    expect(daysBetween('2026-11-04', '2026-11-05')).toBe(1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2023-02-28', '2023-03-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('2026-11-05', '2026-11-04')).toBe(-1);
  });
});

describe('priceMap', () => {
  it('aynı girdi ve asOf aynı sonucu verir, girdiyi değiştirmez', () => {
    const a = input(threeRivals());
    const before = JSON.stringify(a);
    expect(priceMap(a)).toEqual(priceMap(input(threeRivals())));
    expect(JSON.stringify(a)).toBe(before);
  });

  it('asOf değişince eskime değişir', () => {
    const a = input([rival([obs('cut', 500, { observedOn: '2026-08-01' })])]);
    expect(channel(priceMap(a), 'in_store').rivals[0]!.cells.cut!.stale).toBe(true);
    const b = { ...a, asOf: '2026-08-02' };
    expect(channel(priceMap(b), 'in_store').rivals[0]!.cells.cut!.stale).toBe(false);
  });

  it('gözlem yoksa kanal çıkmaz', () => {
    expect(priceMap(input([])).channels).toEqual([]);
    expect(priceMap(input([rival([])])).channels).toEqual([]);
  });

  it('kalem başına en düşük, medyan, en yüksek', () => {
    const ch = channel(priceMap(input(threeRivals())), 'in_store');
    expect(item(ch, 'cut')).toMatchObject({ count: 3, staleCount: 0, min: 500, median: 600, max: 800 });
    expect(item(ch, 'beard')).toMatchObject({ count: 3, min: 200, median: 300, max: 400 });
    expect(item(ch, 'combo')).toMatchObject({ count: 0, min: null, median: null, max: null });
  });

  it('çift sayıda fiyatta medyan ortadaki ikisinin ortalaması', () => {
    const ch = channel(
      priceMap(
        input([
          rival([obs('cut', 100)]),
          rival([obs('cut', 200)]),
          rival([obs('cut', 400)]),
          rival([obs('cut', 500)]),
        ]),
      ),
      'in_store',
    );
    expect(item(ch, 'cut').median).toBe(300);
  });

  it('endeks fiyat/medyan oranlarının ortalaması; seviye eşikleri', () => {
    const ch = channel(priceMap(input(threeRivals())), 'in_store');
    expect(ch.sufficient).toBe(true);
    expect(ch.rivalsNeeded).toBe(0);
    const [a, b, c] = ch.rivals;
    expect(a!.index).toBeCloseTo((500 / 600 + 200 / 300) / 2);
    expect(a!.level).toBe('lo');
    expect(b!.index).toBeCloseTo(1);
    expect(b!.level).toBe('mid');
    expect(c!.index).toBeCloseTo((800 / 600 + 400 / 300) / 2);
    expect(c!.level).toBe('hi');
  });

  it('eşik değerleri orta sayılır, eşikler girdiden gelir', () => {
    // İki kalemde oran tam 1,10: medyan 100 ve 200.
    const rivals = [
      rival([obs('cut', 110), obs('beard', 220)]),
      rival([obs('cut', 100), obs('beard', 200)]),
      rival([obs('cut', 90), obs('beard', 180)]),
    ];
    const ch = channel(priceMap(input(rivals)), 'in_store');
    expect(ch.rivals[0]!.level).toBe('mid');
    expect(ch.rivals[2]!.level).toBe('mid');
    const tight = channel(priceMap(input(rivals, { levels: { low: 0.95, high: 1.05 } })), 'in_store');
    expect(tight.rivals[0]!.level).toBe('hi');
    expect(tight.rivals[2]!.level).toBe('lo');
  });

  it('kendi yerin aynı medyana oranlanır', () => {
    const ch = channel(priceMap(input(threeRivals())), 'in_store');
    expect(item(ch, 'cut').own).toBe(600);
    expect(item(ch, 'cut').ownRatio).toBeCloseTo(1);
    expect(item(ch, 'combo').ownRatio).toBeNull();
    expect(ch.own?.index).toBeCloseTo(1);
    expect(ch.own?.level).toBe('mid');
  });

  it('kendi fiyatı girilmemiş kalem kendi endeksine girmez', () => {
    const a = input(threeRivals(), {
      items: [
        { key: 'cut', price: null },
        { key: 'beard', price: 300 },
      ],
      bundles: [],
    });
    const ch = channel(priceMap(a), 'in_store');
    expect(item(ch, 'cut').ownRatio).toBeNull();
    expect(ch.own).toEqual({ index: null, level: null });
  });

  describe('veri yeterliliği', () => {
    it('3 rakipten azsa veri yetersiz, endeks ve kendi yerin çıkmaz, aralık görünür', () => {
      const ch = channel(priceMap(input(threeRivals().slice(0, 2))), 'in_store');
      expect(ch.sufficient).toBe(false);
      expect(ch.qualifiedRivals).toBe(2);
      expect(ch.rivalsNeeded).toBe(1);
      expect(ch.rivals.every((x) => x.index === null && x.level === null)).toBe(true);
      expect(item(ch, 'cut').ownRatio).toBeNull();
      expect(ch.own).toEqual({ index: null, level: null });
      expect(item(ch, 'cut').median).toBe(550);
    });

    it('rakip başına 2 kalem altı sayılmaz; eksik kalemler listelenir', () => {
      const rivals = [
        rival([obs('cut', 500), obs('beard', 200)]),
        rival([obs('cut', 600), obs('beard', 300)]),
        rival([obs('cut', 800)]),
      ];
      const ch = channel(priceMap(input(rivals)), 'in_store');
      expect(ch.sufficient).toBe(false);
      expect(ch.qualifiedRivals).toBe(2);
      expect(ch.rivals[2]!.missing).toEqual(['beard', 'combo']);
    });

    it('fiyat girilmemiş rakip eksik listesinde görünür', () => {
      const ch = channel(priceMap(input([...threeRivals().slice(0, 2), rival([])])), 'in_store');
      expect(ch.rivals).toHaveLength(3);
      expect(ch.rivals[2]!.missing).toEqual(['cut', 'beard', 'combo']);
    });

    it('üç yeterli rakip varken dördüncünün eksikliği hesabı kapatmaz, onun endeksi çıkmaz', () => {
      const ch = channel(priceMap(input([...threeRivals(), rival([obs('cut', 700)])])), 'in_store');
      expect(ch.sufficient).toBe(true);
      expect(ch.rivals[0]!.index).not.toBeNull();
      expect(ch.rivals[3]!.index).toBeNull();
    });

    it('tek rakipte görülen kalem endekse girmez', () => {
      const rivals = threeRivals();
      rivals[0]!.observations.push(obs('combo', 5000));
      const ch = channel(priceMap(input(rivals)), 'in_store');
      expect(item(ch, 'combo').count).toBe(1);
      expect(ch.rivals[0]!.index).toBeCloseTo((500 / 600 + 200 / 300) / 2);
    });
  });

  describe('eskime', () => {
    const stale = { observedOn: '2026-01-01' };

    it('eski gözlem medyana girmez ama görünür', () => {
      const rivals = threeRivals();
      rivals[2]!.observations = [obs('cut', 5000, stale), obs('beard', 400)];
      const ch = channel(priceMap(input(rivals)), 'in_store');
      expect(item(ch, 'cut')).toMatchObject({ count: 2, staleCount: 1, min: 500, max: 600, median: 550 });
      expect(ch.rivals[2]!.cells.cut).toMatchObject({ price: 5000, stale: true, observedOn: '2026-01-01' });
      expect(ch.rivals[2]!.missing).toContain('cut');
    });

    it('sınır gününde taze, ertesi gün eski', () => {
      const at = (observedOn: string) =>
        channel(priceMap(input([rival([obs('cut', 500, { observedOn })])])), 'in_store').rivals[0]!.cells.cut!
          .stale;
      expect(at('2026-08-07')).toBe(false); // tam 90 gün
      expect(at('2026-08-06')).toBe(true); // 91 gün
    });

    it('en yeni gözlem kullanılır; aynı günde sonra girilen kazanır', () => {
      const ch = channel(
        priceMap(
          input([
            rival([
              obs('cut', 500, { observedOn: '2026-10-25' }),
              obs('cut', 400, { observedOn: '2026-10-01' }),
              obs('beard', 200, { observedOn: '2026-10-25' }),
              obs('beard', 250, { observedOn: '2026-10-25' }),
            ]),
          ]),
        ),
        'in_store',
      );
      expect(ch.rivals[0]!.cells.cut!.price).toBe(500);
      expect(ch.rivals[0]!.cells.beard!.price).toBe(250);
    });

    it('yeni gözlem eskiyi medyandan da çıkarır', () => {
      const ch = channel(priceMap(input([rival([obs('cut', 5000, stale), obs('cut', 500)])])), 'in_store');
      expect(item(ch, 'cut')).toMatchObject({ count: 1, staleCount: 0, median: 500 });
    });
  });

  describe('kanallar', () => {
    it('teslimat ve dükkân fiyatı karışmaz', () => {
      const delivery = { channel: 'delivery' as const, source: 'delivery' };
      const rivals = threeRivals().map((r, i) =>
        rival([...r.observations, obs('cut', 2000 + i, delivery), obs('beard', 1000 + i, delivery)]),
      );
      const r = priceMap(input(rivals));
      expect(item(channel(r, 'in_store'), 'cut')).toMatchObject({ min: 500, median: 600, max: 800 });
      expect(item(channel(r, 'delivery'), 'cut')).toMatchObject({ min: 2000, median: 2001, max: 2002 });
    });

    it('kanal sırası sabit, gözlemi olmayan çıkmaz', () => {
      const r = priceMap(
        input([
          rival([
            obs('cut', 1, { channel: 'delivery' }),
            obs('cut', 2, { channel: 'unknown' }),
            obs('cut', 3, { channel: 'in_store' }),
          ]),
        ]),
      );
      expect(r.channels.map((c) => c.channel)).toEqual(['in_store', 'unknown', 'delivery']);
    });

    it('teslimat kanalında kendi fiyatın kıyaslanmaz', () => {
      const delivery = { channel: 'delivery' as const };
      const rivals = threeRivals().map((r) => rival(r.observations.map((o) => ({ ...o, ...delivery }))));
      const ch = channel(priceMap(input(rivals)), 'delivery');
      expect(ch.sufficient).toBe(true);
      expect(ch.rivals[0]!.index).not.toBeNull();
      expect(item(ch, 'cut').own).toBeNull();
      expect(item(ch, 'cut').ownRatio).toBeNull();
      expect(ch.own).toBeNull();
    });

    it('kanal farkı aynı rakibin taze teslimat ve dükkân fiyatından', () => {
      const r = priceMap(
        input([
          rival([obs('cut', 500), obs('cut', 600, { channel: 'delivery' })]),
          rival([obs('cut', 500, { observedOn: '2026-01-01' }), obs('cut', 600, { channel: 'delivery' })]),
          rival([obs('cut', 500, { channel: 'unknown' }), obs('cut', 600, { channel: 'delivery' })]),
        ]),
      );
      expect(r.channelGaps).toHaveLength(1);
      expect(r.channelGaps[0]).toMatchObject({ rival: 0, itemKey: 'cut', inStore: 500, delivery: 600 });
      expect(r.channelGaps[0]!.ratio).toBeCloseTo(1.2);
    });
  });

  describe('elenenler', () => {
    it('farklı para birimi karşılaştırmaya girmez, kur çevrilmez', () => {
      const r = priceMap(input([rival([obs('cut', 500), obs('beard', 10, { currency: 'USD' })])]));
      const ch = channel(r, 'in_store');
      expect(item(ch, 'beard').count).toBe(0);
      expect(ch.rivals[0]!.cells.beard).toBeUndefined();
      expect(r.ignored).toEqual({ otherCurrency: 1, unmatched: 0 });
    });

    it('eşleşmeyen kalem karşılaştırmaya girmez', () => {
      const r = priceMap(input([rival([obs(null, 1500), obs('ghost', 1500), obs('cut', 500)])]));
      expect(r.ignored).toEqual({ otherCurrency: 0, unmatched: 2 });
      expect(channel(r, 'in_store').items.map((x) => x.key)).toEqual(['cut', 'beard', 'combo']);
    });

    it('yalnız elenen gözlemi olan kanal çıkmaz', () => {
      const r = priceMap(input([rival([obs(null, 1500), obs('cut', 5, { currency: 'USD' })])]));
      expect(r.channels).toEqual([]);
    });

    it('sıfır veya negatif fiyat yok sayılır', () => {
      const r = priceMap(input([rival([obs('cut', 0), obs('beard', -5)])]));
      expect(r.channels).toEqual([]);
    });
  });

  describe('paket indirimi', () => {
    const rivalBundle = (combo: number, cut: number, beard: number, over = {}) =>
      rival([obs('cut', cut, over), obs('beard', beard, over), obs('combo', combo, over)]);

    it('1 − paket / parça toplamı', () => {
      const ch = channel(priceMap(input([rivalBundle(720, 600, 300)])), 'in_store');
      expect(ch.rivals[0]!.bundles).toHaveLength(1);
      expect(ch.rivals[0]!.bundles[0]!.key).toBe('combo');
      expect(ch.rivals[0]!.bundles[0]!.discount).toBeCloseTo(0.2);
    });

    it('parça eksik veya eskiyse çıkmaz', () => {
      const missing = channel(priceMap(input([rival([obs('cut', 600), obs('combo', 700)])])), 'in_store');
      expect(missing.rivals[0]!.bundles).toEqual([]);
      const stale = channel(
        priceMap(
          input([
            rival([obs('cut', 600), obs('beard', 300, { observedOn: '2026-01-01' }), obs('combo', 700)]),
          ]),
        ),
        'in_store',
      );
      expect(stale.rivals[0]!.bundles).toEqual([]);
    });

    it('kanal içinde hesaplanır', () => {
      const r = priceMap(
        input([rival([obs('cut', 600), obs('beard', 300), obs('combo', 700, { channel: 'delivery' })])]),
      );
      expect(channel(r, 'in_store').rivals[0]!.bundles).toEqual([]);
    });

    it('kendi paket indirimin', () => {
      const r = priceMap(input([]));
      expect(r.ownBundles).toHaveLength(1);
      expect(r.ownBundles[0]!.discount).toBeCloseTo(1 - 800 / 900);
    });

    it('kendi fiyatın eksikse paket indirimi çıkmaz; tanımsız sektörde boş', () => {
      const none = input([], {
        items: [
          { key: 'cut', price: 600 },
          { key: 'beard', price: null },
          { key: 'combo', price: 800 },
        ],
      });
      expect(priceMap(none).ownBundles).toEqual([]);
      expect(priceMap(input([], { bundles: [] })).ownBundles).toEqual([]);
    });
  });

  describe('zam', () => {
    it('tek gözlemden çıkmaz', () => {
      expect(priceMap(input([rival([obs('cut', 500)])])).changes).toEqual([]);
    });

    it('aynı günlü iki gözlemden çıkmaz', () => {
      expect(priceMap(input([rival([obs('cut', 500), obs('cut', 600)])])).changes).toEqual([]);
    });

    it('farklı günlü en yeni iki gözlem; eski gözlem de sayılır', () => {
      const r = priceMap(
        input([
          rival([
            obs('cut', 400, { observedOn: '2025-01-01' }),
            obs('cut', 500, { observedOn: '2026-01-01' }),
            obs('cut', 600, { observedOn: '2026-10-29' }),
          ]),
        ]),
      );
      expect(r.changes).toHaveLength(1);
      expect(r.changes[0]).toMatchObject({
        rival: 0,
        itemKey: 'cut',
        channel: 'in_store',
        fromPrice: 500,
        fromOn: '2026-01-01',
        toPrice: 600,
        toOn: '2026-10-29',
        days: 301,
      });
      expect(r.changes[0]!.pct).toBeCloseTo(0.2);
    });

    it('kanal ayrı izlenir', () => {
      const r = priceMap(
        input([
          rival([
            obs('cut', 500, { observedOn: '2026-10-01' }),
            obs('cut', 600, { observedOn: '2026-10-20', channel: 'delivery' }),
          ]),
        ]),
      );
      expect(r.changes).toEqual([]);
    });
  });

  it('servis ücreti aynen geçer, fiyata eklenmez', () => {
    const rivals = threeRivals();
    rivals[0]!.serviceFee = 25;
    const ch = channel(priceMap(input(rivals)), 'in_store');
    expect(ch.rivals[0]!.serviceFee).toBe(25);
    expect(ch.rivals[1]!.serviceFee).toBeNull();
    expect(item(ch, 'cut').min).toBe(500);
  });
});
