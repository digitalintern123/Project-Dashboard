import { expect, type Page } from '@playwright/test';
import { E2E_USERS, type E2ERole } from './users';

export async function login(page: Page, role: E2ERole) {
  const user = E2E_USERS[role];
  // Surface uncaught frontend errors in the test output.
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) console.log(`[console.error] ${msg.text()}`);
  });
  await page.goto('/');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('Logout')).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByText('Logout').click();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
}

/** Calls the API with the page's session cookies and CSRF header. */
export function api(page: Page) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  return {
    get: (path: string) => page.request.get(path, { headers }),
    post: (path: string, data?: unknown) => page.request.post(path, { headers, data }),
    patch: (path: string, data?: unknown) => page.request.patch(path, { headers, data }),
    delete: (path: string) => page.request.delete(path, { headers }),
  };
}

export async function openTab(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).first().click();
}
