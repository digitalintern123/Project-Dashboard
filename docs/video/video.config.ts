import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

// Cloud sessions have a pre-installed Chromium; elsewhere Playwright's own browser is used.
const chromium =
  process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: '.',
  testMatch: /video-.*\.spec\.ts/,
  workers: 1,
  timeout: 300_000,
  reporter: 'list',
  expect: { timeout: 10_000 },
  outputDir: '.out/test-results',
  use: {
    baseURL: 'http://localhost:5073',
    actionTimeout: 15_000,
    launchOptions: { executablePath: chromium, args: ['--lang=en-IN'] },
  },
});
