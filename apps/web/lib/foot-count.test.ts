// İP-2.3: sayım süresi, dokunuş, Lokasyon'a yazma ve kaynak etiketi.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changedGroups, confidence, GROUPS } from './confidence';
import {
  applyCount,
  canWrite,
  clearSession,
  countedSlotCount,
  elapsedMinutes,
  isCounted,
  isRunning,
  loadSession,
  nextSlot,
  previewValue,
  remainingMs,
  removeCount,
  saveSession,
  settle,
  slotCounts,
  slotDisagrees,
  slotValue,
  startCount,
  stopCount,
  tap,
  undoTap,
  type CountSession,
} from './foot-count';
import { projectFromSample } from './project';
import { analyze } from '@bitm/engine';
import { engineArchetype, engineCountry } from '@bitm/archetypes';

const T0 = 1_000_000;
const MIN = 60_000;
const finished = (count: number, minutes = 15, stoppedAfter = minutes): CountSession => ({
  ...startCount('wd', 0, minutes, T0),
  count,
  stoppedAt: T0 + stoppedAfter * MIN,
});

describe('sayım', () => {
  it('süre dolana kadar sayar, sonra dokunuş yok sayılır', () => {
    let s = startCount('wd', 1, 15, T0);
    s = tap(tap(s, T0 + 1), T0 + 2);
    expect(s.count).toBe(2);
    expect(isRunning(s, T0 + 15 * MIN - 1)).toBe(true);
    expect(isRunning(s, T0 + 15 * MIN)).toBe(false);
    expect(tap(s, T0 + 15 * MIN).count).toBe(2);
  });

  it('geri alma sıfırın altına inmez', () => {
    const s = startCount('wd', 0, 15, T0);
    expect(undoTap(s).count).toBe(0);
    expect(undoTap(tap(s, T0 + 1)).count).toBe(0);
  });

  it('kalan süre ve erken bitirme', () => {
    const s = startCount('wd', 0, 15, T0);
    expect(remainingMs(s, T0 + 5 * MIN)).toBe(10 * MIN);
    expect(remainingMs(s, T0 + 20 * MIN)).toBe(0);
    const stopped = stopCount(s, T0 + 5 * MIN);
    expect(elapsedMinutes(stopped)).toBe(5);
    expect(remainingMs(stopped, T0 + 6 * MIN)).toBe(10 * MIN);
    expect(isRunning(stopped, T0 + 6 * MIN)).toBe(false);
    expect(tap(stopped, T0 + 6 * MIN).count).toBe(0);
    expect(stopCount(stopped, T0 + 9 * MIN).stoppedAt).toBe(stopped.stoppedAt);
  });

  it('saat geri alınsa da süre eksiye düşmez', () => {
    const s = startCount('wd', 0, 15, T0);
    expect(remainingMs(s, T0 - 5 * MIN)).toBe(15 * MIN);
    expect(elapsedMinutes(stopCount(s, T0 - 5 * MIN))).toBe(0);
  });

  it('süresi dolan sayım dolduğu anda kapanır, dönüş anında değil', () => {
    const s = settle(startCount('wd', 0, 15, T0), T0 + 90 * MIN);
    expect(s.stoppedAt).toBe(T0 + 15 * MIN);
    expect(elapsedMinutes(s)).toBe(15);
    expect(settle(startCount('wd', 0, 15, T0), T0 + 5 * MIN).stoppedAt).toBeNull();
  });

  it('bir dakikadan kısa sayım yazılamaz', () => {
    expect(canWrite(finished(3, 15, 0.5))).toBe(false);
    expect(canWrite(finished(3, 15, 1))).toBe(true);
    expect(canWrite(startCount('wd', 0, 15, T0))).toBe(false);
  });

  it('farklı süre tablonun sayım süresine çevrilir', () => {
    expect(slotValue([{ count: 70, minutes: 15 }], 15)).toBe(70);
    expect(slotValue([{ count: 10, minutes: 5 }], 15)).toBe(30);
    expect(slotValue([{ count: 70, minutes: 15 }], 30)).toBe(140);
    expect(slotValue([{ count: 0, minutes: 15 }], 15)).toBe(0);
    expect(slotValue([], 15)).toBe(0);
  });

  it('birden çok sayımda uzun sayım daha ağır basar', () => {
    const short = { count: 10, minutes: 5 };
    const long = { count: 40, minutes: 30 };
    expect(slotValue([short, long], 15)).toBe(Math.round((50 / 35) * 15));
    expect(slotValue([short, long], 15)).toBe(21);
  });

  it('sayımlar %30tan fazla ayrışınca uyarır', () => {
    const at = (count: number) => ({ count, minutes: 15 });
    expect(slotDisagrees([at(100)])).toBe(false);
    expect(slotDisagrees([at(100), at(130)])).toBe(false);
    expect(slotDisagrees([at(100), at(131)])).toBe(true);
    expect(slotDisagrees([at(0), at(10)])).toBe(true);
    expect(slotDisagrees([at(0), at(0)])).toBe(false);
    // Süre farkı hızla düzeltilir: 5 dakikada 10 ile 15 dakikada 30 aynı hızdır.
    expect(slotDisagrees([{ count: 10, minutes: 5 }, at(30)])).toBe(false);
  });
});

describe("Lokasyon'a yazma", () => {
  const doc = () => projectFromSample('barber', 'ist', 'p1');

  it('yalnız seçilen dilime yazar, süreyi tablo süresine çevirir', () => {
    const d = doc();
    const before = structuredClone(d.input.loc.foot);
    d.input.loc.countMin = 15;
    applyCount(d, { ...finished(10, 15, 5), day: 'we', slot: 2 }, '2026-11-05T10:00:00Z');
    expect(d.input.loc.foot.we[2]).toBe(30);
    expect(d.input.loc.foot.we[0]).toBe(before.we[0]);
    expect(d.input.loc.foot.wd).toEqual(before.wd);
    expect(d.input.loc.countMin).toBe(15);
    expect(isCounted(d.input.loc, 'we', 2)).toBe(true);
    expect(isCounted(d.input.loc, 'we', 1)).toBe(false);
  });

  it('sayım süresi boşsa bu sayımın süresi olur', () => {
    const d = doc();
    d.input.loc.countMin = null;
    applyCount(d, finished(20, 10), '2026-11-05T10:00:00Z');
    expect(d.input.loc.countMin).toBe(10);
    expect(d.input.loc.foot.wd[0]).toBe(20);
  });

  it('aynı dilim yeniden sayılınca ortalamaya eklenir', () => {
    const d = doc();
    d.input.loc.countMin = 15;
    applyCount(d, finished(20), 'a');
    expect(previewValue(d.input.loc, finished(40))).toBe(30);
    applyCount(d, finished(40), 'b');
    expect(d.input.loc.foot.wd[0]).toBe(30);
    expect(slotCounts(d.input.loc, 'wd', 0)).toHaveLength(2);
    expect(countedSlotCount(d.input.loc)).toBe(1);
    expect(isCounted(d.input.loc, 'wd', 0)).toBe(true);
  });

  it('başka dilimin sayımı ortalamaya karışmaz', () => {
    const d = doc();
    d.input.loc.countMin = 15;
    applyCount(d, finished(20), 'a');
    applyCount(d, { ...finished(100), slot: 1 }, 'b');
    expect(d.input.loc.foot.wd[0]).toBe(20);
    expect(d.input.loc.foot.wd[1]).toBe(100);
  });

  it('elle yazılan rakam ortalamaya girmez', () => {
    const d = doc();
    d.input.loc.countMin = 15;
    applyCount(d, finished(20), 'a');
    d.input.loc.foot.wd[0] = 999;
    applyCount(d, finished(40), 'b');
    expect(d.input.loc.foot.wd[0]).toBe(30);
    expect(isCounted(d.input.loc, 'wd', 0)).toBe(true);
  });

  it('sayım silinince ortalama yeniden hesaplanır, sonuncusu silinince dilim 0 olur', () => {
    const d = doc();
    d.input.loc.countMin = 15;
    applyCount(d, finished(20), 'a');
    applyCount(d, finished(40), 'b');
    removeCount(d, 'wd', 0, 1);
    expect(d.input.loc.foot.wd[0]).toBe(20);
    expect(isCounted(d.input.loc, 'wd', 0)).toBe(true);
    expect(slotCounts(d.input.loc, 'wd', 0).map((c) => c.count)).toEqual([20]);
    removeCount(d, 'wd', 0, 5);
    expect(slotCounts(d.input.loc, 'wd', 0)).toHaveLength(1);
    removeCount(d, 'wd', 0, 0);
    expect(d.input.loc.foot.wd[0]).toBe(0);
    expect(isCounted(d.input.loc, 'wd', 0)).toBe(false);
  });

  it('sayım silinince altı dilim bozulursa measured kalkar', () => {
    const d = doc();
    (['wd', 'we'] as const).forEach((day) =>
      [0, 1, 2].forEach((slot) => applyCount(d, { ...finished(20), day, slot }, 'a')),
    );
    expect(d.sources?.foot).toBe('measured');
    applyCount(d, finished(30), 'b');
    removeCount(d, 'wd', 0, 1);
    expect(d.sources?.foot).toBe('measured');
    removeCount(d, 'wd', 0, 0);
    expect(d.sources?.foot).toBe('user');
  });

  it('elle değişen değer veya süre artık sayılmış değildir', () => {
    const d = doc();
    applyCount(d, finished(20), 'a');
    d.input.loc.foot.wd[0] = 99;
    expect(isCounted(d.input.loc, 'wd', 0)).toBe(false);
    const e = doc();
    applyCount(e, finished(20), 'a');
    e.input.loc.countMin = 30;
    expect(isCounted(e.input.loc, 'wd', 0)).toBe(false);
  });

  it('altı dilim bitene kadar yaya verisi güvenilir sayılmaz, sonra measured', () => {
    const d = doc();
    const before = confidence(d.sources);
    (['wd', 'we'] as const).forEach((day) =>
      [0, 1, 2].forEach((slot) => {
        expect(d.sources?.foot).toBeUndefined();
        expect(confidence(d.sources)).toBe(before);
        applyCount(d, { ...finished(20), day, slot }, 'a');
      }),
    );
    expect(countedSlotCount(d.input.loc)).toBe(6);
    expect(d.sources?.foot).toBe('measured');
    expect(confidence(d.sources)).toBe(before + GROUPS.foot);
  });

  it('elle girilmiş veri kısmi sayımla geriye gitmez', () => {
    const d = doc();
    d.sources = { ...d.sources, foot: 'user' };
    applyCount(d, finished(20), 'a');
    expect(d.sources.foot).toBe('user');
  });

  it('sıradaki dilim sayılmamış ilk dilimdir', () => {
    const d = doc();
    expect(nextSlot(d.input.loc)).toEqual({ day: 'wd', slot: 0 });
    applyCount(d, finished(20), 'a');
    expect(nextSlot(d.input.loc)).toEqual({ day: 'wd', slot: 1 });
  });

  it('bozuk kayıt sayım sayılmaz', () => {
    const d = doc();
    (d.input.loc as unknown as { counts: unknown }).counts = [{ day: 'x' }];
    expect(countedSlotCount(d.input.loc)).toBe(0);
  });

  it('sonuç motora yaya sayımı olarak girer; kayıt alanı hesabı değiştirmez', () => {
    const d = doc();
    const run = () => analyze(d.input, engineArchetype('barber'), engineCountry('TR', d.input.cur));
    const before = run().location.dailyPassersby;
    const copy = structuredClone(d.input);
    applyCount(d, { ...finished(5000), day: 'wd', slot: 0 }, 'a');
    expect(run().location.dailyPassersby).toBeGreaterThan(before);
    expect(changedGroups(copy, d.input)).toEqual(['foot']);
    (d.input.loc as unknown as { counts: unknown }).counts = undefined;
    const without = run().location.dailyPassersby;
    applyCount(d, { ...finished(5000), day: 'wd', slot: 0 }, 'a');
    expect(run().location.dailyPassersby).toBe(without);
  });
});

describe('açık sayımın kaydı', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
  });

  it('kaydedilir, okunur, silinir', () => {
    const s = startCount('we', 2, 15, T0);
    expect(saveSession('p1', s)).toBe(true);
    expect(loadSession('p1')).toEqual(s);
    expect(loadSession('p2')).toBeNull();
    clearSession('p1');
    expect(loadSession('p1')).toBeNull();
  });

  it('bozuk kayıt yok sayılır', () => {
    localStorage.setItem('bitm:count:p1', '{"day":"x"}');
    expect(loadSession('p1')).toBeNull();
    localStorage.setItem('bitm:count:p1', 'bozuk');
    expect(loadSession('p1')).toBeNull();
  });

  it('depolama kapalıysa hata fırlatmaz', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('kapalı');
      },
      setItem: () => {
        throw new Error('kapalı');
      },
      removeItem: () => {
        throw new Error('kapalı');
      },
    });
    expect(saveSession('p1', startCount('wd', 0, 15, T0))).toBe(false);
    expect(loadSession('p1')).toBeNull();
    expect(() => clearSession('p1')).not.toThrow();
  });
});
