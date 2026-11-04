import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLanding, getAttribution, getEvents, parseLanding, statsByVideo, track } from './analytics';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const VIDEO_LINK =
  '?utm_source=youtube&utm_medium=description&utm_campaign=kanal&utm_content=abc123&sector=barber';

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
});

describe('video kaynağı', () => {
  it('bilinen UTM alanları ve sektör okunur; başka parametre alınmaz, uzun değer kırpılır', () => {
    expect(parseLanding(VIDEO_LINK)).toEqual({
      first_utm: { source: 'youtube', medium: 'description', campaign: 'kanal', content: 'abc123' },
      first_sector: 'barber',
    });
    expect(parseLanding('?email=a@b.c&fbclid=x').first_utm).toEqual({});
    expect(parseLanding(`?utm_content=${'x'.repeat(300)}`).first_utm.content).toHaveLength(100);
    expect(parseLanding('?utm_content=%20%20').first_utm).toEqual({});
  });

  it('ilk kaynak değişmez (first-touch)', () => {
    captureLanding(VIDEO_LINK, new Date('2026-11-04T10:00:00Z'));
    captureLanding('?utm_content=baska', new Date('2026-11-05T10:00:00Z'));
    expect(getAttribution()).toMatchObject({
      first_utm: { content: 'abc123' },
      first_sector: 'barber',
      first_seen_at: '2026-11-04T10:00:00.000Z',
    });
  });

  it('videosuz gelen kullanıcıda video boş kalır', () => {
    captureLanding('');
    track('project_created');
    expect(getEvents().map((e) => e.video)).toEqual([null, null]);
  });

  it('depolama kapalıysa uygulama hata vermez', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('kapalı');
      },
      setItem: () => {
        throw new Error('kapalı');
      },
    });
    expect(() => captureLanding(VIDEO_LINK)).not.toThrow();
    expect(() => track('visit')).not.toThrow();
    expect(getEvents()).toEqual([]);
  });
});

describe('olaylar', () => {
  it('ziyaret oturum başına bir kez sayılır', () => {
    captureLanding(VIDEO_LINK);
    captureLanding(VIDEO_LINK);
    expect(getEvents().filter((e) => e.name === 'visit')).toHaveLength(1);
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    captureLanding(VIDEO_LINK);
    expect(getEvents().filter((e) => e.name === 'visit')).toHaveLength(2);
  });

  it('her olay ilk geldiği videoyu taşır', () => {
    captureLanding(VIDEO_LINK);
    track('quick_mode_completed', { sector: 'barber' });
    expect(getEvents().at(-1)).toMatchObject({
      name: 'quick_mode_completed',
      video: 'abc123',
      props: { sector: 'barber' },
    });
  });

  it('kayıt sınırlıdır', () => {
    for (let i = 0; i < 250; i++) track('compare_viewed');
    expect(getEvents()).toHaveLength(200);
  });

  it('video başına rapor: hızlı analiz tamamlama ve PDF', () => {
    captureLanding(VIDEO_LINK);
    track('project_created');
    track('quick_mode_completed');
    track('pdf_downloaded');
    track('verdict_shown', { verdict: 'GO' });
    // Aynı kişi ertesi gün ikinci videodan gelir: ziyaret o videoya, sonraki iş ilk videoya yazılır.
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    captureLanding('?utm_content=ikinci');
    track('pdf_downloaded');
    const stats = statsByVideo(getEvents());
    expect(stats.get('abc123')).toEqual({
      visit: 1,
      project_created: 1,
      quick_mode_completed: 1,
      pdf_downloaded: 2,
    });
    expect(stats.get('ikinci')).toEqual({
      visit: 1,
      project_created: 0,
      quick_mode_completed: 0,
      pdf_downloaded: 0,
    });
  });
});
