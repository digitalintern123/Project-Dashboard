import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { E2E_USERS } from './users.mjs';
import { HERE, Recorder, click, hl, hlOff, moveTo, pick, scrollTo, scrollTop, tab, type } from './video-lib';

const T3 = '/project/del-t3-intl-lounge';
const PHOTOS = path.join(HERE, 'photos');
const only = process.env.CH ? process.env.CH.split(',').map(Number) : null;
const ch = (n: number, title: string, fn: Parameters<typeof test>[1]) =>
  (only && !only.includes(n) ? test.skip : test)(`ch${String(n).padStart(2, '0')} ${title}`, fn);

const pause = (page: Page, s: number) => page.waitForTimeout(s * 1000);

async function openProject(page: Page, path = T3) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await pause(page, 0.6);
}

ch(0, 'opening', async ({ browser }) => {
  const r = await Recorder.start(browser, 0);
  const page = r.page;
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  await r.rec();
  await r.beat(() => moveTo(page, page.getByRole('heading').first()));
  await r.beat(() => moveTo(page, page.getByLabel('Email')));
  await r.beat(() => moveTo(page, page.getByRole('button', { name: /sign in/i })));
  await r.stop();
});

ch(1, 'sign in and password', async ({ browser }) => {
  const r = await Recorder.start(browser, 1);
  const page = r.page;
  const u = E2E_USERS.newbie;
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await type(page, page.getByLabel('Email'), u.email, 35);
    await type(page, page.getByLabel('Password', { exact: true }), u.password, 35);
  });
  await r.beat(() => hl(page, page.getByRole('button', { name: 'Show password' })));
  await r.beat(async () => {
    await hlOff(page);
    await click(page, page.getByRole('button', { name: /sign in/i }));
    await expect(page.getByText('Set a new password')).toBeVisible();
    await type(page, page.getByLabel('Current password'), u.password, 30);
    await type(page, page.getByLabel('New password', { exact: true }), 'Lounge-2026-plan', 40);
    await type(page, page.getByLabel('Confirm new password'), 'Lounge-2026-plan', 40);
  });
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: /update password/i }));
    await expect(page.getByText('Logout')).toBeVisible();
  });
  await r.beat(() => hl(page, page.getByText('Priya Sharma').last(), { up: 1 }));
  await r.stop();
});

ch(2, 'find your way around', async ({ browser }) => {
  const r = await Recorder.start(browser, 2, 'lead');
  const page = r.page;
  await page.goto('/');
  await expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await hl(page, page.locator('aside nav').first(), { pad: 4 });
    for (const name of [/All projects/, /New project/, /My projects/, /Timeline/, /Milestones/, /Issues & risks/]) {
      await moveTo(page, page.getByRole('link', { name }).first());
      await pause(page, 0.5);
    }
  });
  await r.beat(async () => {
    await hl(page, page.getByText('Project lead', { exact: true }).first());
    await pause(page, 1.2);
    await hl(page, page.getByRole('button', { name: 'Open notifications' }).first());
    await pause(page, 1.2);
    await hl(page, page.getByText('Logout'));
  });
  await r.beat(() => hl(page, page.getByText('Backend Active').first()));
  await r.stop();
});

ch(3, 'dashboard', async ({ browser }) => {
  const r = await Recorder.start(browser, 3, 'lead');
  const page = r.page;
  await page.goto('/');
  await expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible();
  await r.rec();
  await r.beat(() => hl(page, page.getByRole('link', { name: /Portfolio overview/ }).first()));
  await r.beat(() => hl(page, page.getByText('Active projects', { exact: true }).first(), { up: 3 }));
  await r.beat(() => hl(page, page.getByText('Portfolio health', { exact: true }).first(), { up: 3 }));
  await r.beat(async () => {
    await hl(page, page.getByText('Management attention', { exact: true }).first(), { up: 3 });
    await pause(page, 2.5);
    await hlOff(page);
    await click(page, page.getByText('Delhi T3 International Lounge').first());
  });
  await r.stop();
});

ch(4, 'find a project', async ({ browser }) => {
  const r = await Recorder.start(browser, 4, 'lead');
  const page = r.page;
  await page.goto('/');
  const search = page.getByPlaceholder('Search projects');
  await expect(search).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await scrollTo(page, search, 140);
    await type(page, search, 'lounge', 90);
  });
  await r.beat(async () => {
    await click(page, page.getByRole('button', { name: /^Filters/ }).first());
    await pick(page, page.getByTestId('select-location-filter'), 'Delhi');
    await pause(page, 1.5);
    await pick(page, page.getByTestId('select-location-filter'), 'All');
    await search.fill('');
  });
  await r.beat(async () => {
    const row = page.getByText('Delhi T3 International Lounge').last();
    await scrollTo(page, row, 260);
    await hl(page, row, { up: 2 });
    await pause(page, 2);
    await hlOff(page);
    await click(page, row);
  });
  await r.stop();
});

ch(5, 'create a project', async ({ browser }) => {
  const r = await Recorder.start(browser, 5, 'coordinator');
  const page = r.page;
  await page.goto('/');
  await expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await click(page, page.getByRole('link', { name: /New project/ }).first());
    await expect(page.getByRole('heading', { name: 'Create new project' })).toBeVisible();
  });
  await r.beat(() => type(page, page.getByLabel('Project Name *'), 'Mumbai Departure Lounge', 50));
  await r.beat(async () => {
    const loc = page.getByRole('combobox', { name: 'Location', exact: true });
    await hl(page, loc);
    await pick(page, loc, 'Other location…');
    await hlOff(page);
    await type(page, page.getByLabel('Other location'), 'Mumbai', 110);
  });
  await r.beat(async () => {
    await pick(page, page.getByLabel('Category *'), 'Lounge');
    const target = page.getByLabel('Project Completion Date (Target) *');
    await click(page, target);
    await target.fill('2027-12-31');
    const aop = page.getByLabel('Approved Budget (AOP in ₹ Cr) *');
    await scrollTo(page, aop, 300);
    await click(page, aop);
    await aop.fill('');
    await aop.pressSequentially('18', { delay: 120 });
  });
  await r.beat(async () => {
    const allot = page.getByLabel('Allot to Project Lead *');
    await scrollTo(page, allot, 200);
    await hl(page, allot);
    await allot.selectOption('u-rahul');
  });
  await r.beat(async () => {
    await hlOff(page);
    await click(page, page.getByRole('button', { name: /Create project/ }));
    await expect(page.getByText(/Mumbai Departure Lounge/).first()).toBeVisible();
  });
  await r.stop();
});

ch(6, 'inside a project', async ({ browser }) => {
  const r = await Recorder.start(browser, 6, 'lead');
  const page = r.page;
  await openProject(page);
  await r.rec();
  await r.beat(async () => {
    await hl(page, page.getByRole('combobox', { name: 'Change project status' }));
    await pause(page, 1.5);
    await hl(page, page.getByText('Current health', { exact: true }), { up: 2 });
  });
  await r.beat(() => hl(page, page.getByRole('button', { name: /Edit project/ })));
  await r.beat(() => hl(page, page.getByText('Completion %', { exact: true }), { up: 4 }));
  await r.beat(async () => {
    await hl(page, page.getByRole('button', { name: /^Overview$/ }), { up: 1 });
    for (const name of [/^Progress$/, /^Timeline$/, /^Milestones$/, /^Commercial$/, /^Updates$/]) {
      await moveTo(page, tab(page, name));
    }
  });
  await r.beat(async () => {
    await hlOff(page);
    await openProject(page, '/project/goa-central-kitchen');
    await hl(page, page.getByText(/View only/i).first());
  });
  await r.stop();
});

ch(7, 'update a stage', async ({ browser }) => {
  const r = await Recorder.start(browser, 7, 'lead');
  const page = r.page;
  await openProject(page);
  await r.rec();
  const form = page.locator('form').filter({ hasText: 'Save stage update' });
  await r.beat(async () => {
    await click(page, tab(page, /^Timeline$/));
    const btn = page.getByRole('button', { name: 'Update stage' }).nth(3);
    await scrollTo(page, btn, 260);
    await click(page, btn);
    await expect(form).toBeVisible();
  });
  await r.beat(async () => {
    const pct = form.getByLabel('Progress %');
    await scrollTo(page, pct, 220);
    await click(page, pct);
    await pct.fill('');
    await pct.pressSequentially('60', { delay: 150 });
    await hl(page, form.getByLabel('Status'));
  });
  await r.beat(async () => {
    await hlOff(page);
    await type(
      page,
      form.getByLabel('Work completed'),
      'Ceiling framing done in Zones A and B; MEP first fix 70%.',
      22,
    );
    await type(page, form.getByLabel('Next action'), 'Start stone flooring in the entry lobby.', 22);
  });
  await r.beat(() => hl(page, form.getByLabel('Decision required')));
  await r.beat(async () => {
    await hlOff(page);
    await click(page, form.getByRole('button', { name: 'Save stage update' }));
    await pause(page, 1);
    const stage = page.locator('main').getByText('Execution', { exact: true }).first();
    await scrollTo(page, stage, 200);
    await hl(page, stage, { up: 5 });
  });
  await r.beat(async () => {
    await hlOff(page);
    await click(page, page.getByRole('button', { name: 'Open notifications' }).first());
    await hl(page, page.getByText(/updated Procurement/).first(), { up: 2 });
  });
  await r.beat(async () => {
    await hlOff(page);
    await page.keyboard.press('Escape');
  });
  await r.stop();
});

ch(8, 'progress and milestones', async ({ browser }) => {
  const r = await Recorder.start(browser, 8, 'coordinator');
  const page = r.page;
  await openProject(page);
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Progress$/));
    const total = page.getByText('Total Project Delivery', { exact: true });
    await scrollTo(page, page.locator('table').first(), 200);
    await hl(page, total, { up: 1 });
  });
  await r.beat(async () => {
    await hlOff(page);
    await click(page, tab(page, /^Milestones$/));
    await scrollTo(page, page.getByText('Milestones & approvals', { exact: true }), 110);
    await click(page, page.getByRole('button', { name: /add milestone/i }).first());
    await type(page, page.getByPlaceholder('Milestone name'), 'Fire NOC received', 45);
    const date = page.locator('form input[type="date"]').first();
    await click(page, date);
    await date.fill('2026-12-05');
    await type(page, page.getByPlaceholder('Milestone owner'), 'Suresh Nair', 45);
  });
  await r.beat(async () => {
    await click(page, page.getByText('Requires HOD / stakeholder approval'));
    await click(page, page.getByRole('button', { name: /add milestone/i }).last());
    await pause(page, 0.8);
  });
  await r.beat(async () => {
    const approve = page.getByRole('button', { name: /Approve/ }).first();
    await scrollTo(page, approve, 300);
    await hl(page, approve);
    await pause(page, 1);
    await hlOff(page);
    await click(page, approve);
  });
  await r.beat(async () => {
    const done = page.getByRole('button', { name: /^Complete$/ }).first();
    await scrollTo(page, done, 300);
    await click(page, done);
  });
  await r.stop();
});

ch(9, 'issues and risks', async ({ browser }) => {
  const r = await Recorder.start(browser, 9, 'lead');
  const page = r.page;
  await openProject(page);
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Issues & risks$/));
    const first = page.getByText('Chiller delivery delayed by 3 weeks', { exact: true }).first();
    await scrollTo(page, first, 200);
    await hl(page, first, { up: 2 });
  });
  await r.beat(async () => {
    await hlOff(page);
    const add = page.getByRole('button', { name: /Add issue or risk/ });
    await scrollTo(page, add, 300);
    await click(page, add);
    await type(page, page.getByPlaceholder('Issue or risk title *'), 'Stone delivery at risk', 40);
    await type(page, page.getByPlaceholder('Issue owner'), 'Rahul Mehta', 40);
    await type(
      page,
      page.getByPlaceholder('Describe the issue, cause, and current situation *'),
      'Quarry strike may delay the imported stone by 10 days.',
      18,
    );
  });
  await r.beat(async () => {
    const severity = page
      .locator('form select')
      .filter({ has: page.locator('option', { hasText: 'High' }) })
      .first();
    await hl(page, severity);
    await severity.selectOption('High');
    await pause(page, 1);
    await hlOff(page);
    await click(page, page.getByRole('button', { name: 'Add issue', exact: true }));
  });
  await r.beat(async () => {
    const status = page.getByRole('combobox', { name: 'Status', exact: true }).nth(1);
    await scrollTo(page, status, 300);
    await hl(page, status);
    await status.selectOption('Action in progress');
  });
  await r.stop();
});

ch(10, 'updates and tagging', async ({ browser }) => {
  const r = await Recorder.start(browser, 10, 'lead');
  const page = r.page;
  await openProject(page);
  await r.rec();
  const form = page.locator('form').filter({ hasText: 'Post update' });
  await r.beat(async () => {
    await click(page, tab(page, /^Updates$/));
    const add = page.getByRole('button', { name: /add stage update/i });
    await scrollTo(page, add, 300);
    await click(page, add);
    await pick(page, form.locator('select').nth(0), 'Procurement');
    await pick(page, form.locator('select').nth(1), 'Decision');
  });
  await r.beat(async () => {
    await type(page, page.getByLabel('Update note'), 'Stone premium needs sign-off from @Ani', 40);
    await pause(page, 0.8);
    await click(page, page.getByText('Anita Desai').last());
  });
  await r.beat(() => click(page, page.getByRole('button', { name: 'Post update' })));
  await r.beat(async () => {
    await click(page, tab(page, /^Timeline$/));
    const tagBtn = page.getByRole('button', { name: /Tag Member/ }).nth(2);
    await scrollTo(page, tagBtn, 300);
    await click(page, tagBtn);
    await click(page, page.getByRole('button', { name: /Anita Desai/ }));
    await type(
      page,
      page.getByPlaceholder('Type @person to tag, then write message...'),
      'Please approve the stone premium by Friday.',
      25,
    );
    await hl(page, page.getByText('Will email:'), { up: 1 });
  });
  await r.beat(async () => {
    await hl(page, page.getByRole('button', { name: 'Tag & Send Mail' }));
  });
  await r.stop();
});

ch(11, 'photos and budget', async ({ browser }) => {
  const r = await Recorder.start(browser, 11, 'lead');
  const page = r.page;
  await openProject(page);
  await r.rec();
  await r.beat(async () => {
    await click(page, tab(page, /^Site Photograph/));
    await scrollTo(page, page.getByText('Site Photographs Gallery', { exact: true }), 110);
    await click(page, page.getByRole('button', { name: /upload site photographs/i }).first());
    await hl(page, page.getByRole('button', { name: /Browse Device|Choose Photos/ }).first());
    await page
      .locator('#site-photo-multi-input')
      .setInputFiles(['ceiling', 'flooring', 'facade'].map((f) => `${PHOTOS}/${f}.jpg`));
  });
  await r.beat(async () => {
    await hl(page, page.getByText(/Batch Metadata/).first(), { up: 1 });
    await pause(page, 2);
    await hlOff(page);
    await click(page, page.getByRole('button', { name: /^Upload \d+ Site Photograph/ }));
    await pause(page, 1.5);
  });
  await r.beat(async () => {
    await click(page, tab(page, /^Commercial$/));
    await hl(page, page.getByText('Approved Budget (AOP)', { exact: true }).last(), { up: 2 });
  });
  await r.beat(async () => {
    await hlOff(page);
    await click(page, page.getByRole('button', { name: /edit commercial data/i }));
    const spent = page.getByLabel('Spent Till Date');
    await click(page, spent);
    await spent.fill('');
    await spent.pressSequentially('22.6', { delay: 120 });
    await click(page, page.getByRole('button', { name: 'Save', exact: true }));
  });
  await r.stop();
});

ch(12, 'coordinators', async ({ browser }) => {
  const r = await Recorder.start(browser, 12, 'coordinator');
  const page = r.page;
  await page.goto('/');
  await expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible();
  await r.rec();
  await r.beat(async () => {
    await click(page, page.getByRole('link', { name: /Team & Allotment/ }));
    await expect(page.getByText('Create Project Lead').first()).toBeVisible();
  });
  await r.beat(async () => {
    await hl(page, page.getByText('Create Project Lead').first(), { up: 2 });
    await type(page, page.getByPlaceholder('e.g. Karan Verma'), 'Karan Verma', 60);
  });
  await r.beat(async () => {
    const reset = page.getByRole('button', { name: /Reset password/ }).first();
    await scrollTo(page, reset, 300);
    await hl(page, reset);
  });
  await r.beat(async () => {
    await hlOff(page);
    const row = page.getByText('Goa Central Kitchen').last();
    await scrollTo(page, row, 300);
    const allot = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: /Allot to/ }) })
      .nth(2);
    await hl(page, allot);
    await allot.selectOption('u-rahul');
  });
  await r.beat(async () => {
    await hlOff(page);
    await openProject(page);
    await click(page, page.getByRole('button', { name: /Email Update/ }));
    await type(page, page.getByPlaceholder(/Type @ followed by/), '@Anita Desai ', 50);
    await page.keyboard.press('Escape').catch(() => {});
    await type(
      page,
      page.getByPlaceholder(/Critical procurement milestones/),
      'Procurement 85% complete; chiller delay being recovered. Soft opening on track for 20 Feb.',
      18,
    );
    await hl(page, page.getByRole('button', { name: /Send Branded Update Email/ }));
  });
  await r.stop();
});

ch(13, 'closing', async ({ browser }) => {
  const r = await Recorder.start(browser, 13, 'lead');
  const page = r.page;
  await page.goto('/');
  await expect(page.getByText('Portfolio health', { exact: true }).first()).toBeVisible();
  await r.rec();
  await r.beat(() => scrollTo(page, page.getByText('Portfolio health', { exact: true }).first(), 300));
  await r.beat(() => scrollTop(page));
  await r.beat(() => moveTo(page, page.getByRole('link', { name: /Portfolio overview/ }).first()));
  await r.stop();
});
