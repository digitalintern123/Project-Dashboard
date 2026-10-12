import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, loginAs, insertProject, TestUserKey } from './helpers.js';
import { db } from '../src/db/database.js';
import { broadcastNotification } from '../src/utils/notify.js';

type Method = 'get' | 'post' | 'patch' | 'delete';
type Route = [Method, string];

const app = makeApp();

// Project owned by lead A, another owned by lead B.
beforeAll(() => {
  insertProject('proj-a', 'u-lead-a');
  insertProject('proj-b', 'u-lead-b');
});

const P = '/api/projects/proj-a';

const everyProtectedRoute: Route[] = [
  ['get', '/api/auth/me'],
  ['get', '/api/auth/users'],
  ['get', '/api/auth/leads'],
  ['post', '/api/auth/create-lead'],
  ['get', '/api/projects'],
  ['get', P],
  ['post', '/api/projects'],
  ['post', '/api/projects/sync'],
  ['patch', P],
  ['patch', `${P}/allot`],
  ['delete', P],
  ['post', `${P}/phases`],
  ['patch', `${P}/phases/x`],
  ['delete', `${P}/phases/x`],
  ['post', `${P}/phases/move`],
  ['post', `${P}/milestones`],
  ['patch', `${P}/milestones/x`],
  ['delete', `${P}/milestones/x`],
  ['post', `${P}/issues`],
  ['patch', `${P}/issues/x`],
  ['delete', `${P}/issues/x`],
  ['get', `${P}/updates`],
  ['post', `${P}/updates`],
  ['get', `${P}/photos`],
  ['post', `${P}/photos`],
  ['post', `${P}/photos/batch`],
  ['delete', `${P}/photos/x`],
  ['get', '/api/updates'],
  ['get', '/api/photos'],
  ['get', '/api/notifications'],
  ['patch', '/api/notifications/x/read'],
  ['post', '/api/notifications/read-all'],
  ['delete', '/api/notifications/x'],
  ['get', '/api/email/directory'],
  ['get', '/api/email/logs'],
  ['get', '/api/email/settings'],
  ['post', '/api/email/settings'],
  ['post', '/api/email/test'],
  ['post', '/api/email/resend/x'],
  ['post', '/api/email/send-project-update'],
  ['post', '/api/email/tag-and-comment'],
  ['get', '/api/system/export'],
  ['post', '/api/system/import'],
  ['post', '/api/system/reset'],
  ['post', '/api/system/clear'],
  ['post', '/api/system/restore-all-pdfs'],
  ['get', '/api/system/health'],
];

async function call(agent: any, [method, path]: Route, body: object = {}) {
  const req = agent[method](path);
  return method === 'get' || method === 'delete' ? req : req.send(body);
}

describe('unauthenticated access', () => {
  it.each(everyProtectedRoute)('%s %s returns 401 without a session', async (method, path) => {
    const res = await call(request(app), [method, path]);
    expect(res.status).toBe(401);
  });

  it('keeps the readiness probe public and minimal', async () => {
    const res = await request(app).get('/api/system/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });
});

const coordinatorOnly: Route[] = [
  ['post', '/api/auth/create-lead'],
  ['post', '/api/projects/sync'],
  ['patch', `${P}/allot`],
  ['delete', P],
  ['get', '/api/email/logs'],
  ['get', '/api/email/settings'],
  ['post', '/api/email/settings'],
  ['post', '/api/email/test'],
  ['post', '/api/email/resend/x'],
  ['post', '/api/system/import'],
  ['post', '/api/system/reset'],
  ['post', '/api/system/clear'],
  ['post', '/api/system/restore-all-pdfs'],
  ['get', '/api/system/health'],
];

const projectMutations: Route[] = [
  ['patch', P],
  ['post', `${P}/phases`],
  ['patch', `${P}/phases/x`],
  ['delete', `${P}/phases/x`],
  ['post', `${P}/phases/move`],
  ['post', `${P}/milestones`],
  ['patch', `${P}/milestones/x`],
  ['delete', `${P}/milestones/x`],
  ['post', `${P}/issues`],
  ['patch', `${P}/issues/x`],
  ['delete', `${P}/issues/x`],
  ['post', `${P}/updates`],
  ['post', `${P}/photos`],
  ['post', `${P}/photos/batch`],
  ['delete', `${P}/photos/x`],
];

const agents: Partial<Record<TestUserKey, any>> = {};
beforeAll(async () => {
  for (const key of ['coordinator', 'leadA', 'leadB', 'hod'] as TestUserKey[]) {
    agents[key] = await loginAs(app, key);
  }
});

describe('role restrictions', () => {
  it.each(coordinatorOnly)('%s %s is forbidden for a lead', async (method, path) => {
    const res = await call(agents.leadA, [method, path]);
    expect(res.status).toBe(403);
  });

  it.each(coordinatorOnly)('%s %s is forbidden for the HOD', async (method, path) => {
    const res = await call(agents.hod, [method, path]);
    expect(res.status).toBe(403);
  });

  it.each(projectMutations)('%s %s is forbidden for the HOD', async (method, path) => {
    const res = await call(agents.hod, [method, path]);
    expect(res.status).toBe(403);
  });

  it.each(projectMutations)("%s %s is forbidden for a lead on another lead's project", async (method, path) => {
    const res = await call(agents.leadB, [method, path]);
    expect(res.status).toBe(403);
  });

  it('forbids the HOD from creating projects', async () => {
    const res = await agents.hod.post('/api/projects').send({ name: 'X', location: 'Delhi', category: 'Lounge' });
    expect(res.status).toBe(403);
  });

  it('forbids a lead from reassigning their project to someone else', async () => {
    const res = await agents.leadA.patch(P).send({ leadId: 'u-lead-b' });
    expect(res.status).toBe(403);
  });

  it('returns 404 rather than 403 for a project that does not exist', async () => {
    const res = await agents.leadA.patch('/api/projects/nope').send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('allowed access', () => {
  it('lets every role read projects', async () => {
    for (const key of ['coordinator', 'leadA', 'hod'] as TestUserKey[]) {
      const res = await agents[key].get('/api/projects');
      expect(res.status).toBe(200);
    }
  });

  it('lets a lead edit their own project', async () => {
    const res = await agents.leadA.patch(P).send({ name: 'Renamed by lead A' });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Renamed by lead A');
  });

  it('lets a lead add a stage to their own project', async () => {
    const res = await agents.leadA.post(`${P}/phases`).send({ name: 'Design' });
    expect(res.status).toBe(201);
  });

  it('lets the coordinator edit any project', async () => {
    const res = await agents.coordinator.patch('/api/projects/proj-b').send({ name: 'Renamed by coordinator' });
    expect(res.status).toBe(200);
  });

  it('lets a lead create a project', async () => {
    const res = await agents.leadA
      .post('/api/projects')
      .send({ name: 'Lead project', location: 'Delhi', category: 'Lounge' });
    expect(res.status).toBe(201);
    expect(res.body.project.leadId).toBe('u-lead-a');
  });
});

describe('per-user notifications', () => {
  it('scopes inbox, read state and deletion to the signed-in user', async () => {
    db.prepare('DELETE FROM notifications').run();
    broadcastNotification('system', 'n1', 'Hello', 'World', 'proj-a', null);

    const coord = await agents.coordinator.get('/api/notifications');
    const hod = await agents.hod.get('/api/notifications');
    expect(coord.body.notifications).toHaveLength(1);
    expect(hod.body.notifications).toHaveLength(1);

    await agents.coordinator.post('/api/notifications/read-all');
    expect((await agents.coordinator.get('/api/notifications')).body.unreadCount).toBe(0);
    expect((await agents.hod.get('/api/notifications')).body.unreadCount).toBe(1);

    // The HOD cannot delete the coordinator's copy.
    const coordId = coord.body.notifications[0].id;
    expect((await agents.hod.delete(`/api/notifications/${coordId}`)).status).toBe(404);
    expect((await agents.coordinator.delete(`/api/notifications/${coordId}`)).status).toBe(200);
  });
});

describe('legacy notification migration', () => {
  it('copies global notifications into every inbox, keeping read state', async () => {
    const { fanOutLegacyNotifications } = await import('../src/utils/notify.js');
    db.prepare('DELETE FROM notifications').run();
    db.prepare(
      "INSERT INTO notifications (id, type, title, message, read) VALUES ('legacy-1', 'system', 'Old', 'Global', 1)",
    ).run();
    fanOutLegacyNotifications();
    expect(db.prepare('SELECT COUNT(*) c FROM notifications WHERE recipient_id IS NULL').get()).toEqual({ c: 0 });
    const hodInbox = (await agents.hod.get('/api/notifications')).body;
    expect(hodInbox.notifications[0]).toMatchObject({ title: 'Old', read: true });
    fanOutLegacyNotifications(); // no-op the second time
  });
});
