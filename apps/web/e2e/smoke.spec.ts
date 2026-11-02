import { expect, test } from '@playwright/test';

test.describe('Türkçe tarayıcı', () => {
  test.use({ locale: 'tr-TR' });

  test('kök adres /tr’ye yönlenir ve örnek kararı gösterir', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tr$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bu İş Tutar mı?');
    await expect(page.getByTestId('verdict')).toHaveText('TUTAR');
    await expect(page.getByRole('note')).toContainText('yatırım tavsiyesi değildir');
  });
});

test.describe('İngilizce tarayıcı', () => {
  test.use({ locale: 'en-US' });

  test('kök adres /en’e yönlenir', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Should You Open This?');
    await expect(page.getByRole('note')).toContainText('not investment advice');
  });
});
