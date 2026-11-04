// İP-2.4a kabul: yüz bulanık gider, koordinat gitmez, öneri onaysız yazılmaz, izin reddi akışı durdurmaz.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });
test.setTimeout(120_000);

const FACE = join(import.meta.dirname, 'fixtures/face.jpg');
const STREET = join(import.meta.dirname, 'fixtures/street-face.jpg');
const BLANK = join(import.meta.dirname, 'fixtures/blank.jpg');

const RESULT = {
  summary: 'Dar ama görünür bir cephe.',
  visible: true,
  access: true,
  anchor: null,
  corner: null,
  neighbors: [{ side: 'left', type: 'Kahveci', name: 'Komşu Kahve', sameSector: true }],
  signage: { fascia: 'limited', projecting: null, windowArea: true, obstructions: ['Ağaç'], note: '' },
  facade: {
    condition: 'fair',
    ideas: [{ idea: 'Ahşap kaplama', reason: 'Sokaktaki taş cepheden ayrışır.' }],
    style: 'wood',
    palette: null,
    awning: null,
  },
  strengths: [],
  fixes: [],
  notVisible: ['Köşe olup olmadığı'],
};

async function openSite(page: Page) {
  await page.goto('/tr');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  await page.goto(page.url().replace(/\/finance$/, '/site'));
  await expect(page.getByTestId('inspect')).toBeVisible();
}

/** Karedeki bir bölgenin komşu pikseller arası ortanca farkı; mozaik hücrelerin içinde sıfıra yakındır. */
const sharpness = (page: Page, dataUrl: string, box: [number, number, number, number]) =>
  page.evaluate(
    async ([url, [x, y, w, h]]) => {
      const img = new Image();
      img.src = url as string;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(x as number, y as number, w as number, h as number).data;
      const diffs: number[] = [];
      for (let i = 4; i < d.length; i += 4) diffs.push(Math.abs(d[i]! - d[i - 4]!));
      return diffs.sort((p, q) => p - q)[diffs.length >> 1]!;
    },
    [dataUrl, box] as const,
  );

test('yüz bulanık gider, koordinat gitmez, öneriler onayla yazılır, rapora girer', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 40.98765, longitude: 29.02468, accuracy: 12 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  let sent = '';
  await page.route('**/api/inspect', async (route) => {
    sent = route.request().postData() ?? '';
    await route.fulfill({ json: { result: RESULT } });
  });
  await openSite(page);

  // Konum izinle okunur; onay ve kare olmadan gönderim kapalı.
  await expect(page.getByTestId('no-checkin')).toBeVisible();
  await page.getByTestId('locate').click();
  await expect(page.getByTestId('checkin')).toContainText('±12 m');
  await expect(page.getByTestId('inspect')).toBeDisabled();

  await page.getByTestId('file-front').setInputFiles(FACE);
  await expect(page.getByTestId('faces-front')).toHaveText('1 yüz kapatıldı', { timeout: 60_000 });
  await expect(page.getByTestId('inspect')).toBeDisabled();
  await page.getByTestId('consent').check();
  await page.getByTestId('inspect').click();
  await expect(page.getByTestId('res-summary')).toHaveText(RESULT.summary);

  // İstekte koordinat yok, kare JPEG; yüz bölgesi mozaik.
  const body = JSON.parse(sent);
  expect(Object.keys(body).sort()).toEqual(['area', 'consent', 'frames', 'locale', 'sector']);
  expect(sent).not.toContain('40.98765');
  expect(sent).not.toContain('29.02468');
  expect(body.frames[0].slot).toBe('front');
  expect(body.frames[0].data).toMatch(/^data:image\/jpeg;base64,/);
  // Görünmeyen bilgi "görünmüyor" olarak çıkar, tahmin edilmez.
  await expect(page.getByTestId('res-corner')).toHaveText('Görünmüyor');
  await expect(page.getByTestId('res-not-visible')).toContainText('Köşe olup olmadığı');
  await expect(page.getByTestId('sign-legal')).toContainText('izin durumunu söylemez');

  // Hiçbir şey kendiliğinden yazılmaz; "Uygula" yalnız o maddeyi yazar.
  const stored = () =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('bitm:project:'))!;
      return JSON.parse(localStorage.getItem(key)!);
    });
  await expect(page.getByText('Kaydedildi')).toBeVisible();
  const before = await stored();
  expect(before.site.inspection.result.summary).toBe(RESULT.summary);
  expect(before.site.checkin.accuracyM).toBe(12);
  const compsBefore = before.input.comp.length;
  await page.getByTestId('sug-chk-access').getByRole('button').click();
  await expect(page.getByTestId('sug-chk-access').getByRole('button')).toHaveText('Uygulandı');
  await page.getByTestId('sug-comp').getByRole('button').click();
  await expect(page.getByTestId('sug-comp').getByRole('button')).toBeDisabled();
  await expect.poll(async () => (await stored()).input.comp.length).toBe(compsBefore + 1);
  const after = await stored();
  expect(before.input.loc.chk.access).not.toBe(1);
  expect(after.input.loc.chk.access).toBe(1);
  expect(after.input.loc.chk.visible).toBe(before.input.loc.chk.visible);
  expect(after.shop.style).toBe(before.shop.style);

  // Sayfa yenilenince kareler gider, kayıt kalır.
  await page.reload();
  await expect(page.getByTestId('res-summary')).toHaveText(RESULT.summary);
  await expect(page.getByTestId('preview-front')).toHaveCount(0);

  // Kayıt silinebilir.
  await page.getByTestId('delete-result').click();
  await expect(page.getByTestId('res-summary')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('yüz bölgesi geri döndürülemez şekilde kapanır, uzaktaki yüz de bulunur', async ({ page }) => {
  await page.route('**/api/inspect', (route) => route.fulfill({ json: { result: RESULT } }));
  await openSite(page);

  // Sokaktaki küçük yüz: tek geçişte kaçan durum, parçalı tarama yakalar.
  await page.getByTestId('file-left').setInputFiles(STREET);
  await expect(page.getByTestId('faces-left')).toHaveText('1 yüz kapatıldı', { timeout: 60_000 });

  // Yakın yüz: gönderilen karede yüz bölgesi düz, görüntünün geri kalanı olduğu gibi.
  await page.getByTestId('file-front').setInputFiles(FACE);
  await expect(page.getByTestId('faces-front')).toHaveText('1 yüz kapatıldı', { timeout: 60_000 });
  const src = await page.getByTestId('preview-front').getAttribute('src');
  const original = `data:image/jpeg;base64,${readFileSync(FACE).toString('base64')}`;
  const faceBox: [number, number, number, number] = [185, 95, 70, 70];
  const hidden = await sharpness(page, src!, faceBox);
  const plain = await sharpness(page, original, faceBox);
  expect(hidden).toBeLessThanOrEqual(1);
  expect(plain).toBeGreaterThan(hidden);
});

test('yüzsüz kare sayılır, konum reddi akışı durdurmaz, hata kaydedilmez', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
  });
  let reply: unknown = { error: 'invalid_output' };
  let status = 502;
  await page.route('**/api/inspect', (route) => route.fulfill({ status, json: reply }));
  await openSite(page);

  await page.getByTestId('locate').click();
  await expect(page.locator('p[role=alert]')).toContainText('konum teyidi yok');
  await expect(page.getByTestId('no-checkin')).toBeVisible();

  await page.getByTestId('file-front').setInputFiles(BLANK);
  await expect(page.getByTestId('faces-front')).toHaveText('Yüz bulunamadı', { timeout: 60_000 });
  await page.getByTestId('consent').check();

  // Geçersiz yanıt: hata görünür, kısmi veri yazılmaz.
  await page.getByTestId('inspect').click();
  await expect(page.getByTestId('send-error')).toContainText('hiçbir şey kaydedilmedi');
  await expect(page.getByTestId('res-summary')).toHaveCount(0);

  // Sunucu 200 dönse bile şemaya uymayan sonuç reddedilir.
  status = 200;
  reply = { result: { summary: 'yarım' } };
  await page.getByTestId('inspect').click();
  await expect(page.getByTestId('send-error')).toContainText('hiçbir şey kaydedilmedi');
  await expect(page.getByTestId('res-summary')).toHaveCount(0);

  // Konum yoksa incele yine çalışır.
  reply = { result: RESULT };
  await page.getByTestId('inspect').click();
  await expect(page.getByTestId('res-summary')).toHaveText(RESULT.summary);
});

test('yüz algılama yüklenemezse kare gönderilemez', async ({ page }) => {
  await page.route('**/mediapipe/**', (route) => route.abort());
  await openSite(page);
  await page.getByTestId('file-front').setInputFiles(FACE);
  await expect(page.getByTestId('frame-error')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('preview-front')).toHaveCount(0);
  await page.getByTestId('consent').check();
  await expect(page.getByTestId('inspect')).toBeDisabled();
});

test('sunucu ucu: koordinat ve onaysız istek reddedilir, anahtar yoksa açık hata', async ({ request }) => {
  const frame = { slot: 'front', data: 'data:image/jpeg;base64,QUJD' };
  const ok = { locale: 'tr', sector: 'coffee', area: 'Moda', consent: true, frames: [frame] };
  const post = (data: unknown) => request.post('/api/inspect', { data });

  expect((await post({ ...ok, lat: 41, lng: 29 })).status()).toBe(400);
  expect((await post({ ...ok, consent: false })).status()).toBe(400);
  expect((await post({ ...ok, frames: [] })).status()).toBe(400);
  expect((await post({ ...ok, frames: [frame, frame] })).status()).toBe(400);
  expect((await post({ ...ok, sector: 'yok' })).status()).toBe(400);
  expect(
    (await post({ ...ok, frames: [{ slot: 'front', data: 'data:image/png;base64,QUJD' }] })).status(),
  ).toBe(400);

  const res = await post(ok);
  expect(res.status()).toBe(503);
  expect(await res.json()).toEqual({ error: 'not_configured' });
});
