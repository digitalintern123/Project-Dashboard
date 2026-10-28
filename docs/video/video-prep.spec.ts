import { test, expect } from '@playwright/test';
import { E2E_USERS } from './users.mjs';

const H = { 'X-Requested-With': 'XMLHttpRequest' };

// Runs after the seed. Creating a project does not store stage dates, so
// Priya (Coordinator) adds planned dates to Delhi T3's stages, giving its bars
// real schedule colours where the video shows them.
const T3_DATES: Record<string, [string, string]> = {
  'Brief & scope': ['2026-03-01', '2026-04-15'],
  'Design development': ['2026-04-16', '2026-07-31'],
  Procurement: ['2026-07-01', '2026-11-30'],
  Execution: ['2026-06-01', '2026-12-15'],
  Handover: ['2027-02-01', '2027-02-28'],
};

test('prep: planned stage dates for Delhi T3', async ({ playwright }) => {
  const priya = await playwright.request.newContext({ baseURL: 'http://localhost:5073' });
  const u = E2E_USERS.coordinator;
  expect(
    (await priya.post('/api/auth/login', { headers: H, data: { email: u.email, password: u.password } })).status(),
  ).toBe(200);
  const { project } = await (await priya.get('/api/projects/del-t3-intl-lounge', { headers: H })).json();
  for (const phase of project.phases as { id: string; name: string }[]) {
    const [plannedStart, plannedFinish] = T3_DATES[phase.name] ?? [];
    if (!plannedStart) continue;
    const r = await priya.patch(`/api/projects/del-t3-intl-lounge/phases/${phase.id}`, {
      headers: H,
      data: { plannedStart, plannedFinish },
    });
    expect(r.status(), await r.text()).toBe(200);
  }
});
