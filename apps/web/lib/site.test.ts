// İP-2.4a: öneriler onaysız veriye yazılmaz, bilinmeyen değer öneri olmaz; kayıt adayla birlikte gezer.
import { describe, expect, it } from 'vitest';
import { PALETTE_KEYS, type StorefrontInspection } from '@bitm/ai/schema';
import { PALETTES } from '../components/storefront-svg';
import { addCandidate, loadCandidate } from './compare';
import { dedupe, expandBox, tilesFor } from './faces';
import { areaFromDrag, scaledSize } from './frames';
import { projectFromSample } from './project';
import { applySuggestion, isApplied, isPoorAccuracy, SiteCheck, suggestionsFrom } from './site';

const result: StorefrontInspection = {
  summary: 'Dar cephe.',
  visible: true,
  access: false,
  anchor: null,
  corner: null,
  neighbors: [
    { side: 'left', type: 'Kahveci', name: 'Komşu Kahve', sameSector: true },
    { side: 'right', type: 'Fırın', name: null, sameSector: false },
    { side: 'opposite', type: 'Kafe', name: null, sameSector: true },
  ],
  signage: { fascia: 'limited', projecting: null, windowArea: true, obstructions: ['Ağaç'], note: '' },
  facade: { condition: 'fair', ideas: [], style: 'wood', palette: 'olive', awning: false },
  strengths: [],
  fixes: [],
  notVisible: [],
};

const KEYS = ['visible', 'access', 'anchor'];

describe('suggestionsFrom', () => {
  it('null alan öneri olmaz, listede olmayan madde atlanır', () => {
    const s = suggestionsFrom(result, KEYS);
    expect(s).toContainEqual({ kind: 'chk', key: 'visible', value: 1 });
    expect(s).toContainEqual({ kind: 'chk', key: 'access', value: 0 });
    expect(s.some((x) => x.kind === 'chk' && x.key === 'anchor')).toBe(false);
    expect(suggestionsFrom(result, ['access']).filter((x) => x.kind === 'chk')).toHaveLength(1);
  });

  it('yalnız aynı sektördeki komşu rakip adayı olur; adı okunmadıysa türüyle gelir', () => {
    const names = suggestionsFrom(result, KEYS).flatMap((x) => (x.kind === 'comp' ? [x.name] : []));
    expect(names).toEqual(['Komşu Kahve', 'Kafe']);
  });

  it('palet anahtarları mağaza görselinin sırasıyla aynı', () => {
    expect(PALETTES.map((p) => p.k)).toEqual([...PALETTE_KEYS]);
    expect(suggestionsFrom(result, KEYS)).toContainEqual({ kind: 'palette', value: 2 });
    expect(suggestionsFrom(result, KEYS)).toContainEqual({ kind: 'style', value: 1 });
  });
});

describe('applySuggestion', () => {
  it('yalnız seçilen öneriyi yazar', () => {
    const doc = projectFromSample('coffee', 'ist', 'p1');
    const before = structuredClone(doc);
    const s = suggestionsFrom(result, KEYS);
    expect(doc).toEqual(before);
    const access = s.find((x) => x.kind === 'chk' && x.key === 'access')!;
    doc.input.loc.chk.access = 1;
    expect(isApplied(doc, access)).toBe(false);
    applySuggestion(doc, access);
    expect(doc.input.loc.chk.access).toBe(0);
    expect(isApplied(doc, access)).toBe(true);
    expect(doc.shop).toEqual(before.shop);
    expect(doc.input.comp).toEqual(before.input.comp);
  });

  it('rakip önerisi listeye eklenir, ikinci kez eklenmiş sayılır', () => {
    const doc = projectFromSample('coffee', 'ist', 'p1');
    const n = doc.input.comp.length;
    const comp = suggestionsFrom(result, KEYS).find((x) => x.kind === 'comp')!;
    applySuggestion(doc, comp);
    expect(doc.input.comp).toHaveLength(n + 1);
    expect(isApplied(doc, comp)).toBe(true);
  });
});

describe('kayıt', () => {
  it('doğruluk eşiği', () => {
    const c = { lat: 41, lng: 29, capturedAt: '2026-11-04T10:00:00Z' };
    expect(isPoorAccuracy({ ...c, accuracyM: 100 })).toBe(false);
    expect(isPoorAccuracy({ ...c, accuracyM: 101 })).toBe(true);
  });

  it('şema geçersiz kaydı reddeder', () => {
    expect(SiteCheck.safeParse({ checkin: { lat: 200, lng: 0, accuracyM: 5, capturedAt: '' } }).success).toBe(
      false,
    );
    expect(SiteCheck.safeParse({}).success).toBe(true);
  });

  it('kayıt adayla birlikte saklanır ve geri yüklenir', () => {
    const doc = projectFromSample('coffee', 'ist', 'p1');
    const checkin = { lat: 41, lng: 29, accuracyM: 8, capturedAt: '2026-11-04T10:00:00Z' };
    doc.site = { checkin };
    addCandidate(doc, 'A', 'c1', '2026-11-04T10:00:00Z');
    doc.site = undefined;
    loadCandidate(doc, 'c1');
    expect(doc.site).toEqual({ checkin });
  });
});

describe('kare hazırlama', () => {
  it('uzun kenar 1600 pikseli geçmez, küçük görsel büyütülmez', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('parçalar görüntünün tamamını kaplar', () => {
    const tiles = tilesFor(1600, 1200, 240);
    const covered = (x: number, y: number) =>
      tiles.some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
    for (const [x, y] of [
      [0, 0],
      [1599, 0],
      [0, 1199],
      [1599, 1199],
      [800, 600],
    ] as const)
      expect(covered(x, y)).toBe(true);
    expect(tilesFor(400, 300, 480)).toEqual([]);
    expect(tilesFor(1000, 300, 480).every((t) => t.h === 300)).toBe(true);
  });

  it('kutu büyütülür ama görüntüden taşmaz', () => {
    const b = expandBox({ x: 5, y: 5, w: 20, h: 20 }, 28, 28);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.x + b.w).toBe(28);
    expect(b.y + b.h).toBe(28);
  });

  it('sürükleme kutu olur, ters yön ve taşma düzelir', () => {
    const box = { x: 100, y: 50, w: 200, h: 100 };
    expect(areaFromDrag({ x: 100, y: 50 }, { x: 300, y: 150 }, 1600, 1200)).toEqual(box);
    expect(areaFromDrag({ x: 300, y: 150 }, { x: 100, y: 50 }, 1600, 1200)).toEqual(box);
    expect(areaFromDrag({ x: 1500, y: 1100 }, { x: 1900, y: 1400 }, 1600, 1200)).toEqual({
      x: 1500,
      y: 1100,
      w: 100,
      h: 100,
    });
  });

  it('dokunuş plaka boyunda kutu bırakır, kutu görüntüde kalır', () => {
    const tap = areaFromDrag({ x: 800, y: 600 }, { x: 803, y: 602 }, 1600, 1200, 12);
    expect(tap.w).toBeCloseTo(128);
    expect(tap.h).toBeCloseTo(128 / 3);
    expect(tap.x + tap.w / 2).toBeCloseTo(800);
    expect(tap.y + tap.h / 2).toBeCloseTo(600);
    const edge = areaFromDrag({ x: 1595, y: 2 }, { x: 1595, y: 2 }, 1600, 1200, 12);
    expect(edge.x + edge.w).toBeCloseTo(1600);
    expect(edge.y).toBe(0);
    // Dik karede de boy uzun kenardan gelir.
    expect(areaFromDrag({ x: 50, y: 50 }, { x: 50, y: 50 }, 1200, 1600, 12).w).toBeCloseTo(128);
  });

  it('ince sürükleme de geçerli kutu verir', () => {
    const thin = areaFromDrag({ x: 100, y: 100 }, { x: 200, y: 100 }, 1600, 1200);
    expect(thin.w).toBe(100);
    expect(thin.h).toBeGreaterThanOrEqual(1);
  });

  it('aynı yüz teke iner, ayrı yüzler kalır', () => {
    const boxes = [
      { x: 0, y: 0, w: 20, h: 20 },
      { x: 2, y: 2, w: 20, h: 20 },
      { x: 100, y: 100, w: 20, h: 20 },
    ];
    expect(dedupe(boxes)).toHaveLength(2);
  });
});
