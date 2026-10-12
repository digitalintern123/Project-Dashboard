import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, anon, insertProject, testUsers, TEST_PASSWORD } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();
const P = '/api/projects/proj-audit';
let coord: any;

beforeAll(async () => {
  insertProject('proj-audit', 'u-lead-a');
  coord = await loginAs(app, 'coordinator');
});

const latest = (where: string, ...params: unknown[]) =>
  db
    .prepare(`SELECT * FROM audit_log WHERE ${where} ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get(...params) as any;

describe('audit log', () => {
  it('records project updates with before and after state, user and IP', async () => {
    await coord.patch(P).send({ name: 'Audited name' });
    const row = latest("action = 'update' AND entity_type = 'project' AND entity_id = ?", 'proj-audit');
    expect(row.user_id).toBe(testUsers.coordinator.id);
    expect(JSON.parse(row.before_json).name).toBe('Project proj-audit');
    expect(JSON.parse(row.after_json).name).toBe('Audited name');
    expect(row.ip).toBeTruthy();
  });

  it('records creates with the new id, and deletes with the old state', async () => {
    const lead = await loginAs(app, 'leadA');
    await lead.post(`${P}/issues`).send({ id: 'issue-audit-1', title: 'Leak', detail: 'Roof leak', severity: 'Low' });
    const created = latest("action = 'create' AND entity_type = 'issue'");
    expect(created.entity_id).toBe('issue-audit-1');
    expect(JSON.parse(created.after_json).title).toBe('Leak');

    await lead.delete(`${P}/issues/issue-audit-1`);
    const deleted = latest("action = 'delete' AND entity_type = 'issue'");
    expect(deleted.entity_id).toBe('issue-audit-1');
    expect(JSON.parse(deleted.before_json).title).toBe('Leak');
    expect(deleted.after_json).toBeNull();
  });

  it('does not record failed or forbidden requests', async () => {
    const before = (db.prepare('SELECT COUNT(*) c FROM audit_log').get() as { c: number }).c;
    const hod = await loginAs(app, 'hod');
    await hod.patch(P).send({ name: 'HOD edit' });
    await coord.patch(P).send({ progress: 999 });
    const loginRows = (db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'login'").get() as { c: number }).c;
    const after = (db.prepare('SELECT COUNT(*) c FROM audit_log').get() as { c: number }).c;
    // Only the HOD's login was added.
    expect(after - before).toBe(1);
    expect(loginRows).toBeGreaterThan(0);
  });

  it('records sign-in, failed sign-in, logout and password events without secrets', async () => {
    await anon(app).post('/api/auth/login').send({ email: testUsers.leadB.email, password: 'wrong-password-1' });
    const failed = latest("action = 'login_failed'");
    expect(failed.user_id).toBe(testUsers.leadB.id);
    expect(failed.after_json).not.toContain('wrong-password-1');

    const lead = await loginAs(app, 'leadB');
    await lead.post('/api/auth/logout');
    expect(latest("action = 'logout'").user_id).toBe(testUsers.leadB.id);

    await coord.post(`/api/auth/users/${testUsers.leadB.id}/reset-password`);
    expect(latest("action = 'password_reset'").entity_id).toBe(testUsers.leadB.id);

    const all = db.prepare('SELECT before_json, after_json FROM audit_log').all() as any[];
    const text = JSON.stringify(all);
    expect(text).not.toContain('password_hash');
    expect(text).not.toContain(TEST_PASSWORD);
  });

  it('redacts email secrets from settings changes', async () => {
    await coord
      .post('/api/email/settings')
      .send({ smtp: { host: 'smtp.test.local', pass: 'Secret-Smtp-1' }, graph: { clientSecret: 'Graph-Secret-1' } });
    const row = latest("entity_type = 'email_settings'");
    expect(row.after_json).toContain('smtp.test.local');
    expect(row.after_json).not.toContain('Secret-Smtp-1');
    expect(row.after_json).not.toContain('Graph-Secret-1');
  });
});

describe('GET /api/system/audit', () => {
  it('is coordinator-only', async () => {
    const lead = await loginAs(app, 'leadA');
    expect((await lead.get('/api/system/audit')).status).toBe(403);
  });

  it('paginates newest first and filters', async () => {
    const page1 = await coord.get('/api/system/audit?limit=2');
    expect(page1.status).toBe(200);
    expect(page1.body.entries).toHaveLength(2);
    expect(page1.body.total).toBeGreaterThan(2);
    const page2 = await coord.get('/api/system/audit?limit=2&offset=2');
    expect(page2.body.entries[0].id).not.toBe(page1.body.entries[0].id);
    expect(page1.body.entries[0].createdAt >= page2.body.entries[0].createdAt).toBe(true);

    const filtered = await coord.get('/api/system/audit?entityType=issue&action=delete');
    expect(filtered.body.entries.every((e: any) => e.entityType === 'issue' && e.action === 'delete')).toBe(true);
    expect(filtered.body.entries[0].userName).toBe(testUsers.leadA.name);

    expect((await coord.get('/api/system/audit?limit=abc')).status).toBe(400);
  });
});
