// İP-1.6: rapor ekranından PDF iner; içerik kabulü lib/report.test.ts'de metin çıkarılarak denetlenir.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.use({ locale: 'tr-TR' });

test('rapor ekranından PDF iner, seçenekler gönderilir', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/tr');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  await page.goto(page.url().replace(/\/finance$/, '/report'));

  // Aday yokken karşılaştırma seçilemez.
  await expect(page.locator('#pdf-cmp')).toBeDisabled();
  await page.locator('#pdf-monthly').uncheck();

  const [download, request] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForRequest('**/api/report'),
    page.getByTestId('pdf-download').click(),
  ]);
  expect(download.suggestedFilename()).toBe('bu-is-tutar-mi-kadikoy-moda.pdf');
  const body = request.postDataJSON();
  expect(body.locale).toBe('tr');
  expect(body.options.monthly).toBe(false);
  // Mağaza görseli tarayıcıda JPEG'e çevrilip gönderilir.
  expect(body.shopImage).toMatch(/^data:image\/jpeg;base64,/);

  const pdf = readFileSync(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByTestId('pdf-status')).toHaveText('Rapor indirildi.');
  expect(errors).toEqual([]);
});

test('geçersiz istek reddedilir', async ({ request }) => {
  expect((await request.post('/api/report', { data: { locale: 'tr' } })).status()).toBe(400);
  const bad = await request.post('/api/report', {
    data: { locale: 'tr', options: { monthly: true, cmp: true, shop: true }, doc: { v: 2 } },
  });
  expect(bad.status()).toBe(400);
});
