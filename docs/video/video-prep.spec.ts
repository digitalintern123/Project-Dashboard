import { test, expect } from '@playwright/test';
import { E2E_USERS } from './users.mjs';

const H = { 'X-Requested-With': 'XMLHttpRequest' };

// Runs after the seed: Neha (Coordinator) moves Procurement on Delhi T3, so
// Rahul has a real stage notification to open in chapter 7.
test('prep: coordinator stage update for the notification scene', async ({ playwright }) => {
  const neha = await playwright.request.newContext({ baseURL: 'http://localhost:5073' });
  const u = E2E_USERS.coordinator;
  expect(
    (await neha.post('/api/auth/login', { headers: H, data: { email: u.email, password: u.password } })).status(),
  ).toBe(200);
  const { project } = await (await neha.get('/api/projects/del-t3-intl-lounge', { headers: H })).json();
  const proc = project.phases.find((p: { name: string }) => p.name === 'Procurement');
  const r = await neha.patch(`/api/projects/del-t3-intl-lounge/phases/${proc.id}`, {
    headers: H,
    data: { progress: 85 },
  });
  expect(r.status(), await r.text()).toBe(200);
});
