import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';
import { processEmailQueue } from '../src/services/email.js';

const app = makeApp();
let coord: any;
let lead: any;

beforeAll(async () => {
  insertProject('proj-e', 'u-lead-a');
  insertProject('proj-b', 'u-lead-b');
  coord = await loginAs(app, 'coordinator');
  lead = await loginAs(app, 'leadA');
});

describe('email settings and outbox (no provider configured)', () => {
  it('reports Microsoft 365 only as connected or not: no Azure IDs or secrets leave the server', async () => {
    process.env.MS_GRAPH_TENANT_ID = 'tenant-should-not-leak';
    process.env.MS_GRAPH_CLIENT_ID = 'client-should-not-leak';
    process.env.MS_GRAPH_CLIENT_SECRET = 'secret-should-not-leak';
    process.env.MS_GRAPH_SENDER_EMAIL = 'notify@test.local';
    try {
      const res = await coord.get('/api/email/settings');
      expect(res.status).toBe(200);
      expect(res.body.settings).toMatchObject({
        provider: 'microsoft_graph',
        graph: { isConfigured: true, sendAsDomains: ['test.local'] },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/should-not-leak|notify@test\.local/);
    } finally {
      for (const k of ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER_EMAIL'])
        delete process.env[k];
    }
    const res = await coord.get('/api/email/settings');
    expect(res.body.settings).toMatchObject({ provider: 'outbox', graph: { isConfigured: false } });
    expect(res.body.settings.smtp.pass).toBe('');
  });

  it('refuses Azure credentials, a From address or a provider sent from the browser', async () => {
    for (const body of [
      { graph: { tenantId: 't', clientSecret: 's', senderEmail: 'boss@test.local' } },
      { senderEmail: 'boss@test.local' },
      { provider: 'microsoft_graph' },
      { smtp: { fromEmail: 'boss@test.local' } },
    ]) {
      expect((await coord.post('/api/email/settings').send(body)).status).toBe(400);
    }
  });

  it('sends the test email from and to the signed-in coordinator only, keeping it in the outbox', async () => {
    expect((await coord.post('/api/email/test').send({ to: 'someone@test.local' })).status).toBe(400);
    const res = await coord.post('/api/email/test').send({});
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('outbox');
    const row = db.prepare('SELECT * FROM email_logs WHERE id = ?').get(res.body.result.id) as any;
    expect(row).toMatchObject({
      recipient_email: testUsers.coordinator.email,
      from_email: testUsers.coordinator.email,
      template_type: 'test_email',
      status: 'outbox',
    });
  });

  it('filters logs by project', async () => {
    await lead.post('/api/email/send-project-update').send({
      projectId: 'proj-e',
      recipients: ['boss@test.local', { email: 'cfo@test.local', name: 'CFO' }],
      customNote: 'On track',
    });
    const logs = await coord.get('/api/email/logs?projectId=proj-e');
    expect(logs.body.logs).toHaveLength(2);
    expect(logs.body.logs.every((l: any) => l.projectId === 'proj-e')).toBe(true);
  });

  it('re-queues an email for resend; without a provider the worker returns it to the outbox', async () => {
    const id = (db.prepare("SELECT id FROM email_logs WHERE status = 'outbox' LIMIT 1").get() as { id: string }).id;
    const res = await coord.post(`/api/email/resend/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: 'queued' });
    await processEmailQueue();
    expect((db.prepare('SELECT status FROM email_logs WHERE id = ?').get(id) as any).status).toBe('outbox');
    const missing = await coord.post('/api/email/resend/nope');
    expect(missing.body.success).toBe(false);
  });

  it('queues project emails and answers before delivery', async () => {
    const res = await lead
      .post('/api/email/send-project-update')
      .send({ projectId: 'proj-e', recipients: ['q@test.local'] });
    expect(res.body.results[0].status).toBe('queued');
    expect(
      (db.prepare("SELECT status FROM email_logs WHERE recipient_email = 'q@test.local'").get() as any).status,
    ).toBe('queued');
    await processEmailQueue();
    expect(
      (db.prepare("SELECT status FROM email_logs WHERE recipient_email = 'q@test.local'").get() as any).status,
    ).toBe('outbox');
  });
});

describe('POST /api/email/send-project-update', () => {
  it('sends as the signed-in user, ignoring any sender in the request', async () => {
    const res = await lead.post('/api/email/send-project-update').send({
      projectId: 'proj-e',
      recipients: ['a@test.local'],
      from: 'ceo@test.local',
      sender: { email: 'ceo@test.local', name: 'CEO' },
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    const row = db.prepare("SELECT * FROM email_logs WHERE recipient_email = 'a@test.local'").get() as any;
    expect(row.html_content).toContain(testUsers.leadA.name);
    expect(row).toMatchObject({
      from_email: testUsers.leadA.email,
      from_name: testUsers.leadA.name,
      reply_to: testUsers.leadA.email,
    });
  });

  it("refuses a lead on someone else's project", async () => {
    const res = await lead
      .post('/api/email/send-project-update')
      .send({ projectId: 'proj-b', recipients: ['a@test.local'] });
    expect(res.status).toBe(403);
  });

  it('404s for unknown projects', async () => {
    expect(
      (await lead.post('/api/email/send-project-update').send({ projectId: 'nope', recipients: ['a@test.local'] }))
        .status,
    ).toBe(404);
  });
});

describe('POST /api/email/tag-and-comment', () => {
  it('emails exactly the people picked, never others who share their name', async () => {
    const add = db.prepare(
      "INSERT OR IGNORE INTO users (id, name, email, role, title, initials) VALUES (?, 'Akash Kumar', ?, 'stakeholder', 'S', 'AK')",
    );
    add.run('u-akash-1', 'akash.kumar@test.local');
    add.run('u-akash-2', 'akash.k2@test.local');
    db.prepare(
      "INSERT OR IGNORE INTO users (id, name, email, role, title, initials) VALUES ('u-akash-3', 'Akash', 'akash@test.local', 'stakeholder', 'S', 'A')",
    ).run();

    const res = await lead.post('/api/email/tag-and-comment').send({
      projectId: 'proj-e',
      entityType: 'Issue',
      entityTitle: 'Leak',
      taggedUserIds: ['u-akash-2'],
      comment: 'Please review @Akash Kumar and @Akash',
    });
    expect(res.status).toBe(200);
    expect(res.body.recipients.map((r: any) => r.userId)).toEqual(['u-akash-2']);
    const rows = db
      .prepare("SELECT recipient_email, from_email, reply_to FROM email_logs WHERE recipient_email LIKE 'akash%'")
      .all();
    expect(rows).toEqual([
      { recipient_email: 'akash.k2@test.local', from_email: testUsers.leadA.email, reply_to: testUsers.leadA.email },
    ]);

    const feed = await lead.get('/api/projects/proj-e/updates');
    expect(feed.body.updates[0].text).toContain('Please review');
  });

  it('rejects people who do not exist', async () => {
    const res = await lead.post('/api/email/tag-and-comment').send({ projectId: 'proj-e', taggedUserIds: ['u-ghost'] });
    expect(res.status).toBe(400);
  });

  it('lets coordinators and HODs tag on any project, and leads only on their own', async () => {
    const hod = await loginAs(app, 'hod');
    const body = { projectId: 'proj-b', taggedUserIds: ['u-coord'] };
    expect((await coord.post('/api/email/tag-and-comment').send(body)).status).toBe(200);
    expect((await hod.post('/api/email/tag-and-comment').send(body)).status).toBe(200);
    expect((await lead.post('/api/email/tag-and-comment').send(body)).status).toBe(403);
    expect((await lead.post('/api/email/tag-and-comment').send({ ...body, projectId: 'proj-e' })).status).toBe(200);

    const inbox = await (await loginAs(app, 'coordinator')).get('/api/notifications');
    expect(inbox.body.notifications[0].title).toMatch(/^Tagged on/);
  });

  it('accepts explicit user ids and skips users without email', async () => {
    db.prepare(
      "INSERT OR IGNORE INTO users (id, name, role, title, initials) VALUES ('u-noemail', 'No Mail', 'stakeholder', 'S', 'NM')",
    ).run();
    const res = await lead
      .post('/api/email/tag-and-comment')
      .send({ projectId: 'proj-e', taggedUserIds: ['u-noemail'] });
    expect(res.body.recipients[0].status).toBe('skipped');
  });

  it('requires at least one recipient and an existing project', async () => {
    expect(
      (await lead.post('/api/email/tag-and-comment').send({ projectId: 'proj-e', comment: 'no mentions here' })).status,
    ).toBe(400);
    expect(
      (await lead.post('/api/email/tag-and-comment').send({ projectId: 'nope', taggedUserIds: ['u-hod'] })).status,
    ).toBe(404);
  });
});

describe('GET /api/email/directory', () => {
  it('returns an empty list when Microsoft Graph is not configured', async () => {
    const res = await lead.get('/api/email/directory?q=hal');
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });
});
