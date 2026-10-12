import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();
const P = '/api/projects/proj-i';
let coord: any;
let lead: any;
let hod: any;

beforeAll(async () => {
  insertProject('proj-i', 'u-lead-a');
  coord = await loginAs(app, 'coordinator');
  lead = await loginAs(app, 'leadA');
  hod = await loginAs(app, 'hod');
});

const emailCount = () => (db.prepare('SELECT COUNT(*) c FROM email_logs').get() as { c: number }).c;

describe('stages', () => {
  it('adds a stage at the end and recomputes weighted progress', async () => {
    const res = await lead.post(`${P}/phases`).send({ id: 'st-2', name: 'Design', status: 'active', progress: 50, weight: 3 });
    expect(res.status).toBe(201);
    const names = res.body.project.phases.map((p: any) => p.name);
    expect(names).toEqual(['Brief & scope', 'Design']);
    // weight 3 at 50% vs implicit weight 1 at 0% -> 38%
    expect(res.body.project.progress).toBe(38);
  });

  it('uses planned durations as weights when none are explicit', async () => {
    insertProject('proj-dur', 'u-lead-a');
    db.prepare("UPDATE phases SET planned_start = '2026-01-01', planned_finish = '2026-01-31', progress = 100 WHERE project_id = 'proj-dur'").run();
    const res = await lead.post('/api/projects/proj-dur/phases').send({ name: 'Short', plannedStart: '2026-02-01', plannedFinish: '2026-02-11' });
    // 30 days at 100% and 10 days at 0% -> 75%
    expect(res.body.project.progress).toBe(75);
  });

  it('updates a stage, raises a decision notification and emails newly tagged users', async () => {
    const before = emailCount();
    const res = await lead.patch(`${P}/phases/st-2`).send({
      name: 'Design development',
      progress: 100,
      status: 'complete',
      owner: 'Design',
      plannedStart: '2026-01-01',
      plannedFinish: '2026-03-01',
      actualFinish: '2026-02-20',
      workCompleted: 'Drawings issued',
      nextAction: 'Tender',
      decisionRequired: 'Choose stone finish',
      weight: '',
      budget: 1000,
      taggedUsers: [testUsers.hod.id],
      notify: true,
    });
    expect(res.status).toBe(200);
    const st = res.body.project.phases.find((p: any) => p.id === 'st-2');
    expect(st).toMatchObject({ name: 'Design development', progress: 100, workCompleted: 'Drawings issued', taggedUsers: [testUsers.hod.id] });
    expect(emailCount()).toBe(before + 1);

    const inbox = await hod.get('/api/notifications');
    const titles = inbox.body.notifications.map((n: any) => n.title);
    expect(titles).toContain('Decision Needed: Design');
    expect(titles.some((t: string) => t.startsWith('Tagged on Stage'))).toBe(true);
  });

  it('does not email users who were already tagged', async () => {
    const before = emailCount();
    await lead.patch(`${P}/phases/st-2`).send({ taggedUsers: [testUsers.hod.id], notify: true });
    expect(emailCount()).toBe(before);
  });

  it('moves stages and rejects impossible moves', async () => {
    const res = await lead.post(`${P}/phases/move`).send({ phaseIndex: 1, direction: -1 });
    expect(res.status).toBe(200);
    expect(res.body.project.phases[0].id).toBe('st-2');
    expect((await lead.post(`${P}/phases/move`).send({ phaseIndex: 0, direction: -1 })).status).toBe(400);
  });

  it('deletes a stage but never the last one, and 404s for unknown stages', async () => {
    expect((await lead.patch(`${P}/phases/nope`).send({ name: 'x' })).status).toBe(404);
    expect((await lead.delete(`${P}/phases/nope`)).status).toBe(404);
    expect((await lead.delete(`${P}/phases/st-2`)).status).toBe(200);
    expect((await lead.delete(`${P}/phases/proj-i-phase-0`)).status).toBe(400);
  });

  it('rejects a duplicate stage id with 409 and unknown projects with 404', async () => {
    expect((await lead.post(`${P}/phases`).send({ id: 'proj-i-phase-0', name: 'Dup' })).status).toBe(409);
    expect((await coord.post('/api/projects/nope/phases').send({ name: 'x' })).status).toBe(404);
  });
});

describe('milestones', () => {
  it('creates a milestone; approval requests notify and email the coordinator', async () => {
    const before = emailCount();
    const res = await lead.post(`${P}/milestones`).send({ id: 'ms-1', title: 'Design sign-off', date: '2026-12-01', stage: 'Design', approvalRequired: true, taggedUsers: [testUsers.hod.id] });
    expect(res.status).toBe(201);
    expect(res.body.project.milestones[0]).toMatchObject({ id: 'ms-1', approvalStatus: 'Pending', taggedUsers: [testUsers.hod.id] });
    expect(emailCount()).toBeGreaterThan(before);
    const titles = (await coord.get('/api/notifications')).body.notifications.map((n: any) => n.title);
    expect(titles).toContain('Approval Requested: Design sign-off');
  });

  it('lets only the coordinator approve', async () => {
    expect((await lead.patch(`${P}/milestones/ms-1`).send({ approvalStatus: 'Approved' })).status).toBe(403);
    const res = await coord.patch(`${P}/milestones/ms-1`).send({ approvalStatus: 'Approved' });
    expect(res.body.project.milestones[0].approvalStatus).toBe('Approved');
  });

  it('updates and completes a milestone', async () => {
    const res = await lead.patch(`${P}/milestones/ms-1`).send({
      title: 'Design freeze', date: '2026-12-15', status: 'complete', completedDate: '2026-12-10', owner: 'PMO', stage: 'Design', approvalRequired: false,
      taggedUsers: [testUsers.hod.id, testUsers.leadB.id], notify: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.project.milestones[0]).toMatchObject({ title: 'Design freeze', status: 'complete', completedDate: '2026-12-10' });
  });

  it('404s for unknown milestones and deletes existing ones', async () => {
    expect((await lead.patch(`${P}/milestones/nope`).send({ title: 'x' })).status).toBe(404);
    expect((await lead.delete(`${P}/milestones/nope`)).status).toBe(404);
    expect((await lead.delete(`${P}/milestones/ms-1`)).status).toBe(200);
    expect((await lead.post(`${P}/milestones`).send({ id: 'ms-2', title: 'a', date: 'b' })).status).toBe(201);
    expect((await lead.post(`${P}/milestones`).send({ id: 'ms-2', title: 'a', date: 'b' })).status).toBe(409);
  });
});

describe('issues', () => {
  it('creates a high-severity issue: alert notification, critical emails, tagged users', async () => {
    const before = emailCount();
    const res = await lead.post(`${P}/issues`).send({
      id: 'is-1', title: 'Water ingress', detail: 'Roof leak over bar', severity: 'High', category: 'Construction',
      issueAriseDate: '2026-10-01', targetClosureDate: '2026-10-20', impactCost: '2L', impactSchedule: '1 week', impactScope: 'Bar',
      action: 'Waterproof', taggedUsers: [testUsers.hod.id],
    });
    expect(res.status).toBe(201);
    expect(res.body.project.issues[0]).toMatchObject({ id: 'is-1', severity: 'High', dateRaised: '2026-10-01', dueDate: '2026-10-20' });
    expect(emailCount()).toBeGreaterThan(before);
    const titles = (await hod.get('/api/notifications')).body.notifications.map((n: any) => n.title);
    expect(titles).toContain('Critical Issue: Water ingress');
  });

  it('updates an issue, including escalation to High and new tags', async () => {
    await lead.post(`${P}/issues`).send({ id: 'is-2', title: 'Minor snag', detail: 'Paint', severity: 'Low' });
    const res = await lead.patch(`${P}/issues/is-2`).send({
      title: 'Snag', detail: 'Paint chips', severity: 'High', owner: 'Contractor', category: 'Construction', status: 'Resolved',
      stage: 'Execution', dateRaised: '2026-10-02', dueDate: '2026-10-05', issueAriseDate: '2026-10-02', targetClosureDate: '2026-10-05',
      impactCost: '0', impactSchedule: '0', impactScope: 'None', action: 'Repaint', resolution: 'Done',
      taggedUsers: [testUsers.leadB.id], notify: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.project.issues.find((i: any) => i.id === 'is-2')).toMatchObject({ status: 'Resolved', resolution: 'Done', severity: 'High' });
  });

  it('404s for unknown issues and deletes existing ones', async () => {
    expect((await lead.patch(`${P}/issues/nope`).send({ title: 'x' })).status).toBe(404);
    expect((await lead.delete(`${P}/issues/nope`)).status).toBe(404);
    expect((await lead.delete(`${P}/issues/is-2`)).status).toBe(200);
    expect((await lead.post(`${P}/issues`).send({ id: 'is-1', title: 'a', detail: 'b' })).status).toBe(409);
  });
});

describe('updates feed', () => {
  it('posts an update attributed to the signed-in user', async () => {
    const res = await lead.post(`${P}/updates`).send({ text: 'Ceiling framing complete', kind: 'Progress', stage: 'Execution' });
    expect(res.status).toBe(201);
    expect(res.body.project.updates[0]).toMatchObject({ text: 'Ceiling framing complete', author: testUsers.leadA.name, kind: 'Progress' });
  });

  it('lists updates for a project and across the portfolio', async () => {
    const one = await hod.get(`${P}/updates`);
    expect(one.status).toBe(200);
    expect(one.body.updates[0].text).toBe('Ceiling framing complete');
    const all = await hod.get('/api/updates');
    expect(all.body.updates[0].project.id).toBe('proj-i');
  });

  it('404s for an unknown project', async () => {
    expect((await coord.post('/api/projects/nope/updates').send({ text: 'x' })).status).toBe(404);
  });
});
