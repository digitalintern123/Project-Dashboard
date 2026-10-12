import { test, expect } from '@playwright/test';
import { api, login, openTab } from './helpers';

test('HOD can view everything but change nothing', async ({ page, browser }) => {
  // Seed a project as the coordinator in a separate session.
  const coordCtx = await browser.newContext();
  const coordPage = await coordCtx.newPage();
  const { login: loginAs } = await import('./helpers');
  await loginAs(coordPage, 'coordinator');
  const name = `E2E HOD view ${Date.now()}`;
  const created = await (
    await api(coordPage).post('/api/projects', { name, location: 'Goa', category: 'Hotel' })
  ).json();
  await coordCtx.close();

  await login(page, 'hod');
  await expect(page.getByRole('link', { name: /new project/i })).toHaveCount(0);

  await page.goto(`/project/${created.project.id}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByRole('button', { name: /edit project/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /delete project/i })).toHaveCount(0);

  await openTab(page, /^Timeline$/);
  await expect(page.getByRole('button', { name: /add custom stage/i })).toHaveCount(0);
  await openTab(page, /^Milestones$/);
  await expect(page.getByRole('button', { name: /add milestone/i })).toHaveCount(0);
  await openTab(page, /^Issues & risks$/);
  await expect(page.getByRole('button', { name: /add issue or risk/i })).toHaveCount(0);
  await openTab(page, /^Site Photograph/);
  await expect(page.getByRole('button', { name: /upload site photographs/i })).toHaveCount(0);

  // The server refuses even if the UI is bypassed.
  const id = created.project.id;
  expect((await api(page).patch(`/api/projects/${id}`, { name: 'HOD edit' })).status()).toBe(403);
  expect((await api(page).post(`/api/projects/${id}/issues`, { title: 'x', detail: 'y' })).status()).toBe(403);
  expect((await api(page).post('/api/projects', { name: 'x', location: 'Goa', category: 'Hotel' })).status()).toBe(403);
});
