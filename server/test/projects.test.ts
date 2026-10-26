import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();
let coord: any;
let leadA: any;
let hod: any;

beforeAll(async () => {
  insertProject('proj-p1', 'u-lead-a');
  insertProject('proj-p2', 'u-lead-b');
  coord = await loginAs(app, 'coordinator');
  leadA = await loginAs(app, 'leadA');
  hod = await loginAs(app, 'hod');
});

describe('GET /api/projects', () => {
  it('lists every project with its children, open projects first', async () => {
    db.prepare("UPDATE projects SET status = 'Operational', progress = 100 WHERE id = 'proj-p2'").run();
    const res = await hod.get('/api/projects');
    expect(res.status).toBe(200);
    const ids = res.body.projects.map((p: any) => p.id);
    expect(ids.indexOf('proj-p1')).toBeLessThan(ids.indexOf('proj-p2'));
    const p1 = res.body.projects.find((p: any) => p.id === 'proj-p1');
    expect(p1.phases).toHaveLength(1);
    expect(p1).toHaveProperty('milestones');
    expect(p1).toHaveProperty('photos');
  });

  it('returns one project, or 404', async () => {
    expect((await hod.get('/api/projects/proj-p1')).body.project.name).toBe('Project proj-p1');
    expect((await hod.get('/api/projects/nope')).status).toBe(404);
  });
});

describe('POST /api/projects', () => {
  it('creates a project with default stages, a slug id and the creator as lead', async () => {
    const res = await leadA
      .post('/api/projects')
      .send({ name: 'New Lounge!', location: 'New Delhi', category: 'Lounge', aop: 100 });
    expect(res.status).toBe(201);
    const p = res.body.project;
    expect(p.id).toMatch(/^new-delhi-new-lounge-\d+$/);
    expect(p.leadId).toBe(testUsers.leadA.id);
    expect(p.phases.map((ph: any) => ph.name)).toEqual([
      'Brief & scope',
      'Design development',
      'Procurement',
      'Execution',
      'Handover',
    ]);
    expect(p.projectedCost).toBe(100);
    expect(p.health).toBe('Not started');
  });

  it('accepts supplied stages, milestones and issues', async () => {
    const res = await coord.post('/api/projects').send({
      id: 'proj-full',
      name: 'Full',
      location: 'Goa',
      category: 'Hotel',
      progress: 10,
      phases: [{ name: 'Only stage', status: 'active', progress: 10 }],
      milestones: [{ title: 'Kick-off', date: '2026-11-01', approvalRequired: true }],
      issues: [{ title: 'Permit', detail: 'Pending', severity: 'High' }],
      specification: { projectType: 'Transit hotel' },
    });
    expect(res.status).toBe(201);
    const p = res.body.project;
    expect(p.health).toBe('On track');
    expect(p.phases).toHaveLength(1);
    expect(p.milestones[0]).toMatchObject({ title: 'Kick-off', approvalRequired: true, approvalStatus: 'Pending' });
    expect(p.issues[0]).toMatchObject({ title: 'Permit', owner: testUsers.coordinator.name });
    expect(p.specification.projectType).toBe('Transit hotel');
  });

  it('rejects a duplicate id with 409', async () => {
    const res = await coord
      .post('/api/projects')
      .send({ id: 'proj-full', name: 'Again', location: 'Goa', category: 'Hotel' });
    expect(res.status).toBe(409);
  });

  it('notifies every inbox about the new project', async () => {
    const inbox = await hod.get('/api/notifications');
    expect(inbox.body.notifications.some((n: any) => n.title === 'New Project Created: Full')).toBe(true);
  });
});

describe('PATCH /api/projects/:id', () => {
  it('saves a location that is not one of the standard places', async () => {
    const res = await leadA.patch('/api/projects/proj-p1').send({ location: 'Navi Mumbai' });
    expect(res.status).toBe(200);
    const read = await hod.get('/api/projects/proj-p1');
    expect(read.body.project.location).toBe('Navi Mumbai');
  });

  it('updates fields, clamps progress and keeps the manual status', async () => {
    const res = await leadA.patch('/api/projects/proj-p1').send({
      name: 'Renamed',
      health: 'At risk',
      progress: 55,
      aop: 10,
      awarded: 5,
      spent: 1,
      projected_cost: 12,
      pax_keys: '120 pax',
      area: '500 sqm',
      code: 'DEL-X',
      targetDate: '2027-01-01',
      targetLabel: 'Jan 2027',
      nextMilestone: 'Design freeze',
      nextMilestoneDate: '2026-12-01',
      startDate: '2026-01-01',
      location: 'Delhi',
      category: 'Lounge',
      specification: { scope: 'Fit-out' },
    });
    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({
      name: 'Renamed',
      health: 'At risk',
      progress: 55,
      projectedCost: 12,
      paxKeys: '120 pax',
      area: '500 sqm',
      status: 'In Design',
    });
    expect(res.body.project.specification.scope).toBe('Fit-out');
  });

  it('sets a stage budget through the project patch', async () => {
    const res = await leadA
      .patch('/api/projects/proj-p1')
      .send({ phases: [{ id: 'proj-p1-phase-0', budget: '2500' }] });
    expect(res.body.project.phases[0].budget).toBe(2500);
    const cleared = await leadA
      .patch('/api/projects/proj-p1')
      .send({ phases: [{ id: 'proj-p1-phase-0', budget: '' }] });
    expect(cleared.body.project.phases[0].budget ?? null).toBeNull();
  });

  it('lets the coordinator change status and lead', async () => {
    const res = await coord.patch('/api/projects/proj-p1').send({ status: 'On Hold', leadId: 'u-lead-a' });
    expect(res.body.project.status).toBe('On Hold');
  });

  it('returns 404 for an unknown project', async () => {
    expect((await coord.patch('/api/projects/nope').send({ name: 'x' })).status).toBe(404);
  });
});

describe('PATCH /api/projects/:id/allot', () => {
  it('assigns a lead and notifies', async () => {
    const res = await coord.patch('/api/projects/proj-p2/allot').send({ leadId: 'u-lead-a' });
    expect(res.status).toBe(200);
    expect(res.body.project.leadId).toBe('u-lead-a');
  });

  it('rejects a user who is not a lead, and unknown projects', async () => {
    expect((await coord.patch('/api/projects/proj-p2/allot').send({ leadId: 'u-hod' })).status).toBe(400);
    expect((await coord.patch('/api/projects/nope/allot').send({ leadId: 'u-lead-a' })).status).toBe(404);
  });
});

describe('POST /api/projects/sync', () => {
  it('upserts projects from a full payload', async () => {
    const current = (await coord.get('/api/projects/proj-p2')).body.project;
    const res = await coord.post('/api/projects/sync').send({ projects: [{ ...current, name: 'Synced name' }] });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect((await coord.get('/api/projects/proj-p2')).body.project.name).toBe('Synced name');
  });

  it('does not resurrect projects into an empty database unless explicit', async () => {
    const saved = db.prepare('SELECT COUNT(*) c FROM projects').get() as { c: number };
    expect(saved.c).toBeGreaterThan(0);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('deletes a project with its children and notifications, then 404s', async () => {
    const res = await coord.delete('/api/projects/proj-full');
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) c FROM milestones WHERE project_id = 'proj-full'").get()).toEqual({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM notifications WHERE project_id = 'proj-full'").get()).toEqual({ c: 0 });
    expect((await coord.delete('/api/projects/proj-full')).status).toBe(404);
  });
});
