// İP-1.7 kabul: TR kahve ve TR berber için liste görünüyor; durum değişikliği kaydediliyor; desteklenmeyen
// ülkede liste yerine genel uyarı çıkıyor; ekran hiçbir yerde "uygunsunuz" benzeri ifade içermiyor.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const BANNED = /uygunsunuz|bu belgeler yeterli|ruhsat çıkar/i;

const start = async (page: Page, sector?: string) => {
  await page.goto('/tr');
  if (sector) await page.getByTestId('sector-select').selectOption(sector);
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  return page.url().replace(/\/finance$/, '');
};

test('TR kahve: liste görünür, durum kaydedilir, rozet ve teyit listesi güncellenir', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = await start(page);

  await page.goto(`${base}/legal`);
  await expect(page.getByTestId('legal-warning')).toContainText('Son kontrol: 02.11.2026.');
  await expect(page.getByTestId('stage-before_lease')).toContainText('İşyeri açma ve çalışma ruhsatı');
  await expect(page.getByTestId('stage-before_opening')).toContainText('Gıda işletmesi kaydı');
  await expect(page.getByTestId('stage-after_opening')).toBeVisible();
  // Taslak maddeler işaretli; süresi olmayan madde için toplam uydurulmaz.
  await expect(page.getByTestId('permit-tr.common.tax_registration')).toContainText('Taslak — doğrulanmadı');
  await expect(page.getByTestId('legal-path')).toContainText('Hesaplanamadı');
  expect(await page.locator('main').innerText()).not.toMatch(BANNED);

  // Kahvede 6 kritik madde.
  const summary = async () => {
    await page.goto(base);
    return page.getByTestId('permits-badge');
  };
  await expect(await summary()).toContainText('6 kritik madde tamamlanmadı');
  await expect(page.getByText('Mevzuat: Vergi mükellefiyeti kaydı')).toBeVisible();

  await page.goto(`${base}/legal`);
  await page.locator('[id="permit-tr.common.tax_registration"]').selectOption('done');
  await page.locator('[id="permit-tr.common.sgk_workplace"]').selectOption('na');
  await page.locator('[id="permit-tr.common.trade_registry"]').selectOption('applied');
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });

  // Yeniden yüklemede kalıcı.
  await page.reload();
  await expect(page.getByTestId('permit-tr.common.tax_registration')).toHaveAttribute('data-status', 'done');
  await expect(page.getByTestId('permit-tr.common.trade_registry')).toHaveAttribute('data-status', 'applied');

  // Aldım ve uygulanmaz düşer, başvurdum düşmez.
  await expect(await summary()).toContainText('4 kritik madde tamamlanmadı');
  await expect(page.getByText('Mevzuat: Vergi mükellefiyeti kaydı')).toHaveCount(0);
  await expect(page.getByText('Mevzuat: Esnaf sicili veya ticaret sicili kaydı')).toBeVisible();
  expect(errors).toEqual([]);
});

test('TR berber: kendi maddeleri görünür, kahve maddeleri görünmez', async ({ page }) => {
  const base = await start(page, 'barber');
  await page.goto(`${base}/legal`);
  await expect(page.getByTestId('permit-tr.barber.mastery_certificate')).toBeVisible();
  await expect(page.getByTestId('permit-tr.coffee.food_business_registration')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(BANNED);
});

test('desteklenmeyen ülkede liste yerine genel uyarı; rozet yok', async ({ page }) => {
  const base = await start(page);
  const id = base.split('/').pop()!;
  await page.evaluate((key) => {
    const doc = JSON.parse(localStorage.getItem(key)!);
    doc.country = 'GENERIC';
    localStorage.setItem(key, JSON.stringify(doc));
  }, `bitm:project:${id}`);

  await page.goto(`${base}/legal`);
  await expect(page.getByTestId('legal-generic')).toContainText('mevzuat listesi sunmuyoruz');
  await expect(page.locator('main select')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(BANNED);

  await page.goto(base);
  await expect(page.getByTestId('permits-badge')).toHaveCount(0);
});

test('ruhsat "Hayır" ise yol haritası kararın neden TUTMAZ olduğunu söyler', async ({ page }) => {
  const base = await start(page);
  await page.goto(`${base}/location`);
  await page
    .locator('.chkitem')
    .filter({ hasText: 'Belediye bu adreste' })
    .getByRole('button', { name: 'Hayır' })
    .click();
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });
  await page.goto(`${base}/legal`);
  await expect(page.getByTestId('legal-blocked')).toBeVisible();
});
