/**
 * Lighthouse audit of the real build (desktop preset). Opt-in: run with
 * `npm run lighthouse`. Playwright signs in, Lighthouse then audits pages in
 * the same browser so it sees the signed-in app.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { E2E_USERS } from './users';

const MIN_SCORE = 0.9;
const CATEGORIES = ['performance', 'accessibility', 'best-practices'] as const;
const DEBUG_PORT = 9333;
const reportDir = path.resolve('lighthouse-report');

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

test('pages score at least 90 for performance, accessibility and best practices', async ({ baseURL }) => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'encalm-lh-'));
  // A persistent context shares the browser's default profile with Lighthouse's tab.
  const context = await chromium.launchPersistentContext(profile, {
    // Full Chromium in new headless mode: the old headless shell never paints Lighthouse's tab.
    channel: 'chromium',
    args: [`--remote-debugging-port=${DEBUG_PORT}`],
    viewport: { width: 1350, height: 940 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  fs.mkdirSync(reportDir, { recursive: true });

  const audit = async (name: string, url: string) => {
    const result = await lighthouse(
      url,
      { port: DEBUG_PORT, output: 'html', logLevel: 'error', onlyCategories: [...CATEGORIES] },
      desktopConfig,
    );
    if (!result) throw new Error(`Lighthouse returned nothing for ${url}`);
    fs.writeFileSync(path.join(reportDir, `${name}.html`), result.report as string);
    const scores = Object.fromEntries(CATEGORIES.map((c) => [c, result.lhr.categories[c]?.score ?? 0]));
    console.log(
      `[lighthouse] ${name.padEnd(14)} ${CATEGORIES.map((c) => `${c} ${Math.round(scores[c] * 100)}`).join('  ')}`,
    );
    return scores;
  };

  const results: Record<string, Record<string, number>> = {};
  try {
    results.login = await audit('login', `${baseURL}/login`);

    // Sign in through the UI so the session cookies land in this profile.
    const user = E2E_USERS.coordinator;
    await page.goto(`${baseURL}/`);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Logout')).toBeVisible();

    // Some content, so the pages are not empty.
    const headers = { 'X-Requested-With': 'XMLHttpRequest' };
    let projectId = '';
    for (let i = 0; i < 12; i++) {
      const res = await page.request.post(`${baseURL}/api/projects`, {
        headers,
        data: {
          name: `Lighthouse lounge ${i} ${Date.now()}`,
          location: ['Delhi', 'Hyderabad', 'Goa'][i % 3],
          category: i % 2 ? 'Lounge' : 'Hotel',
          targetDate: '2027-06-30',
          progress: (i * 9) % 100,
        },
      });
      expect(res.status()).toBe(201);
      projectId = (await res.json()).project.id;
    }

    results.dashboard = await audit('dashboard', `${baseURL}/`);
    results.projects = await audit('projects', `${baseURL}/projects`);
    results.project = await audit('project-detail', `${baseURL}/project/${projectId}`);
  } finally {
    await context.close();
  }

  const failures = Object.entries(results).flatMap(([pageName, scores]) =>
    Object.entries(scores)
      .filter(([, score]) => score < MIN_SCORE)
      .map(([category, score]) => `${pageName} ${category} ${Math.round(score * 100)}`),
  );
  expect(failures, `Below ${MIN_SCORE * 100}; reports in lighthouse-report/`).toEqual([]);
});
