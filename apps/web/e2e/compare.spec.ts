// İP-1.5 kabul: prototipteki karşılaştırma tablosuyla aynı satırlar ve vurgu kuralı.
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const ROWS = [
  'Karar',
  'Başabaş (nakit, taksit dahil)',
  'Gerçek yatırım ihtiyacı',
  'En derin nakit açığı',
  'Yatırımın geri dönüşü',
  '24 ay toplam net kâr',
  'Talep uyumu',
  '1 km içindeki rakip',
  'Kira / ciro',
  'Gereken giriş oranı',
  'Lokasyon puanı',
  'Kırmızı bayrak',
];

/** Satırdaki her sütunun en iyi değer olarak işaretlenip işaretlenmediği (ilk hücre etiket). */
const bestOf = (page: Page, row: string) =>
  page
    .getByTestId(`cmp-${row}`)
    .locator('td')
    .evaluateAll((tds) => tds.slice(1).map((td) => td.classList.contains('best')));

/** Adı tam eşleşen aday kartı (alt satırda semt adı da geçebilir). */
const card = (page: Page, name: string) =>
  page.getByTestId('cand').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });

const saveAs = async (page: Page, name: string) => {
  await page.locator('#cand-name').fill(name);
  await page.getByTestId('cand-save').click();
};

test('adaylar kaydedilir ve 12 satırlık tabloda en iyi değer işaretlenir', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/tr');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  const base = page.url().replace(/\/finance$/, '');

  await page.goto(`${base}/compare`);
  await expect(page.getByTestId('cmp').locator('tbody tr td:first-child')).toHaveText(ROWS);
  // Tek sütunda vurgu yok.
  await expect(page.locator('.cmp td.best')).toHaveCount(0);

  await saveAs(page, 'Moda');
  await expect(page.getByTestId('cand-msg')).toHaveText('"Moda" kaydedildi.');
  await expect(page.getByTestId('cand')).toHaveCount(1);
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });

  // Kirası düşük ikinci dükkân.
  await page.goto(`${base}/finance`);
  await page.locator('#fixed-v-0').fill('20000');
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });
  await page.goto(`${base}/compare`);
  await saveAs(page, 'Kadıköy');
  await expect(page.getByTestId('cmp').locator('thead th')).toHaveCount(4);

  // Sütunlar: şu anki (düşük kira), Moda (örnek), Kadıköy (düşük kira). Eşit en iyi değerler birlikte işaretlenir.
  expect(await bestOf(page, 'beDay')).toEqual([true, false, true]);
  expect(await bestOf(page, 'rent')).toEqual([true, false, true]);
  expect(await bestOf(page, 'verdict')).toEqual([false, false, false]);
  expect(await bestOf(page, 'rivals')).toEqual([true, true, true]);

  // Yükleme iki tıkla onaylanır; Moda şu anki analiz olur.
  const moda = card(page, 'Moda');
  await moda.getByRole('button', { name: 'Yükle' }).click();
  await moda.getByRole('button', { name: 'Mevcut analiz değişecek. Yükle?' }).click();
  expect(await bestOf(page, 'beDay')).toEqual([false, false, true]);

  // Sınır 4 aday.
  await saveAs(page, 'Üç');
  await saveAs(page, 'Dört');
  await expect(page.getByTestId('cand')).toHaveCount(4);
  await saveAs(page, 'Beş');
  await expect(page.getByTestId('cand-msg')).toHaveText('En fazla 4 aday kaydedebilirsin; önce birini sil.');
  await expect(page.getByTestId('cand')).toHaveCount(4);

  // Silme de iki tıkla.
  const dort = card(page, 'Dört');
  await dort.getByRole('button', { name: 'Sil' }).click();
  await dort.getByRole('button', { name: 'Silinsin mi?' }).click();
  await expect(page.getByTestId('cand')).toHaveCount(3);

  // Kayıt kalıcı; "Örneğe dön" adayları silmez.
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });
  await page.reload();
  await expect(page.getByTestId('cand')).toHaveCount(3);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Örneğe dön' }).click();
  await expect(page.getByTestId('cand')).toHaveCount(3);

  expect(errors).toEqual([]);
});

test('mobilde tablo kendi içinde kayar, sayfa yatay taşmaz', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tr');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/finance$/);
  await page.goto(page.url().replace(/\/finance$/, '/compare'));
  await saveAs(page, 'A');
  await saveAs(page, 'B');
  await expect(page.getByTestId('cmp').locator('thead th')).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
