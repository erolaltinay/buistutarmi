// İP-2.8 kabul: dış çağrı yok, tarihsiz gözlem kaydedilmiyor, bağlantı kartta açılıyor, kaynak sırası ülke dosyasından,
// imza kalemi gözlemi yalnız "Uygula" ile rakip fiyatı oluyor.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

async function startProject(page: Page, sector: string, sample: string) {
  await page.goto('/tr');
  await page.getByTestId('sector-select').selectOption(sector);
  await page.getByTestId('sample-select').selectOption(sample);
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  return page.url().replace(/\/finance$/, '');
}

const stored = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bitm:project:'))!;
    return JSON.parse(localStorage.getItem(key)!);
  });

const research = async (page: Page, i = 0) => (await stored(page)).input.comp[i]?.research;

test('berber: bağlantı, gözlem, Uygula, politika, kampanya, kontrol listesi', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Rakip bağlantısı gerçek siteye çıkmasın; açılan sekme için sahte cevap.
  await context.route('https://ornek.example/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: 'ornek' }),
  );

  const base = await startProject(page, 'barber', 'ist');
  await page.goto(`${base}/area`);
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(page.url()).origin) external.push(r.url());
  });

  const card = page.getByTestId('research-0');
  await card.locator('summary').first().click();

  // Kaynak sırası ülke dosyasından gelir.
  await expect(card.getByTestId('research-order')).toContainText(
    'Kapıdaki liste → Dükkân içi not → Dijital menü → Web sitesi',
  );

  // Bağlantı: geçersiz adres reddedilir, geçerli adres kartta tıklanıp açılır.
  await card.getByTestId('research-link-url').fill('javascript:alert(1)');
  await card.getByTestId('research-link-add').click();
  await expect(card.getByTestId('research-link-error')).toHaveText('Geçerli bir web adresi yaz.');
  await card.getByTestId('research-link-kind').selectOption('instagram');
  await card.getByTestId('research-link-url').fill('ornek.example/hesap');
  await card.getByTestId('research-link-add').click();
  const link = card.getByTestId('research-link');
  await expect(link).toHaveAttribute('href', 'https://ornek.example/hesap');
  await expect(link).toHaveAttribute('rel', /noopener/);
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  expect(popup.url()).toBe('https://ornek.example/hesap');
  await popup.close();

  // Kaynaksız ve tarihsiz gözlem kaydedilmez.
  const save = card.getByTestId('research-save');
  await card.getByTestId('research-price-cut').fill('700');
  await save.click();
  await expect(card.getByTestId('research-errors')).toHaveText('Kaynağı seç.');
  await card.getByTestId('research-source').selectOption('door');
  await card.getByTestId('research-date').fill('');
  await save.click();
  await expect(card.getByTestId('research-errors')).toHaveText('Gözlem tarihini gir.');
  await expect(card.getByTestId('research-observation')).toHaveCount(0);

  // Tarih girilince kaydedilir, ama rakip fiyatı değişmez.
  await card.getByTestId('research-date').fill('2026-10-20');
  await expect(card.getByTestId('research-channel')).toHaveValue('in_store');
  await save.click();
  await expect(card.getByTestId('research-observation')).toHaveCount(1);
  await expect(card.getByTestId('research-errors')).toHaveCount(0);
  await expect(card.getByTestId('research-price-cut')).toHaveValue('');
  await expect(page.locator('#comp-price-0')).toHaveValue('650');
  await expect.poll(async () => (await research(page))?.observations?.length).toBe(1);
  const beforeApply = await stored(page);
  expect(beforeApply.input.comp[0].price).toBe(650);
  expect(beforeApply.input.comp[0].research.observations[0]).toMatchObject({
    itemKey: 'cut',
    price: 700,
    currency: 'TRY',
    source: 'door',
    channel: 'in_store',
    observedOn: '2026-10-20',
  });
  // İnceleme kaydı rakip verisini "kullanıcı verisi" yapmaz; Uygula yapar.
  expect(beforeApply.sources?.comp).toBeUndefined();

  // İmza kalemi olmayan ve teslimat gözlemi uygulanamaz.
  await card.getByTestId('research-price-beard').fill('400');
  await save.click();
  await card.getByTestId('research-source').selectOption('delivery');
  await expect(card.getByTestId('research-channel')).toHaveValue('delivery');
  await card.getByTestId('research-price-cut').fill('900');
  await save.click();
  await expect(card.getByTestId('research-observation')).toHaveCount(3);
  await expect(card.getByTestId('research-apply')).toHaveCount(1);

  // Uygula yalnız o rakibin fiyatını yazar.
  await card.getByTestId('research-apply').click();
  await expect(card.getByTestId('research-apply')).toBeDisabled();
  await expect(page.locator('#comp-price-0')).toHaveValue('700');
  await expect(page.locator('#comp-price-1')).toHaveValue('450');
  await expect.poll(async () => (await stored(page)).input.comp[0].price).toBe(700);
  expect((await stored(page)).sources.comp).toBe('user');

  // Sepette olmayan kalem adıyla kaydedilir, karşılaştırmaya girmez.
  await card.getByTestId('research-other-add').click();
  await card.getByTestId('research-price-other').fill('1500');
  await save.click();
  await expect(card.getByTestId('research-errors')).toHaveText('Başka kalemin adını yaz.');
  await card.getByTestId('research-other-name').fill('Boya');
  await card.getByTestId('research-price-other').fill('1500');
  await save.click();
  await expect(card.getByTestId('research-observations-0')).toContainText('Karşılaştırmaya girmez');

  // Politika ve kampanya.
  await card.getByTestId('research-visibility').selectOption('ask');
  await card.getByTestId('research-fee').fill('25');
  await card.getByTestId('research-offer-add').click();
  await expect(card.getByTestId('research-offer-error')).toHaveText('Kampanya türünü seç.');
  await card.getByTestId('research-offer-type').selectOption('student');
  await card.getByTestId('research-offer-source').selectOption('social');
  await card.getByTestId('research-offer-add').click();
  await expect(card.getByTestId('research-offers')).toContainText('Öğrenci indirimi');

  // Kontrol listesi sektörden gelir: berberde menü ve teslimat grubu yok.
  await card.locator('.research-checks summary').click();
  await expect(card.getByTestId('research-group-booking')).toBeVisible();
  await expect(card.getByTestId('research-group-menu')).toHaveCount(0);
  await expect(card.getByTestId('research-group-delivery')).toHaveCount(0);
  await card.getByLabel('Usta ve çırak fiyatı farklı mı?').check();
  await expect(card.getByTestId('research-checks-count')).toContainText('1 /');

  // Kayıt yenilemeden sonra durur.
  await expect.poll(async () => (await research(page))?.checks).toEqual(['fieldTier']);
  await page.reload();
  const again = page.getByTestId('research-0');
  await again.locator('summary').first().click();
  await expect(again.getByTestId('research-observation')).toHaveCount(4);
  await expect(again.getByTestId('research-visibility')).toHaveValue('ask');
  await expect(again.getByTestId('research-fee')).toHaveValue('25');
  await expect(again.getByTestId('research-link')).toHaveCount(1);

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('kahve: menü ve teslimat grubu var, randevu grubu yok', async ({ page }) => {
  const base = await startProject(page, 'coffee', 'ist');
  await page.goto(`${base}/area`);
  const card = page.getByTestId('research-0');
  await card.locator('summary').first().click();
  await card.locator('.research-checks summary').click();
  await expect(card.getByTestId('research-group-menu')).toBeVisible();
  await expect(card.getByTestId('research-group-delivery')).toBeVisible();
  await expect(card.getByTestId('research-group-booking')).toHaveCount(0);
});

test('genel mod: kaynak sırası GENERIC dosyasından, para birimi seçilen', async ({ page }) => {
  await page.goto('/tr');
  await page.getByTestId('sample-select').selectOption('__other');
  await page.getByTestId('country-select').selectOption('FR');
  await page.getByTestId('currency-select').selectOption('EUR');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  await page.goto(page.url().replace(/\/finance$/, '/area'));

  await page.getByRole('button', { name: '+ Rakip ekle' }).click();
  const card = page.getByTestId('research-0');
  await card.locator('summary').first().click();
  await expect(card.getByTestId('research-order')).toHaveText(
    'Önce şuralara bak: Dijital menü → Web sitesi → Sorarak öğrendim → Sosyal medya',
  );
  await expect(card.getByTestId('research-source').locator('optgroup').first().locator('option')).toHaveText([
    'Dijital menü',
    'Web sitesi',
    'Sorarak öğrendim',
    'Sosyal medya',
  ]);
  await card.getByTestId('research-source').selectOption('website');
  await expect(card.getByTestId('research-channel')).toHaveValue('in_store');
  await card.getByTestId('research-price-espresso_d').fill('4,5');
  await card.getByTestId('research-save').click();
  await expect(card.getByTestId('research-observation')).toContainText('€');
  await expect.poll(async () => (await research(page))?.observations?.[0]?.currency).toBe('EUR');
  await expect(card).not.toContainText('₺');
});
