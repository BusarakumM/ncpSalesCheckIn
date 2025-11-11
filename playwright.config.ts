import { defineConfig, devices } from '@playwright/test';

const LIVE = process.env.E2E_LIVE === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  // Next.js dev build can be slow on first compile; keep time generous locally.
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Avoid overloading Next dev with many parallel workers locally
  workers: process.env.CI ? 2 : 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: LIVE ? 'npm run build && npm run start' : 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: LIVE ? 'production' : 'development',
      GRAPH_WORKBOOK_PATH: process.env.GRAPH_WORKBOOK_PATH,
      GRAPH_UPLOAD_FOLDER: process.env.GRAPH_UPLOAD_FOLDER,
      E2E_LIVE: process.env.E2E_LIVE,
    },
  },
});
