import path from 'node:path';
import { test, expect } from '@playwright/test';
import { api, login, logout, openTab } from './helpers';

// A real 1200x800 JPEG checked into e2e/ for the upload step.
const jpegPath = path.resolve('e2e/fixtures-site.jpg');

for (const role of ['coordinator', 'lead'] as const) {
  test(`${role}: create a project, add a stage, milestone and issue, upload a photo, log out`, async ({ page }) => {
    const name = `E2E ${role} lounge ${Date.now()}`;
    await login(page, role);

    // Create the project through the New project form.
    await page.getByRole('link', { name: /new project/i }).click();
    await page.getByLabel('Project Name *').fill(name);
    await page.getByLabel('Project Completion Date (Target) *').fill('2027-06-30');
    await page.getByRole('button', { name: /create project/i }).click();
    await expect(page.getByText(`${name} is ready for updates.`)).toBeVisible();

    const created = (await (await api(page).get('/api/projects')).json()).projects.find((p: any) => p.name === name);
    expect(created).toBeTruthy();
    await page.goto(`/project/${created.id}`);
    await expect(page.getByRole('heading', { name })).toBeVisible();

    // Stage
    await openTab(page, /^Timeline$/);
    await page.getByRole('button', { name: /add custom stage/i }).click();
    await page.getByPlaceholder('New stage name *').fill('Snagging');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Snagging').first()).toBeVisible();

    // Milestone
    await openTab(page, /^Milestones$/);
    await page.getByRole('button', { name: /add milestone/i }).click();
    await page.getByPlaceholder('Milestone name').fill('Design freeze');
    await page.locator('form input[type="date"]').first().fill('2026-12-15');
    await page.getByRole('button', { name: /add milestone/i }).click();
    await expect(page.getByText('Design freeze').first()).toBeVisible();

    // Issue
    await openTab(page, /^Issues & risks$/);
    await page.getByRole('button', { name: /add issue or risk/i }).click();
    await page.getByPlaceholder('Issue or risk title *').fill('Chiller lead time');
    await page.getByPlaceholder('Describe the issue, cause, and current situation *').fill('Vendor quoting 14 weeks');
    await page.getByRole('button', { name: /^add issue$/i }).click();
    await expect(page.getByText('Chiller lead time').first()).toBeVisible();

    // Photo
    await openTab(page, /^Site Photograph/);
    await page
      .getByRole('button', { name: /upload site photographs/i })
      .first()
      .click();
    await page.locator('#site-photo-multi-input').setInputFiles(jpegPath);
    await expect(page.getByText('Selected Photographs (1)')).toBeVisible();
    await page.getByRole('button', { name: /^Upload Site Photograph$/ }).click();
    await expect(page.getByText('Selected Photographs (1)')).toBeHidden();
    await expect(page.locator('img[src^="/uploads/"]').first()).toBeVisible();

    // Everything persisted on the server.
    const saved = (await (await api(page).get(`/api/projects/${created.id}`)).json()).project;
    expect(saved.phases.map((p: any) => p.name)).toContain('Snagging');
    expect(saved.milestones.map((m: any) => m.title)).toContain('Design freeze');
    expect(saved.issues.map((i: any) => i.title)).toContain('Chiller lead time');
    expect(saved.photos).toHaveLength(1);
    expect(saved.photos[0].url).toMatch(/\.webp$/);

    await logout(page);
    // The session is really gone.
    expect((await api(page).get('/api/auth/me')).status()).toBe(401);
  });
}
