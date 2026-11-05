// İP-2.9 kabul: Fiyat ekranında tablo, kendi yerin, paket indirimi, kanal farkı; eski gözlem medyana girmez ama görünür;
// teslimat ve dükkân karışmaz; eşik altında "veri yetersiz"; tek gözlemden zam çıkmaz. Dış çağrı yok.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);

const seen = (itemKey: string, price: number, over: Record<string, unknown> = {}) => ({
  itemKey,
  rawName: 'kalem',
  price,
  currency: 'TRY',
  sizeNote: '',
  channel: 'in_store',
  source: 'door',
  sourceUrl: null,
  observedOn: day(10),
  sourceDatedOn: null,
  ...over,
});

async function start(page: Page) {
  await page.goto('/tr');
  await page.getByTestId('sector-select').selectOption('barber');
  await page.getByTestId('sample-select').selectOption('ist');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  return page.url().replace(/\/finance$/, '');
}

/** Gözlemleri kayda yazar; kart akışı İP-2.8 testinde sınanıyor. */
async function seed(page: Page, base: string, rows: ReturnType<typeof seen>[][]) {
  await page.evaluate((rows) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bitm:project:'))!;
    const doc = JSON.parse(localStorage.getItem(key)!);
    rows.forEach((observations, i) => {
      doc.input.comp[i] ??= structuredClone(doc.input.comp[0]);
      doc.input.comp[i].research = {
        sources: [],
        observations,
        offers:
          i === 0
            ? [{ type: 'student', note: '', source: 'door', observedOn: observations[0]?.observedOn }]
            : [],
        checks: [],
        serviceFee: i === 0 ? 25 : null,
        visibility: i === 0 ? 'ask' : 'unknown',
      };
    });
    localStorage.setItem(key, JSON.stringify(doc));
  }, rows);
  await page.goto(`${base}/pricing`);
}

const rowText = (page: Page, id: string) => page.getByTestId(id).locator('td');

test('gözlem yoksa kart yolunu söyler', async ({ page }) => {
  const base = await start(page);
  await page.goto(`${base}/pricing`);
  await expect(page.getByTestId('price-map-empty')).toContainText('Rakibi incele');
  await expect(page.getByTestId('price-map-items')).toHaveCount(0);
});

test('eşik altında veri yetersiz: eksikler listelenir, seviye çıkmaz', async ({ page }) => {
  const base = await start(page);
  await seed(page, base, [[seen('cut', 500), seen('beard', 200)], [seen('cut', 600)]]);
  await expect(page.getByTestId('price-map-insufficient')).toContainText('Veri yetersiz.');
  await expect(page.getByTestId('price-map-missing')).toContainText('Sakal');
  await expect(page.getByTestId('price-map-own')).toHaveCount(0);
  await expect(rowText(page, 'price-map-rival-0').last()).toHaveText('—');
  // Aralık yine de görünür.
  await expect(rowText(page, 'price-map-item-cut').nth(2)).toContainText('550');
  await expect(page.getByTestId('price-map-changes')).toHaveCount(0);
});

test('harita: aralık, kendi yerin, seviye, eski gözlem, kanal, paket, zam', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = await start(page);
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(page.url()).origin) external.push(r.url());
  });
  const delivery = { channel: 'delivery', source: 'delivery' };
  await seed(page, base, [
    [
      seen('cut', 500, { observedOn: day(40) }),
      seen('cut', 550),
      seen('beard', 200),
      seen('cut', 660, delivery),
      seen('beard', 240, delivery),
    ],
    [
      seen('cut', 600),
      seen('beard', 300),
      seen('combo', 720),
      seen('cut', 720, delivery),
      seen('beard', 360, delivery),
    ],
    [seen('cut', 800), seen('beard', 400), seen('cut', 960, delivery), seen('beard', 480, delivery)],
    [seen('cut', 5000, { observedOn: day(200) }), seen('beard', 350)],
  ]);

  const map = page.getByTestId('price-map');
  await expect(map).toBeVisible();

  // Eski fiyat aralığa girmez: en yüksek kesim 800.
  const cut = rowText(page, 'price-map-item-cut');
  await expect(cut.nth(1)).toContainText('550');
  await expect(cut.nth(2)).toContainText('600');
  await expect(cut.nth(3)).toContainText('800');
  await expect(cut.nth(4)).toContainText('+1 eski');

  // Ama görünür, kaynak ve tarihle.
  const staleCell = page.getByTestId('price-map-rival-3').locator('td[data-stale]');
  await expect(staleCell).toContainText('5.000');
  await expect(staleCell).toContainText('eski');
  await expect(page.getByTestId('price-map-rival-1')).toContainText('Kapıdaki liste');

  // Servis ücreti ayrı sütunda; seviye ve kendi yerin.
  await expect(page.getByTestId('price-map-rival-0')).toContainText('25');
  await expect(rowText(page, 'price-map-rival-2').last()).toHaveText('Yüksek');
  await expect(page.getByTestId('price-map-own')).toContainText('Senin fiyat endeksin');

  // Paket, kanal farkı, zam, görünürlük ve kampanya.
  await expect(page.getByTestId('price-map-bundles')).toContainText('Saç + sakal');
  await expect(page.getByTestId('price-map-gaps')).toContainText('teslimat dükkândan %20,0 pahalı');
  const changes = page.getByTestId('price-map-changes');
  await expect(changes.locator('li')).toHaveCount(1);
  await expect(changes).toContainText('Saç kesimi');
  await expect(changes).toContainText('+%10,0');
  await expect(page.getByTestId('price-map-policies')).toContainText('Öğrenci indirimi');

  // Teslimat ayrı kanal: aralık değişir, kendi fiyatın kıyaslanmaz.
  await page.getByTestId('price-map-channel').selectOption('delivery');
  await expect(rowText(page, 'price-map-item-cut').nth(2)).toContainText('720');
  await expect(rowText(page, 'price-map-item-cut').nth(5)).toHaveText('—');
  await expect(page.getByTestId('price-map-own')).toHaveCount(0);

  // Karara dokunmaz: harita açıkken rakip fiyatları aynı kaldı.
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bitm:project:'))!;
    return JSON.parse(localStorage.getItem(key)!).input.comp[0].price;
  });
  expect(stored).toBe(650);

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
