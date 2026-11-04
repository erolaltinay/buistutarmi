// İP-1.10: sektör sayfası ve video bazında ölçüm. Kabul kriterindeki kullanıcılar arası rapor için hesap ve
// analitik altyapısı gerekir (İP-1.1); burada her olayın doğru videoya bağlandığı doğrulanır.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const events = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('bitm:events') ?? '[]') as { name: string; video: string | null }[],
  );
const attribution = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('bitm:attribution') ?? 'null'));

test('videodan gelen kullanıcı: sektör sayfası → sihirbaz → karar → PDF, hepsi videoya bağlı', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(
    '/tr/sektor/barber?utm_source=youtube&utm_medium=description&utm_campaign=kanal&utm_content=abc123',
  );
  await expect(page.getByTestId('sector-title')).toContainText('Berber');
  await expect(page.getByRole('note')).toContainText('yatırım tavsiyesi değildir');
  await expect(page.getByTestId('verdict')).toHaveText(/^(TUTAR|ŞARTLI|TUTMAZ)$/);

  await expect
    .poll(() => attribution(page))
    .toMatchObject({ first_utm: { source: 'youtube', content: 'abc123' }, first_sector: null });

  // CTA sihirbazı bu sektörle ülke adımından açar.
  await page.getByTestId('sector-cta').click();
  await expect(page).toHaveURL(/\/tr\/projects\/new\?sector=barber$/);
  await expect(page.getByTestId('quick-progress')).toContainText('2 / 10');

  const next = page.getByRole('button', { name: 'İleri' });
  await next.click();
  await page.locator('#quick-input').fill('Şişli');
  await next.click();
  await page.locator('#quick-input').fill('30000');
  await next.click();
  await page.locator('#quick-input').fill('50000');
  await next.click();
  await page.getByRole('button', { name: 'Her gün başında' }).click();
  await next.click();
  await page.locator('#quick-input').fill('400');
  await page.locator('#quick-cost').fill('40');
  await next.click();
  await page.locator('#quick-input').fill('20');
  await next.click();
  await page.locator('#quick-input').fill('500000');
  await next.click();
  await page.locator('#quick-input').fill('70');
  await page.getByRole('button', { name: 'Kararı gör' }).click();
  await page.waitForURL(/\/projects\/(?!new)[^/?]+$/);
  await expect(page.getByTestId('verdict')).toBeVisible();
  const base = page.url();

  // Sonraki tıklamalar uygulama içi: kayıt kaybolmaz, ikinci video ilk kaynağı değiştirmez.
  await page.goto(`${base}/report`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('pdf-download').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByTestId('pdf-status')).toHaveText('Rapor indirildi.');
  await page.goto(`/tr/sektor/coffee?utm_content=ikinci`);
  await expect.poll(() => attribution(page)).toMatchObject({ first_utm: { content: 'abc123' } });

  const list = await events(page);
  const of = (name: string) => list.filter((e) => e.name === name);
  expect(of('visit')).toHaveLength(1);
  for (const name of [
    'visit',
    'project_created',
    'quick_mode_completed',
    'verdict_shown',
    'pdf_downloaded',
  ]) {
    expect(of(name).length, name).toBeGreaterThan(0);
    expect(
      of(name).every((e) => e.video === 'abc123'),
      name,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('videosuz giriş ve bilinmeyen sektör', async ({ page }) => {
  await page.goto('/en/sektor/coffee');
  await expect(page.getByTestId('sector-title')).toContainText('Coffee shop');
  await expect(page.getByTestId('sector-cta')).toHaveAttribute('href', '/en/projects/new?sector=coffee');
  await expect(page).toHaveTitle(/Coffee shop/);
  // Videosu henüz tanımlı değil: oynatıcı yok, sayfa yine çalışır.
  await expect(page.getByTestId('video-play')).toHaveCount(0);
  await expect.poll(() => attribution(page)).toMatchObject({ first_utm: {}, first_sector: null });

  const res = await page.goto('/tr/sektor/yok-boyle-sektor');
  expect(res?.status()).toBe(404);
});

test('ana sayfadan sektör sayfalarına geçilir', async ({ page }) => {
  await page.goto('/tr');
  await page.getByRole('link', { name: 'Berber' }).click();
  await expect(page).toHaveURL(/\/tr\/sektor\/barber$/);
});

test('eski video linki (?sector=) UTM ile sihirbaza gider ve ölçülür', async ({ page }) => {
  await page.goto('/tr?sector=coffee&utm_source=youtube&utm_content=xyz');
  await expect(page).toHaveURL(/\/projects\/new\?sector=coffee&utm_source=youtube&utm_content=xyz$/);
  await expect
    .poll(() => attribution(page))
    .toMatchObject({ first_utm: { content: 'xyz' }, first_sector: 'coffee' });
});

test('karşılaştırma ve aday olayları kaydedilir', async ({ page }) => {
  await page.goto('/tr');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  await page.goto(page.url().replace(/\/finance$/, '/compare'));
  await page.getByTestId('cand-save').click();
  await expect(page.getByTestId('cand')).toHaveCount(1);
  const names = (await events(page)).map((e) => e.name);
  expect(names).toContain('project_created');
  expect(names).toContain('compare_viewed');
  expect(names).toContain('candidate_added');
});
