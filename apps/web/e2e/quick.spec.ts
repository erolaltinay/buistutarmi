// İP-1.4 kabul: mobilde (390 px) 3 dakikanın altında tamamlanıyor; terk edilen sihirbaz kaldığı yerden
// devam ediyor; `sector` parametresi doğru arketipi açıyor.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR', viewport: { width: 390, height: 844 } });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

const next = (page: Page) => page.getByTestId('quick-next').click();
const progress = (page: Page, n: number) =>
  expect(page.getByTestId('quick-progress')).toHaveText(`Adım ${n} / 10`);
async function number(page: Page, n: number, value: string) {
  await progress(page, n);
  await page.locator('#quick-input').fill(value);
  await next(page);
}

test('kendi rakamlarıyla 10 soru 3 dakikanın altında biter, karar ekranı açılır', async ({ page }) => {
  // Cevapların girdiye çevrilmesi lib/quick.test.ts'te sınanır; burada akış ve ekranlar arası tutarlılık.
  const errors = watchErrors(page);
  const started = Date.now();
  await page.goto('/tr');
  await page.getByTestId('quick-start').click();

  await progress(page, 1);
  await page.getByRole('button', { name: 'Kahve dükkânı' }).click();
  await next(page);
  await progress(page, 2);
  await page.getByRole('button', { name: /Türkiye/ }).click();
  await next(page);
  await progress(page, 3);
  await page.locator('#quick-input').fill('Beşiktaş, Çarşı');
  await next(page);
  await number(page, 4, '60000');
  await number(page, 5, '70000');
  await progress(page, 6);
  await page.getByRole('button', { name: 'Yarı zamanlı' }).click();
  await next(page);
  await progress(page, 7);
  await page.locator('#quick-input').fill('130');
  await page.locator('#quick-cost').fill('38');
  await next(page);
  await number(page, 8, '150');
  await number(page, 9, '900000');
  await progress(page, 10);
  await page.locator('#quick-input').fill('60');
  await page.getByTestId('quick-next').click();

  await page.waitForURL(/\/projects\/(?!new)[^/?]+$/);
  await expect(page.getByTestId('verdict')).toHaveText(/^(TUTAR|ŞARTLI|TUTMAZ)$/);
  const verdict = await page.getByTestId('verdict').textContent();
  const invest = await page.getByTestId('invest').textContent();
  // 8 cevaplanan grup = %76 kendi veri; yaya, rakip, diğer giderler, geçmiş ve oranlar örnekten.
  await expect(page.getByTestId('conf-share')).toHaveText('Örnek veya tahmini veriye dayanan kısım: %24');
  await expect(page.getByTestId('preliminary')).toHaveCount(0);
  await expect(page.getByTestId('conf-foot')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('yatırım tavsiyesi değildir');
  expect(Date.now() - started).toBeLessThan(180_000);

  // Ayrıntılı analizde aynı cevaplar ve aynı sonuç görünür.
  await page.getByTestId('to-detail').click();
  await expect(page.locator('#scen-1')).toHaveValue('150');
  await expect(page.locator('#items-price-0')).toHaveValue('130');
  await expect(page.locator('#items-cost-0')).toHaveValue('38');
  await expect(page.locator('#fixed-v-0')).toHaveValue('60000');
  await expect(page.getByTestId('verdict')).toHaveText(verdict ?? '');
  await expect(page.getByTestId('invest')).toHaveText(invest ?? '');
  await page.getByRole('link', { name: 'Bölge ve rakipler' }).click();
  await expect(page.locator('#area')).toHaveValue('Beşiktaş, Çarşı');
  await page.getByRole('link', { name: 'Lokasyon' }).click();
  await expect(page.locator('#founder-equity')).toHaveValue('60');
  expect(errors).toEqual([]);
});

test('yarıda bırakılan sihirbaz kaldığı yerden devam eder', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/tr/projects/new');
  await page.getByRole('button', { name: 'Berber' }).click();
  await next(page);
  await next(page); // ülke önceden seçili (TR)
  await page.locator('#quick-input').fill('Moda');
  await next(page);
  await number(page, 4, '30000');

  await page.reload();
  await progress(page, 5);
  await expect(page.getByText('Kaldığın yerden devam ediyorsun.')).toBeVisible();
  await page.getByRole('button', { name: 'Geri' }).click();
  await progress(page, 4);
  await expect(page.locator('#quick-input')).toHaveValue('30000');
  expect(errors).toEqual([]);
});

test('video linkindeki sector parametresi sihirbazı o sektörle açar, UTM korunur', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/tr?sector=barber&utm_source=youtube&utm_content=abc123');
  await expect(page).toHaveURL(/\/tr\/projects\/new\?sector=barber&utm_source=youtube&utm_content=abc123$/);
  await progress(page, 2);
  await page.getByRole('button', { name: 'Geri' }).click();
  await expect(page.getByRole('button', { name: 'Berber' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('"Videodaki örneği yükle" tek tıkla örneğin kararını gösterir', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/tr/projects/new?sector=coffee');
  await page.getByTestId('quick-sample').click();
  await page.waitForURL(/\/projects\/(?!new)[^/?]+$/);
  await expect(page.getByTestId('verdict')).toHaveText('TUTAR');
  await expect(page.getByTestId('invest')).toHaveText('₺1.032.413');
  // Örnek yüklemek kullanıcı verisi sayılmaz.
  await expect(page.getByTestId('conf-share')).toHaveText('Örnek veya tahmini veriye dayanan kısım: %100');
  await expect(page.getByTestId('preliminary')).toBeVisible();
  expect(errors).toEqual([]);
});
