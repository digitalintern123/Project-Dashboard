import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 5070);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The server serves the built SPA from dist/, so build it first.
    command: 'npm run build:client && npx tsx e2e/server.ts',
    url: `http://localhost:${port}/api/system/ready`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { E2E_PORT: String(port) },
  },
});
