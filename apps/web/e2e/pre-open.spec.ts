// İP-2.7: açılış öncesi bekleme toplam yatırıma ve nakit açığına girer; öneri kendiliğinden uygulanmaz.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const money = async (page: Page, id: string) =>
  Number((await page.getByTestId(id).textContent())!.replace(/[^\d]/g, ''));

async function start(page: Page) {
  await page.goto('/tr');
  await page.getByTestId('sector-select').selectOption('coffee');
  await page.getByTestId('sample-select').selectOption('ist');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
}

test('öneri uygulanana kadar hesap değişmez; süre yatırımı artırır', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);

  const invest0 = await money(page, 'invest');
  const trough0 = await money(page, 'trough');
  await expect(page.getByTestId('preopen-missing')).toBeVisible();
  await expect(page.getByTestId('preopen-suggestion')).toContainText('genel bir rehberdir');
  await expect(page.getByTestId('preopen-cost')).toHaveCount(0);

  await page.getByTestId('preopen-apply').click();
  await expect(page.getByTestId('preopen-missing')).toHaveCount(0);
  await expect(page.getByTestId('preopen-apply')).toHaveCount(0);
  await expect(page.getByTestId('preopen-cost')).toBeVisible();
  const investSuggested = await money(page, 'invest');
  expect(investSuggested).toBeGreaterThan(invest0);
  expect(await money(page, 'trough')).toBeGreaterThan(trough0);

  // Elle de yazılır, kaydedilir, yenilemede kalır.
  await page.locator('#preOpenMonths').fill('6');
  const invest6 = await money(page, 'invest');
  expect(invest6).toBeGreaterThanOrEqual(investSuggested);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) => k.startsWith('bitm:project:'))!;
        return JSON.parse(localStorage.getItem(key)!).input.preOpenMonths;
      }),
    )
    .toBe(6);
  await page.reload();
  await expect(page.locator('#preOpenMonths')).toHaveValue('6');
  expect(await money(page, 'invest')).toBe(invest6);

  // Sıfırlanınca ilk rakama döner.
  await page.locator('#preOpenMonths').fill('0');
  await expect.poll(() => money(page, 'invest')).toBe(invest0);
  expect(errors).toEqual([]);
});

test('genel modda öneri çıkmaz, alan elle çalışır', async ({ page }) => {
  await page.goto('/tr');
  await page.getByTestId('sample-select').selectOption('__other');
  await page.getByTestId('country-select').selectOption('FR');
  await page.getByTestId('currency-select').selectOption('EUR');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  await expect(page.locator('#preOpenMonths')).toBeVisible();
  await expect(page.getByTestId('preopen-suggestion')).toHaveCount(0);
  await expect(page.getByTestId('preopen-missing')).toHaveCount(0);
});
