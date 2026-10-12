import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();
const P = '/api/projects/proj-v';
let coord: any;

beforeAll(async () => {
  insertProject('proj-v', 'u-lead-a');
  coord = await loginAs(app, 'coordinator');
});

type Case = [string, 'post' | 'patch' | 'get' | 'delete', string, object | undefined, string];

const invalid: Case[] = [
  ['project without name', 'post', '/api/projects', { location: 'Delhi', category: 'Lounge' }, 'name'],
  ['project with unknown health', 'post', '/api/projects', { name: 'X', location: 'Delhi', category: 'Lounge', health: 'Great' }, 'health'],
  ['project with over-long name', 'post', '/api/projects', { name: 'x'.repeat(201), location: 'Delhi', category: 'Lounge' }, 'name'],
  ['project with negative budget', 'patch', P, { aop: -5 }, 'aop'],
  ['project progress over 100', 'patch', P, { progress: 150 }, 'progress'],
  ['project with id containing slashes', 'post', '/api/projects', { id: '../etc', name: 'X', location: 'Delhi', category: 'Lounge' }, 'id'],
  ['allot without leadId', 'patch', `${P}/allot`, {}, 'leadId'],
  ['stage move with bad direction', 'post', `${P}/phases/move`, { phaseIndex: 0, direction: 5 }, 'direction'],
  ['stage with bad status', 'post', `${P}/phases`, { name: 'S', status: 'done' }, 'status'],
  ['milestone without title', 'post', `${P}/milestones`, { date: '2026-12-01' }, 'title'],
  ['issue with bad severity', 'post', `${P}/issues`, { title: 'T', detail: 'D', severity: 'Critical' }, 'severity'],
  ['empty update', 'post', `${P}/updates`, { text: '' }, 'text'],
  ['update with huge text', 'post', `${P}/updates`, { text: 'x'.repeat(10001) }, 'text'],
  ['lead with invalid email', 'post', '/api/auth/create-lead', { name: 'N', email: 'not-an-email', password: 'Good-pass-123' }, 'email'],
  ['project update email with bad recipient', 'post', '/api/email/send-project-update', { projectId: 'proj-v', recipients: ['nope'] }, 'recipients'],
  ['import without projects', 'post', '/api/system/import', { notifications: [] }, 'projects'],
  ['email logs with bad limit', 'get', '/api/email/logs?limit=abc', undefined, 'limit'],
];

describe('request validation', () => {
  it.each(invalid)('rejects %s with 400 and a field error', async (_label, method, path, body, field) => {
    const req = coord[method](path);
    const res = await (body ? req.send(body) : req);
    expect(res.status).toBe(400);
    expect(res.body.fields.some((f: { field: string }) => f.field.includes(field))).toBe(true);
    expect(res.body.error).toMatch(/^Invalid /);
  });

  it('rejects malformed id params', async () => {
    const res = await coord.delete(`${P}/phases/${encodeURIComponent('bad id with spaces')}`);
    expect(res.status).toBe(400);
  });

  it('drops unknown fields instead of writing them', async () => {
    const res = await coord.patch(P).send({ name: 'Validated name', lead_id: 'u-hod', created_at: '1999' });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT name, lead_id FROM projects WHERE id = ?').get('proj-v') as any;
    expect(row).toEqual({ name: 'Validated name', lead_id: 'u-lead-a' });
  });

  it('accepts the project payload the New Project form sends', async () => {
    const res = await coord.post('/api/projects').send({
      id: `delhi-form-project-${Date.now()}`,
      name: 'Form project',
      location: 'Delhi',
      category: 'Lounge',
      code: 'DEL-NEW-26',
      health: 'Not started',
      status: 'On Hold',
      progress: 0,
      targetDate: '2027-03-31',
      targetLabel: '31 Mar 2027',
      aop: 500000000,
      awarded: 0,
      spent: 0,
      projectedCost: 500000000,
      area: '',
      paxKeys: '',
      nextMilestone: 'Project brief',
      nextMilestoneDate: '2026-10-12',
      leadId: 'u-lead-a',
      startDate: '2026-10-12',
      specification: { projectType: 'Premium Lounge', area: '', capacity: '', units: '', terminal: 'Delhi', floor: '', scope: '' },
      phases: [
        { name: 'Brief & scope', status: 'active', progress: 0, owner: 'PMO', taggedUsers: [] },
        { name: 'Handover', status: 'upcoming', progress: 0, owner: 'Operations', weight: undefined },
      ],
      milestones: [],
      issues: [],
      updates: [],
      photos: [],
      lastUpdated: '12 Oct 2026',
    });
    expect(res.status).toBe(201);
    expect(res.body.project.status).toBe('On Hold');
  });

  it('accepts numeric strings and blanks for stage weight and budget', async () => {
    const created = await coord.post(`${P}/phases`).send({ name: 'Weighted', weight: '25', budget: '' });
    expect(created.status).toBe(201);
    const phase = created.body.project.phases.find((p: any) => p.name === 'Weighted');
    expect(phase.weight).toBe(25);
  });
});
