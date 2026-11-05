// İP-2.3 kabul: çevrimdışıyken sayılan veri kaybolmaz ve Lokasyon'a yazılır; tam ekran tek tuş, zamanlayıcı, dilim seçimi.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const MIN = 60_000;

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-11-05T10:00:00') });
  await page.goto('/tr');
  await page.getByTestId('sector-select').selectOption('barber');
  await page.getByTestId('sample-select').selectOption('ist');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  const base = page.url().replace(/\/finance$/, '');
  await page.goto(`${base}/location`);
  await page.getByTestId('counter-open').click();
  await expect(page.getByTestId('counter')).toBeVisible();
}

const stored = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bitm:project:'))!;
    return JSON.parse(localStorage.getItem(key)!);
  });

const tapTimes = async (page: Page, n: number) => {
  const button = page.getByTestId('counter-tap');
  for (let i = 0; i < n; i++) await button.click();
};

test('tek tuşla sayar, süre dolunca biter, seçilen dilime yazar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(page.url()).origin) external.push(r.url());
  });
  await page.getByTestId('counter-day').selectOption('we');
  await page.getByTestId('counter-slot').selectOption('1');
  await page.getByTestId('counter-start').click();

  await expect(page.getByTestId('counter-clock')).toHaveText('15:00');
  await tapTimes(page, 3);
  await expect(page.getByTestId('counter-count')).toHaveText('3');
  await page.getByTestId('counter-undo').click();
  await expect(page.getByTestId('counter-count')).toHaveText('2');

  // Tuş ekranın büyük kısmını kaplar.
  const box = (await page.getByTestId('counter-tap').boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.height).toBeGreaterThan(view.height * 0.5);
  expect(box.width).toBeGreaterThan(view.width * 0.85);

  await page.clock.fastForward(15 * MIN);
  await expect(page.getByTestId('counter-done')).toBeVisible();
  await expect(page.getByTestId('counter-result')).toHaveText('2');
  await expect(page.getByTestId('counter-value')).toContainText('2');
  await page.getByTestId('counter-write').click();

  await expect(page.getByTestId('counter-saved')).toContainText('Hafta sonu');
  // Sıradaki sayılmamış dilim seçili gelir.
  await expect(page.getByTestId('counter-day')).toHaveValue('wd');
  await page.getByTestId('counter-close').click();

  await expect(page.locator('#foot-we-1')).toHaveValue('2');
  await expect(page.locator('#foot-we-1')).toHaveClass(/counted/);
  await expect(page.locator('#foot-we-0')).not.toHaveClass(/counted/);
  await expect(page.getByTestId('counter-progress')).toContainText('1 / 6');

  const doc = await stored(page);
  expect(doc.input.loc.foot.we[1]).toBe(2);
  // Tek dilim sayıldı; kalan dilimler örnek olduğu için yaya verisi güvenilir sayılmaz.
  expect(doc.sources?.foot).toBeUndefined();
  expect(doc.input.loc.counts).toHaveLength(1);
  expect(doc.input.loc.counts[0]).toMatchObject({ day: 'we', slot: 1, count: 2, value: 2, minutes: 15 });
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('bitm:count:')))).toBe(
    false,
  );

  // Elle değiştirilen değer artık sayım sayılmaz.
  await page.locator('#foot-we-1').fill('40');
  await expect(page.locator('#foot-we-1')).not.toHaveClass(/counted/);
  await expect(page.getByTestId('counter-progress')).toHaveCount(0);

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('erken bitirilen sayım tablo süresine çevrilir, çok kısa sayım yazılamaz', async ({ page }) => {
  await open(page);
  await page.getByTestId('counter-start').click();
  await tapTimes(page, 2);
  await page.getByTestId('counter-stop').click();
  await expect(page.getByTestId('counter-too-short')).toBeVisible();
  await expect(page.getByTestId('counter-write')).toBeDisabled();

  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('counter-discard').click();
  await expect(page.getByTestId('counter-start')).toBeVisible();

  await page.getByTestId('counter-start').click();
  await tapTimes(page, 10);
  await page.clock.fastForward(5 * MIN);
  await page.getByTestId('counter-stop').click();
  await expect(page.getByTestId('counter-value')).toContainText('30');
  await page.getByTestId('counter-write').click();
  await page.getByTestId('counter-close').click();
  await expect(page.locator('#foot-wd-0')).toHaveValue('30');
});

test('art arda hızlı dokunuşların hiçbiri kaybolmaz', async ({ page }) => {
  await open(page);
  await page.getByTestId('counter-start').click();
  await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('[data-testid="counter-tap"]')!;
    for (let i = 0; i < 20; i++) button.click();
  });
  await expect(page.getByTestId('counter-count')).toHaveText('20');
  await page.reload();
  await expect(page.getByTestId('counter-count')).toHaveText('20');
});

test('süre geçersizse başlamaz', async ({ page }) => {
  await open(page);
  await page.getByTestId('counter-minutes').fill('0');
  await expect(page.getByTestId('counter-minutes-error')).toBeVisible();
  await expect(page.getByTestId('counter-start')).toBeDisabled();
});

test('sayfa yenilenirse sayım kaldığı yerden sürer, uyarı çıkar', async ({ page }) => {
  await open(page);
  await page.getByTestId('counter-start').click();
  await tapTimes(page, 4);
  await page.reload();
  await expect(page.getByTestId('counter-count')).toHaveText('4');
  await expect(page.getByTestId('counter-interrupted')).toBeVisible();
  await tapTimes(page, 1);
  await expect(page.getByTestId('counter-count')).toHaveText('5');
});

test('çevrimdışı: ekran yeniden açılır, sayım kaybolmaz, bağlantı gelince kayıtta durur', async ({
  page,
  context,
}) => {
  await open(page);
  await expect(page.getByTestId('counter-offline-ready')).toBeVisible();

  await context.setOffline(true);
  await page.getByTestId('counter-start').click();
  await expect(page.getByTestId('counter-offline')).toBeVisible();
  await tapTimes(page, 6);

  // İnternet yokken sayfa kapanıp açılır.
  await page.reload();
  await expect(page.getByTestId('counter-count')).toHaveText('6');
  await tapTimes(page, 1);
  await page.clock.fastForward(15 * MIN);
  await expect(page.getByTestId('counter-done')).toBeVisible();
  await page.getByTestId('counter-write').click();
  await page.getByTestId('counter-close').click();
  await expect(page.locator('#foot-wd-0')).toHaveValue('7');

  await context.setOffline(false);
  await page.reload();
  await expect(page.locator('#foot-wd-0')).toHaveValue('7');
  const doc = await stored(page);
  expect(doc.input.loc.counts[0]).toMatchObject({ count: 7, value: 7, interrupted: true });
});
