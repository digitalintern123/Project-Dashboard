import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { E2E_USERS } from './users.mjs';
import {
  HERE,
  Recorder,
  click,
  hl,
  hlOff,
  legend,
  moveTo,
  pick,
  pop,
  retype,
  scrollTo,
  tab,
  type,
  unpop,
} from './video-lib';

// One test per chapter of tutorial-script.md, in order: they share one sample
// database (Part 2 creates "Delhi T2 Departure Lounge" and keeps using it).
const T3 = '/project/del-t3-intl-lounge';
const T2_NAME = 'Delhi T2 Departure Lounge';
const PHOTOS = path.join(HERE, 'photos');
const only = process.env.CH ? process.env.CH.split(',') : null;
const ch = (id: string, fn: Parameters<typeof test>[1]) => (only && !only.includes(id) ? test.skip : test)(id, fn);

const pause = (page: Page, s: number) => page.waitForTimeout(s * 1000);
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

async function openProject(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await pause(page, 0.6);
}

/** The project Rahul creates in Part 2, step 3. */
async function t2(page: Page) {
  const res = await page.request.get('/api/projects', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  const { projects } = (await res.json()) as { projects: { id: string; name: string }[] };
  const p = projects.find((x) => x.name === T2_NAME);
  if (!p) throw new Error(`${T2_NAME} not found: record p2s3 first`);
  return `/project/${p.id}`;
}

async function dashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible();
}

/** Sets a stage's planned dates off camera, as the Lead would in Update stage. */
async function stageDates(page: Page, url: string, stage: string, plannedStart: string, plannedFinish: string) {
  const id = url.split('/').pop();
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  const { project } = await (await page.request.get(`/api/projects/${id}`, { headers })).json();
  const phase = (project.phases as { id: string; name: string }[]).find((p) => p.name === stage)!;
  const res = await page.request.patch(`/api/projects/${id}/phases/${phase.id}`, {
    headers,
    data: { plannedStart, plannedFinish },
  });
  expect(res.status()).toBe(200);
}

const stageForm = (page: Page) => page.locator('form').filter({ hasText: 'Save stage update' });

// ---------------------------------------------------------------- Opening

ch('open', async ({ browser }) => {
  const r = await Recorder.start(browser, 'open');
  const page = r.page;
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  await r.rec();
  await r.beat(() => moveTo(page, page.getByRole('heading').first()));
  await r.beat(() => moveTo(page, page.getByLabel('Email')));
  await r.beat(() => moveTo(page, page.getByRole('button', { name: /sign in/i })));
  await r.stop();
});

// ---------------------------------------------------------------- Part 1: Project Coordinator (Priya)

ch('p1s1', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s1', undefined, 'coordinator');
  const page = r.page;
  const u = E2E_USERS.coordinator;
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await type(page, page.getByLabel('Email'), u.email, 30);
    await type(page, page.getByLabel('Password', { exact: true }), u.password, 30);
    await pop(page, page.getByRole('button', { name: /sign in/i }), 'Sign in');
    await pause(page, 0.9);
    await click(page, page.getByRole('button', { name: /sign in/i }));
  });
  await r.beat(() => expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible());
  await r.stop();
});

ch('p1s2', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s2', 'coordinator', 'coordinator');
  const page = r.page;
  await dashboard(page);
  await r.rec();
  await r.beat(() => pop(page, page.locator('aside nav').first(), 'Main menu'));
  await r.beat(() => pop(page, page.getByRole('link', { name: /Team & Allotment/ }), 'Team & Allotment'));
  await r.beat(async () => {
    await pop(page, page.getByText('Project coordinator', { exact: true }).first(), 'Your role');
    await pause(page, 1.8);
    await pop(page, page.getByRole('button', { name: 'Open notifications' }).first(), 'Notifications');
  });
  await r.beat(async () => {
    await unpop(page);
    await hl(page, page.getByText('Backend Active').first());
  });
  await r.stop();
});

ch('p1s3', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s3', 'coordinator', 'coordinator');
  const page = r.page;
  await dashboard(page);
  await r.rec();
  await r.beat(async () => {
    await click(page, page.getByRole('link', { name: /Team & Allotment/ }));
    await expect(page.getByText('Create Project Lead').first()).toBeVisible();
    await pop(page, page.getByRole('heading', { name: /Team & Project Allotment/ }), 'Team & Allotment');
  });
  await r.beat(async () => {
    await hl(page, page.locator('form').filter({ hasText: 'Create Project Lead Account' }), { move: false });
    await type(page, page.getByPlaceholder('e.g. Karan Verma'), 'Rahul Mehta', 45);
    await type(page, page.getByPlaceholder('e.g. karan.verma@encalm.com'), 'rahul.mehta@encalm.com', 25);
  });
  await r.beat(() => pop(page, page.getByPlaceholder(/Temporary password/), 'Temporary password'));
  await r.stop();
});

ch('p1s4', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s4', 'coordinator', 'coordinator');
  const page = r.page;
  await page.goto('/team');
  await expect(page.getByText('Create Project Lead').first()).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    const allot = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: /Allot to/ }) })
      .nth(2);
    await scrollTo(page, allot, 300);
    await pop(page, allot, 'Allot to');
    await pause(page, 1.5);
    await pick(page, allot, 'u-rahul');
  });
  await r.beat(async () => {
    const reset = page.getByRole('button', { name: /Reset password/ }).first();
    await scrollTo(page, reset, 300);
    await pop(page, reset, 'Reset password');
  });
  await r.stop();
});

ch('p1s5', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s5', 'coordinator', 'coordinator');
  const page = r.page;
  await dashboard(page);
  await r.rec();
  await r.beat(() => pop(page, page.getByText('Active projects', { exact: true }).first(), 'Key figures', { up: 3 }));
  await r.beat(() =>
    pop(page, page.getByText('Portfolio health', { exact: true }).first(), 'Portfolio health', { up: 3 }),
  );
  await r.beat(() =>
    pop(page, page.getByText('Management attention', { exact: true }).first(), 'Needs attention', { up: 3 }),
  );
  await r.beat(async () => {
    const bar = page.locator('[data-tone]').first();
    await scrollTo(page, bar, 260);
    await pop(page, bar, 'Progress bars', { up: 3 });
  });
  await r.stop();
});

ch('p1s6', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s6', 'coordinator', 'coordinator');
  const page = r.page;
  await openProject(page, T3);
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Milestones$/));
    const pending = page.getByText(/Approval · Pending/).first();
    await scrollTo(page, pending, 260);
    await pop(page, pending, 'Approval · Pending', { up: 2 });
  });
  await r.beat(async () => {
    const approve = page.getByRole('button', { name: /Approve/ }).first();
    await pop(page, approve, 'Approve / Reject', { up: 1 });
    await pause(page, 2);
    await click(page, approve);
  });
  await r.stop();
});

ch('p1s7', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p1s7', 'coordinator', 'coordinator');
  const page = r.page;
  await openProject(page, T3);
  await r.rec();
  await r.beat(async () => {
    const btn = page.getByRole('button', { name: /Email Update/ });
    await pop(page, btn, 'Email Update');
    await pause(page, 1.5);
    await click(page, btn);
  });
  await r.beat(async () => {
    const to = page.getByPlaceholder(/Type @ followed by/);
    await type(page, to, '@Rah', 120);
    await pause(page, 0.8);
    await click(page, page.getByRole('button', { name: /Rahul Mehta/ }).last());
    await pop(page, to, 'Recipients', { up: 1 });
  });
  await r.beat(async () => {
    await type(
      page,
      page.getByPlaceholder(/Critical procurement milestones/),
      'Procurement 85% complete; chiller delay being recovered. Soft opening on track for 20 Feb.',
      14,
    );
    await pop(page, page.getByRole('button', { name: /Send Branded Update Email/ }), 'Send');
  });
  await r.stop();
});

// ---------------------------------------------------------------- Part 2: Project Lead (Rahul)

ch('p2s1', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s1', undefined, 'lead');
  const page = r.page;
  const u = E2E_USERS.lead as { email: string; password: string; newPassword: string };
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await type(page, page.getByLabel('Email'), u.email, 30);
    await type(page, page.getByLabel('Password', { exact: true }), u.password, 30);
    await click(page, page.getByRole('button', { name: /sign in/i }));
    await expect(page.getByText('Set a new password')).toBeVisible();
    await pop(page, page.getByText('Set a new password'), 'Set a new password', { up: 1 });
  });
  await r.beat(async () => {
    await type(page, page.getByLabel('Current password'), u.password, 25);
    await type(page, page.getByLabel('New password', { exact: true }), u.newPassword, 35);
    await type(page, page.getByLabel('Confirm new password'), u.newPassword, 35);
  });
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: /update password/i }));
    await expect(page.getByText('Logout')).toBeVisible();
  });
  await r.stop();
});

ch('p2s2', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s2', 'lead', 'lead');
  const page = r.page;
  await dashboard(page);
  await r.rec();
  await r.beat(() => pop(page, page.getByText(/projects you manage/).first(), 'Your projects', { up: 1 }));
  await r.beat(async () => {
    const search = page.getByPlaceholder('Search projects');
    await scrollTo(page, search, 160);
    await type(page, search, 'lounge', 90);
    await pop(page, search, 'Search');
  });
  await r.stop();
});

ch('p2s3', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s3', 'lead', 'lead');
  const page = r.page;
  await dashboard(page);
  await r.rec();
  await r.beat(async () => {
    const link = page.getByRole('link', { name: /New project/ }).first();
    await pop(page, link, 'New project');
    await pause(page, 1.2);
    await click(page, link);
    await expect(page.getByRole('heading', { name: 'Create new project' })).toBeVisible();
  });
  await r.beat(async () => {
    await type(page, page.getByLabel('Project Name *'), T2_NAME, 45);
    await pop(page, page.getByLabel('Project Name *'), 'Project Name');
  });
  await r.beat(async () => {
    const loc = page.getByRole('combobox', { name: 'Location', exact: true });
    await pick(page, loc, 'Delhi');
    await pop(page, loc, 'Location · or “Other location…”');
  });
  await r.beat(async () => {
    await pick(page, page.getByLabel('Category *'), 'Lounge');
    const target = page.getByLabel('Project Completion Date (Target) *');
    await click(page, target);
    await target.fill(iso(330));
    const aop = page.getByLabel('Approved Budget (AOP in ₹ Cr) *');
    await scrollTo(page, aop, 300);
    await retype(page, aop, '18');
    await pop(page, aop, 'AOP');
  });
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: /Create project/ }));
    await expect(page.getByText(new RegExp(`${T2_NAME}.*ready`)).first()).toBeVisible();
  });
  await r.stop();
});

ch('p2s4', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s4', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await r.rec();
  await r.beat(() => pop(page, tab(page, /^Overview$/), 'Tabs', { up: 1 }));
  await r.beat(() =>
    pop(page, page.getByRole('combobox', { name: 'Change project status' }), 'Status · Health', { up: 3 }),
  );
  await r.beat(() => pop(page, page.getByRole('button', { name: /Edit project/ }), 'Edit project'));
  await r.beat(() => pop(page, page.getByText('Completion %', { exact: true }), 'Key figures', { up: 4 }));
  await r.beat(async () => {
    const info = page.getByText('Project information', { exact: true }).first();
    await scrollTo(page, info, 160);
    await pop(page, info, 'Project information', { up: 3 });
  });
  await r.stop();
});

ch('p2s5', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s5', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Progress$/));
    const table = page.locator('table').first();
    await scrollTo(page, table, 200);
    await pop(page, table, 'Stage table');
  });
  await r.beat(() =>
    pop(page, page.getByText('Total Project Delivery', { exact: true }), 'Total Project Delivery', { up: 1 }),
  );
  await r.stop();
});

ch('p2s6', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s6', 'lead', 'lead');
  const page = r.page;
  const url = await t2(page);
  await stageDates(page, url, 'Design development', iso(-11), iso(60));
  await openProject(page, url);
  await r.rec();
  const form = stageForm(page);
  const plan = async (start: string, finish: string) => {
    const s = form.getByLabel('Planned start');
    await scrollTo(page, s, 260);
    await click(page, s);
    await s.fill(start);
    await click(page, form.getByLabel('Planned finish'));
    await form.getByLabel('Planned finish').fill(finish);
    return form;
  };
  await r.beat(async () => {
    await click(page, tab(page, /^Timeline$/));
    const btn = page.getByRole('button', { name: 'Update stage' }).first();
    await scrollTo(page, btn, 300);
    await pop(page, btn, 'Update stage');
    await pause(page, 0.6);
    await click(page, btn);
    await expect(form).toBeVisible();
  });
  await r.beat(async () => {
    // Brief & scope was due to finish 12 days ago; Design development has just started.
    await plan(iso(-60), iso(-12));
    await pop(page, form.getByLabel('Planned start'), 'Planned start · Planned finish', { up: 2 });
    await pause(page, 1);
    await click(page, form.getByRole('button', { name: 'Save stage update' }));
  });
  await r.beat(async () => {
    const first = page.locator('main strong[class~="text-[12px]"]', { hasText: /^Brief & scope$/ }).first();
    await scrollTo(page, first, 200);
    await pop(page, first, 'Stage bars', { up: 5 });
  });
  await r.beat(() => legend(page));
  await r.stop();
});

ch('p2s7', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s7', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await click(page, tab(page, /^Timeline$/));
  await r.rec();
  const form = stageForm(page);
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: 'Update stage' }).first());
    const pct = form.getByLabel('Progress %');
    await scrollTo(page, pct, 260);
    await retype(page, pct, '100', 160);
    await pop(page, pct, 'Progress %');
  });
  await r.beat(async () => {
    await pop(page, form.getByLabel('Status'), 'Status: Complete');
    await pause(page, 2);
    await click(page, form.getByRole('button', { name: 'Save stage update' }));
  });
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: 'Update stage' }).nth(1));
    const status = form.getByLabel('Status');
    await scrollTo(page, status, 260);
    await hl(page, status);
    await pause(page, 1.2);
    await retype(page, form.getByLabel('Progress %'), '40', 200);
    await pop(page, status, 'Status: In progress');
  });
  await r.beat(async () => {
    await unpop(page);
    await hl(page, form.getByLabel('Status'));
  });
  await r.beat(async () => {
    await hlOff(page);
    await type(page, form.getByLabel('Work completed'), 'Concept layouts done.', 9);
    await type(page, form.getByLabel('Next action'), 'Share options with Operations.', 9);
    await pop(page, form.getByLabel('Work completed'), 'Work completed · Next action', { up: 2 });
    await pause(page, 0.6);
    await click(page, form.getByRole('button', { name: 'Save stage update' }));
  });
  await r.beat(async () => {
    const design = page.locator('main strong[class~="text-[12px]"]', { hasText: /^Design development$/ }).first();
    await scrollTo(page, design, 220);
    await hl(page, design, { up: 5 });
  });
  await r.stop();
});

ch('p2s8', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s8', 'lead', 'lead');
  const page = r.page;
  const url = await t2(page);
  // Off camera: an earlier milestone, ready to be marked Complete in the last line.
  const res = await page.request.post(`/api/projects/${url.split('/').pop()}/milestones`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: {
      title: 'Brief signed off',
      date: iso(-12),
      status: 'upcoming',
      stage: 'Brief & scope',
      owner: 'Rahul Mehta',
    },
  });
  expect(res.status()).toBeLessThan(300);
  await openProject(page, url);
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Milestones$/));
    await scrollTo(page, page.getByText('Milestones & approvals', { exact: true }), 110);
    await click(page, page.getByRole('button', { name: /add milestone/i }).first());
    await type(page, page.getByPlaceholder('Milestone name'), 'Design freeze', 22);
    const d = page.locator('form input[type="date"]').first();
    await click(page, d);
    await d.fill(iso(50));
    await type(page, page.getByPlaceholder('Milestone owner'), 'Design team', 18);
  });
  await r.beat(async () => {
    await click(page, page.getByText('Requires HOD / stakeholder approval'));
    await click(page, page.getByRole('button', { name: /add milestone/i }).last());
    await pause(page, 0.6);
    await pop(page, page.getByText('Design freeze').first(), 'Requires approval', { up: 2 });
  });
  await r.beat(async () => {
    const done = page.getByRole('button', { name: /^Complete$/ }).first();
    await pop(page, done, 'Complete');
    await pause(page, 1.2);
    await click(page, done);
  });
  await r.stop();
});

ch('p2s9', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s9', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Site Photograph/));
    await click(page, page.getByRole('button', { name: /upload site photographs/i }).first());
    await page
      .locator('#site-photo-multi-input')
      .setInputFiles(['ceiling', 'flooring', 'facade'].map((f) => `${PHOTOS}/${f}.jpg`));
    await pop(page, page.getByRole('button', { name: /Browse Device|Choose Photos/ }).first(), 'Upload');
  });
  await r.beat(async () => {
    await pop(page, page.getByText(/Batch Metadata/).first(), 'Batch details', { up: 1 });
    await pause(page, 2.5);
    await click(page, page.getByRole('button', { name: /^Upload \d+ Site Photograph/ }));
  });
  await r.stop();
});

ch('p2s10', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s10', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Commercial$/));
    await pop(page, page.getByText('Capital position & commercial metrics').first(), 'Commercial', { up: 2 });
  });
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: /edit commercial data/i }));
    await retype(page, page.getByLabel('Committed Cost'), '6.5', 60);
    await retype(page, page.getByLabel('Spent Till Date'), '1.2', 60);
    await click(page, page.getByRole('button', { name: 'Save', exact: true }));
    await pop(page, page.getByText('Spent Till Date', { exact: true }).last(), 'Committed · Spent till date', {
      up: 2,
    });
  });
  await r.stop();
});

ch('p2s11', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s11', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Issues & risks$/));
    const add = page.getByRole('button', { name: /Add issue or risk/ });
    await scrollTo(page, add, 300);
    await click(page, add);
    await type(page, page.getByPlaceholder('Issue or risk title *'), 'Stone delivery at risk', 14);
    await page
      .getByPlaceholder('Describe the issue, cause, and current situation *')
      .fill('Quarry strike may delay the stone.');
  });
  await r.beat(async () => {
    const severity = page
      .locator('form select')
      .filter({ has: page.locator('option', { hasText: 'High' }) })
      .first();
    await pick(page, severity, 'High');
    await pop(page, severity, 'Severity');
    await pause(page, 1.5);
    await click(page, page.getByRole('button', { name: 'Add issue', exact: true }));
  });
  await r.beat(async () => {
    const status = page.getByRole('combobox', { name: 'Status', exact: true }).first();
    await scrollTo(page, status, 300);
    await pick(page, status, 'Action in progress');
    await pop(page, status, 'Status');
  });
  await r.stop();
});

ch('p2s12', async ({ browser }) => {
  const r = await Recorder.start(browser, 'p2s12', 'lead', 'lead');
  const page = r.page;
  await openProject(page, await t2(page));
  await r.rec();
  const form = page.locator('form').filter({ hasText: 'Post update' });
  await r.beat(async () => {
    await click(page, tab(page, /^Updates$/));
    const add = page.getByRole('button', { name: /add stage update/i });
    await scrollTo(page, add, 300);
    await click(page, add);
    await pick(page, form.locator('select').nth(0), 'Design development');
    await pick(page, form.locator('select').nth(1), 'Progress');
    await type(page, page.getByLabel('Update note'), 'Layouts shared for review with ', 18);
  });
  await r.beat(async () => {
    await page.getByLabel('Update note').pressSequentially('@Pri', { delay: 160 });
    await pause(page, 0.8);
    await pop(page, page.getByRole('button', { name: /Priya Sharma/ }).last(), 'Pick a person', { up: 1 });
    await pause(page, 1.8);
    await click(page, page.getByRole('button', { name: /Priya Sharma/ }).last());
    await click(page, page.getByRole('button', { name: 'Post update' }));
  });
  await r.beat(async () => {
    await click(page, tab(page, /^Timeline$/));
    const tagBtn = page.getByRole('button', { name: /Tag Member/ }).nth(1);
    await scrollTo(page, tagBtn, 320);
    await click(page, tagBtn);
    await pop(page, page.getByText('Select Member(s):'), 'Select members', { up: 2 });
    await pause(page, 0.9);
    await click(page, page.getByRole('button', { name: /Priya Sharma/ }));
  });
  await r.beat(async () => {
    await type(
      page,
      page.getByPlaceholder('Type @person to tag, then write message...'),
      'Please review the design options by Friday.',
      22,
    );
    await pop(page, page.getByText('Will email:'), 'Will email', { up: 1 });
    await pause(page, 2);
    await unpop(page);
    await hl(page, page.getByRole('button', { name: 'Tag & Send Mail' }));
  });
  await r.stop();
});

// ---------------------------------------------------------------- Closing

ch('close', async ({ browser }) => {
  const r = await Recorder.start(browser, 'close', 'lead');
  const page = r.page;
  await dashboard(page);
  await r.rec();
  await r.beat(() => scrollTo(page, page.getByText('Portfolio health', { exact: true }).first(), 300));
  await r.beat(async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await moveTo(page, page.getByRole('link', { name: /Portfolio overview/ }).first());
  });
  await r.stop();
});
