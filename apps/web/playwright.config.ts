import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  // Dev sunucusu ilk açılışta sayfaları derleyip tam yeniliyor (zaman aşımı, ERR_ABORTED);
  // testler production derlemesine karşı koşar.
  webServer: {
    command: `pnpm run build && pnpm exec next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
