import { describe, expect, it } from 'vitest';
import type { Competitor } from '@bitm/engine';
import {
  addOffer,
  addSource,
  applyObservation,
  buildObservations,
  canApply,
  defaultChannel,
  emptyResearch,
  isStale,
  localDate,
  normalizeUrl,
  orderedSources,
  researchOf,
  withResearch,
  type ObservationDraft,
} from './research';

const today = '2026-11-05';
const ctx = { today, currency: 'TRY' };
const draft = (over: Partial<ObservationDraft> = {}): ObservationDraft => ({
  source: 'door',
  observedOn: today,
  sourceDatedOn: '',
  channel: 'in_store',
  sourceUrl: '',
  rows: [{ itemKey: 'cut', name: 'Saç kesimi', price: 600, sizeNote: '' }],
  ...over,
});
const rival = (over: Partial<Competitor> = {}): Competitor => ({
  dist: 200,
  price: 500,
  rating: 4,
  reviews: 10,
  s: [],
  w: [],
  ...over,
});

describe('gözlem', () => {
  it('tarihsiz gözlem kaydedilmez', () => {
    const r = buildObservations(draft({ observedOn: '' }), ctx);
    expect(r).toEqual({ ok: false, errors: ['date'] });
  });

  it('geçersiz veya gelecek tarihli gözlem kaydedilmez', () => {
    expect(buildObservations(draft({ observedOn: '2026-02-31' }), ctx)).toEqual({
      ok: false,
      errors: ['date'],
    });
    expect(buildObservations(draft({ observedOn: '2026-11-06' }), ctx)).toEqual({
      ok: false,
      errors: ['future'],
    });
  });

  it('kaynaksız gözlem kaydedilmez', () => {
    expect(buildObservations(draft({ source: '' }), ctx)).toEqual({ ok: false, errors: ['source'] });
  });

  it('fiyatı olmayan satır atlanır; hiç fiyat yoksa hata', () => {
    const rows = [
      { itemKey: 'cut', name: 'Saç kesimi', price: null, sizeNote: '' },
      { itemKey: 'beard', name: 'Sakal', price: 350, sizeNote: 'Usta' },
    ];
    const ok = buildObservations(draft({ rows }), ctx);
    expect(ok.ok && ok.observations.map((o) => o.itemKey)).toEqual(['beard']);
    expect(ok.ok && ok.observations[0]).toMatchObject({
      price: 350,
      currency: 'TRY',
      sizeNote: 'Usta',
      source: 'door',
      channel: 'in_store',
      observedOn: today,
      sourceDatedOn: null,
      sourceUrl: null,
    });
    expect(buildObservations(draft({ rows: [rows[0]!] }), ctx)).toEqual({ ok: false, errors: ['prices'] });
  });

  it('sıfır veya negatif fiyat kaydedilmez', () => {
    const row = { itemKey: 'cut', name: 'Saç kesimi', sizeNote: '' };
    expect(buildObservations(draft({ rows: [{ ...row, price: 0 }] }), ctx)).toEqual({
      ok: false,
      errors: ['prices'],
    });
    expect(buildObservations(draft({ rows: [{ ...row, price: -5 }] }), ctx)).toEqual({
      ok: false,
      errors: ['prices'],
    });
  });

  it('şablonda olmayan kalem adıyla kaydedilir, adsız kaydedilmez', () => {
    const named = buildObservations(
      draft({ rows: [{ itemKey: null, name: ' Boya ', price: 1500, sizeNote: '' }] }),
      ctx,
    );
    expect(named.ok && named.observations[0]).toMatchObject({ itemKey: null, rawName: 'Boya' });
    const unnamed = buildObservations(
      draft({ rows: [{ itemKey: null, name: '', price: 1500, sizeNote: '' }] }),
      ctx,
    );
    expect(unnamed).toEqual({ ok: false, errors: ['name'] });
  });

  it('kaynak bağlantısı doğrulanır', () => {
    expect(buildObservations(draft({ sourceUrl: 'javascript:alert(1)' }), ctx)).toEqual({
      ok: false,
      errors: ['url'],
    });
    const ok = buildObservations(draft({ sourceUrl: 'ornek.com/menu' }), ctx);
    expect(ok.ok && ok.observations[0]!.sourceUrl).toBe('https://ornek.com/menu');
  });

  it('teslimat kaynağı teslimat kanalını önerir', () => {
    expect(defaultChannel('delivery')).toBe('delivery');
    expect(defaultChannel('door')).toBe('in_store');
    expect(defaultChannel('social')).toBe('unknown');
  });
});

describe('Uygula', () => {
  const obs = (over = {}) => {
    const r = buildObservations(draft(over), ctx);
    if (!r.ok) throw new Error('gözlem kurulamadı');
    return r.observations[0]!;
  };

  it('gözlem eklemek rakip fiyatını değiştirmez, yalnız applyObservation değiştirir', () => {
    const c = rival();
    withResearch(c, { ...emptyResearch(), observations: [obs()] });
    expect(c.price).toBe(500);
    applyObservation(c, obs());
    expect(c.price).toBe(600);
  });

  it('yalnız imza kaleminin dükkân gözlemi uygulanabilir', () => {
    expect(canApply(obs(), 'cut', 'TRY')).toBe(true);
    expect(
      canApply(obs({ rows: [{ itemKey: 'beard', name: 'Sakal', price: 1, sizeNote: '' }] }), 'cut', 'TRY'),
    ).toBe(false);
    expect(canApply(obs({ channel: 'delivery' }), 'cut', 'TRY')).toBe(false);
    expect(canApply(obs(), 'cut', 'USD')).toBe(false);
  });
});

describe('bağlantı', () => {
  it('http ve https dışı adres reddedilir', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,x')).toBeNull();
    expect(normalizeUrl('ftp://ornek.com')).toBeNull();
    expect(normalizeUrl('https://kisi:sifre@ornek.com')).toBeNull();
    expect(normalizeUrl('metin')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });

  it('şemasız adrese https eklenir', () => {
    expect(normalizeUrl('  instagram.com/ornek ')).toBe('https://instagram.com/ornek');
    expect(normalizeUrl('http://ornek.com/menu')).toBe('http://ornek.com/menu');
  });

  it('aynı bağlantı iki kez eklenmez', () => {
    const first = addSource(emptyResearch(), 'website', 'ornek.com', today);
    if ('error' in first) throw new Error('eklenemedi');
    expect(first.research.sources[0]).toEqual({ kind: 'website', url: 'https://ornek.com/', addedOn: today });
    expect(addSource(first.research, 'other', 'https://ornek.com/', today)).toEqual({ error: 'duplicate' });
    expect(addSource(first.research, 'other', 'yok', today)).toEqual({ error: 'url' });
  });
});

describe('kampanya', () => {
  it('tür, kaynak ve tarih zorunlu', () => {
    const base = { type: 'student', note: '', source: 'door', observedOn: today } as const;
    expect('research' in addOffer(emptyResearch(), base, today)).toBe(true);
    expect(addOffer(emptyResearch(), { ...base, type: '' }, today)).toEqual({ error: 'type' });
    expect(addOffer(emptyResearch(), { ...base, source: '' }, today)).toEqual({ error: 'source' });
    expect(addOffer(emptyResearch(), { ...base, observedOn: '' }, today)).toEqual({ error: 'date' });
    expect(addOffer(emptyResearch(), { ...base, observedOn: '2027-01-01' }, today)).toEqual({
      error: 'future',
    });
  });
});

describe('kayıt', () => {
  it('kaydı olmayan veya bozuk rakip boş kayıt verir', () => {
    expect(researchOf(rival())).toEqual(emptyResearch());
    expect(researchOf({ ...rival(), research: { observations: 'bozuk' } } as Competitor)).toEqual(
      emptyResearch(),
    );
  });

  it('kayıt rakibin üstünde durur ve geri okunur', () => {
    const c = rival();
    withResearch(c, { ...emptyResearch(), visibility: 'ask', serviceFee: 50 });
    expect(researchOf(JSON.parse(JSON.stringify(c)) as Competitor)).toMatchObject({
      visibility: 'ask',
      serviceFee: 50,
    });
  });
});

describe('kaynak sırası', () => {
  it('ülke sırası önce gelir, kalanlar seçilebilir kalır', () => {
    const { recommended, others } = orderedSources(['digital_menu', 'website', 'asked', 'social']);
    expect(recommended).toEqual(['digital_menu', 'website', 'asked', 'social']);
    expect(others).toContain('door');
    expect(others).not.toContain('website');
  });
});

describe('tarih', () => {
  it('eşik günü geçen gözlem eskidir', () => {
    expect(isStale('2026-08-07', today, 90)).toBe(false);
    expect(isStale('2026-08-06', today, 90)).toBe(true);
  });

  it('yerel tarih UTC gününe kaymaz', () => {
    expect(localDate(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
    expect(localDate(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
});
