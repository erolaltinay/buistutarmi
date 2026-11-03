// İP-1.2 kabul: aynı girdiyle ekrandaki karar, başabaş, yatırım, nakit açığı ve geri dönüş prototiple aynı.
// Golden fixture prototipten üretildi; videodaki örnek girdisi fixture'daki "default" vakaların girdisiyle aynıdır.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { makeFormat } from '../lib/format';

interface Golden {
  cases: {
    id: string;
    input: { cur: string };
    expected: {
      verdict: 'GO' | 'MID' | 'NO';
      breakEven: { perDay: number | null };
      investment: { total: number; cashTrough: number };
      projection: { paybackTotalMonths: number | null };
    };
  }[];
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden-cases.json', import.meta.url), 'utf8'),
) as Golden;
const LABEL = { GO: 'TUTAR', MID: 'ŞARTLI', NO: 'TUTMAZ' } as const;

test.use({ locale: 'tr-TR' });

/** Sayfa hatalarını toplar; her test sonunda boş olmalı. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function startProject(page: Page, sector: string, sample: string) {
  await page.goto('/tr');
  await page.getByTestId('sector-select').selectOption(sector);
  await page.getByTestId('sample-select').selectOption(sample);
  await page.getByTestId('start').click();
  await page.waitForURL(/\/projects\/[^/]+\/finance$/);
  return page.url().replace(/\/finance$/, '');
}

for (const sector of ['coffee', 'barber']) {
  for (const sample of ['ist', 'nyc', 'aus']) {
    test(`prototiple aynı sonuç: ${sector}-${sample}`, async ({ page }) => {
      const errors = watchErrors(page);
      const c = golden.cases.find((x) => x.id === `${sector}-${sample}-default`);
      if (!c) throw new Error('golden vaka yok');
      const fmt = makeFormat('tr', c.input.cur);
      const e = c.expected;

      await startProject(page, sector, sample);
      await expect(page.getByTestId('verdict')).toHaveText(LABEL[e.verdict]);
      await expect(page.getByTestId('be-day')).toHaveText(
        e.breakEven.perDay === null ? '—' : fmt.num(Math.ceil(e.breakEven.perDay)),
      );
      await expect(page.getByTestId('invest')).toHaveText(fmt.money(e.investment.total));
      await expect(page.getByTestId('trough')).toHaveText(fmt.money(e.investment.cashTrough));
      await expect(page.getByTestId('payback')).toHaveText(
        e.projection.paybackTotalMonths === null
          ? '60 ayda dönmüyor'
          : `${e.projection.paybackTotalMonths} ay`,
      );
      await expect(page.getByRole('note')).toContainText('yatırım tavsiyesi değildir');
      expect(errors).toEqual([]);
    });
  }
}

test('her sekme açılıyor ve sonuç gösteriyor (hizmet arketipi)', async ({ page }) => {
  const errors = watchErrors(page);
  const base = await startProject(page, 'barber', 'nyc');

  await page.goto(`${base}/area`);
  await expect(page.getByTestId('fit-score')).toHaveText(/^\d+$/);
  await expect(page.getByTestId('rivals')).toHaveText(/^\d+$/);

  await page.goto(`${base}/location`);
  await expect(page.getByTestId('loc-score')).toHaveText(/^\d+$/);
  await expect(page.getByText('Lokasyon kontrol listesi')).toBeVisible();

  await page.goto(`${base}/pricing`);
  await expect(page.getByTestId('card-now')).toBeVisible();
  await expect(page.getByTestId('card-prem')).toBeVisible();

  await page.goto(`${base}/storefront`);
  await expect(page.locator('.sf-frame svg')).toBeVisible();
  await expect(page.locator('.sf-frame')).toContainText('USTA BERBER');

  await expect(page.getByRole('note')).toContainText('yatırım tavsiyesi değildir');
  expect(errors).toEqual([]);
});

test('değişiklik anında hesaplanır, 1 sn sonra kaydedilir ve yenilemede kalır', async ({ page }) => {
  const errors = watchErrors(page);
  await startProject(page, 'coffee', 'ist');
  await expect(page.getByTestId('verdict')).toHaveText('TUTAR');

  await page.locator('#scen-1').fill('60');
  await expect(page.getByTestId('verdict')).toHaveText('TUTMAZ');
  await expect(page.getByTestId('save-status')).toHaveText('Kaydedildi', { timeout: 5000 });

  await page.reload();
  await expect(page.locator('#scen-1')).toHaveValue('60');
  await expect(page.getByTestId('verdict')).toHaveText('TUTMAZ');
  expect(errors).toEqual([]);
});

test('fiyat kartı menüye uygulanınca mevcut fiyat değişir', async ({ page }) => {
  const errors = watchErrors(page);
  const base = await startProject(page, 'coffee', 'ist');
  await page.goto(`${base}/pricing`);
  const prem = page.getByTestId('card-prem');
  const premPrice = await prem.locator('.price').textContent();
  await prem.getByRole('button').click();
  await expect(page.getByTestId('card-now').locator('.price')).toHaveText(premPrice ?? '');
  await expect(prem.getByRole('button')).toBeDisabled();
  expect(errors).toEqual([]);
});
