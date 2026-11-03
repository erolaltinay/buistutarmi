// İP-1.3 kabul: örnek veriyle açılan analizde güven < %50 ve "ön değerlendirme" etiketi görünüyor;
// kullanıcı kira, personel, fiyatı girince oran artıyor.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const share = (page: Page, pct: number) =>
  expect(page.getByTestId('conf-share')).toHaveText(`Örnek veya tahmini veriye dayanan kısım: %${pct}`);

test('örnek analiz ön değerlendirmedir; kira, personel ve fiyat girilince güven artar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/tr');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  const base = page.url().replace(/\/finance$/, '');
  // Finans ekranındaki karar kartında da etiket var.
  await expect(page.getByTestId('preliminary')).toBeVisible();

  await page.goto(base);
  await share(page, 100);
  await expect(page.getByTestId('preliminary')).toBeVisible();
  await expect(page.getByTestId('conf-rent')).toBeVisible();

  // Kahve örneğinde ilk sabit gider satırı kira, ikincisi personel.
  await page.goto(`${base}/finance`);
  await page.locator('#fixed-v-0').fill('45000');
  await page.locator('#fixed-v-1').fill('52000');
  await page.locator('#items-price-0').fill('125');
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });

  await page.goto(base);
  await share(page, 60);
  await expect(page.getByTestId('conf-rent')).toHaveCount(0);
  await expect(page.getByTestId('preliminary')).toBeVisible();

  // Değeri değiştirmeden "Doğru" demek de kullanıcı verisi sayılır: baz senaryo (12) + maliyet (10).
  await page.getByTestId('conf-base').getByRole('button', { name: 'Doğru' }).click();
  await page.getByTestId('conf-cost').getByRole('button', { name: 'Doğru' }).click();
  await share(page, 38);
  await expect(page.getByTestId('preliminary')).toHaveCount(0);

  // Kayıtta kalır; "Örneğe dön" etiketleri sıfırlar.
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });
  await page.reload();
  await share(page, 38);
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Örneğe dön' }).click();
  await share(page, 100);
  expect(errors).toEqual([]);
});
