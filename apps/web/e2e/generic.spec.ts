// İP-1.9 kabul: ülke olarak Fransa seçilince uygulama baştan sona çalışıyor, hiçbir TR/US varsayılanı
// sızmıyor, bilgi bandı her ekranda görünüyor.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const TABS = [
  '',
  '/finance',
  '/area',
  '/location',
  '/pricing',
  '/storefront',
  '/legal',
  '/compare',
  '/report',
];
const LEAK = /₺|\bTRY\b|\bUSD\b|\$|KDV|SGK|stopaj|Kadıköy|Moda|Manhattan|Austin|videodaki/i;
const BAND = 'Bu ülke için yerel veri ve mevzuat desteği henüz yok.';

/** Ekrandaki metin; para birimi seçicisinin seçenekleri (USD, TRY) sızıntı değildir. */
const screenText = (page: Page) =>
  page
    .locator('.wrap')
    .first()
    .evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[data-testid=band-currency]').forEach((x) => x.remove());
      return copy.textContent ?? '';
    });

const startFrance = async (page: Page) => {
  await page.goto('/tr');
  await page.getByTestId('sample-select').selectOption('__other');
  await page.getByTestId('country-select').selectOption('FR');
  await page.getByTestId('currency-select').selectOption('EUR');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  return page.url().replace(/\/finance$/, '');
};

test('Fransa: bütün ekranlar çalışır, band görünür, sızıntı yok', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = await startFrance(page);

  for (const tab of TABS) {
    await page.goto(`${base}${tab}`);
    await expect(page.getByTestId('generic-band'), tab).toContainText(BAND);
    const text = await screenText(page);
    expect(text.match(LEAK), `${tab}: ${text.match(LEAK)?.[0]}`).toBeNull();
  }

  // Boş analizde karar yok.
  await page.goto(base);
  await expect(page.getByTestId('verdict')).toHaveText('EKSİK VERİ');
  await expect(page.getByTestId('verdict-why')).toContainText('ürün veya hizmet fiyatı');
  await expect(page.getByTestId('conf-share')).toContainText('Henüz doldurulmamış kısım: %100');
  await expect(page.getByTestId('permits-badge')).toHaveCount(0);
  // Veri yokken sayı ve puan uydurulmaz.
  await expect(page.getByTestId('invest')).toHaveText('—');
  await expect(page.getByTestId('payback')).toHaveText('—');

  // Mevzuat listesi yerine genel uyarı.
  await page.goto(`${base}/legal`);
  await expect(page.getByTestId('legal-generic')).toBeVisible();

  // Rakamlar girilince karar çıkar; euro ile gösterilir, boş oranlar söylenir.
  await page.goto(`${base}/finance`);
  await page.locator('#fixed-v-0').fill('2000');
  await page.locator('#items-price-0').fill('4,5');
  await page.locator('#items-cost-0').fill('1');
  await page.locator('#scen-1').fill('120');
  await page.locator('#days').fill('26');
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });
  await expect(page.getByTestId('verdict')).not.toHaveText('EKSİK VERİ');
  await expect(page.getByTestId('empty-rates')).toBeVisible();

  await page.goto(base);
  await expect(page.getByTestId('invest')).toContainText('€');

  // PDF iner.
  await page.goto(`${base}/report`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('pdf-download').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByTestId('pdf-status')).toHaveText('Rapor indirildi.');

  // Para birimi sonradan değişebilir; "Temizle" boş projeye döner.
  await page.getByTestId('band-currency').selectOption('CHF');
  await page.goto(base).catch(() => {});
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Temizle' }).click();
  await expect(page.getByTestId('verdict')).toHaveText('EKSİK VERİ');
  expect(errors).toEqual([]);
});

test('hızlı mod: Fransa seçilir, para birimi zorunlu, örnek düğmesi yok', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tr/projects/new?sector=coffee');
  await page.locator('#quick-other').selectOption('FR');
  await expect(page.getByTestId('quick-sample')).toHaveCount(0);
  const next = page.getByRole('button', { name: 'İleri' });
  // Para birimi seçilmeden adım geçmez.
  await expect(next).toBeDisabled();
  await page.locator('#quick-currency').selectOption('EUR');
  await next.click();

  await page.locator('#quick-input').fill('Lyon');
  await next.click();
  await page.locator('#quick-input').fill('2000');
  await next.click();
  await page.locator('#quick-input').fill('3000');
  await next.click();
  await page.getByRole('button', { name: 'Her gün başında' }).click();
  await next.click();
  await page.locator('#quick-input').fill('4');
  await page.locator('#quick-cost').fill('1');
  await next.click();
  await page.locator('#quick-input').fill('120');
  await next.click();
  await page.locator('#quick-input').fill('50000');
  await next.click();
  await page.locator('#quick-input').fill('60');
  await page.getByRole('button', { name: 'Kararı gör' }).click();
  await page.waitForURL(/\/projects\/(?!new)[^/?]+$/);

  await expect(page.getByTestId('generic-band')).toContainText(BAND);
  await expect(page.getByTestId('invest')).toContainText('€');
  const text = await screenText(page);
  expect(text.match(LEAK)?.[0]).toBeUndefined();
  expect(errors).toEqual([]);
});
