import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';
import { processEmailQueue } from '../src/services/email.js';

const app = makeApp();
let coord: any;
let lead: any;

beforeAll(async () => {
  insertProject('proj-e', 'u-lead-a');
  coord = await loginAs(app, 'coordinator');
  lead = await loginAs(app, 'leadA');
});

describe('email settings and outbox (no provider configured)', () => {
  it('returns default settings with secrets masked', async () => {
    const res = await coord.get('/api/email/settings');
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ provider: 'smtp', isConfigured: false });
    expect(res.body.settings.smtp.pass).toBe('');
  });

  it('switches provider and saves legacy flat Graph fields', async () => {
    const res = await coord.post('/api/email/settings').send({
      provider: 'microsoft_graph',
      tenantId: 'tenant',
      clientId: 'client',
      senderEmail: 'notify@test.local',
      saveToSentItems: false,
    });
    expect(res.body.settings).toMatchObject({
      provider: 'microsoft_graph',
      tenantId: 'tenant',
      saveToSentItems: false,
      isConfigured: false,
    });
    await coord.post('/api/email/settings').send({ provider: 'smtp' });
  });

  it('queues a test email in the outbox and lists it', async () => {
    const res = await coord.post('/api/email/test').send({ to: 'someone@test.local', recipientName: 'Someone' });
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('outbox');
    const logs = await coord.get('/api/email/logs?limit=5');
    expect(logs.body.logs[0]).toMatchObject({
      recipientEmail: 'someone@test.local',
      status: 'outbox',
      templateType: 'test_email',
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
  it('sends a summary with the signed-in user as reply-to', async () => {
    const res = await lead
      .post('/api/email/send-project-update')
      .send({ projectId: 'proj-e', recipients: ['a@test.local'] });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    const html = (db.prepare("SELECT html_content FROM email_logs WHERE recipient_email = 'a@test.local'").get() as any)
      .html_content;
    expect(html).toContain(testUsers.leadA.name);
  });

  it('404s for unknown projects', async () => {
    expect(
      (await lead.post('/api/email/send-project-update').send({ projectId: 'nope', recipients: ['a@test.local'] }))
        .status,
    ).toBe(404);
  });
});

describe('POST /api/email/tag-and-comment', () => {
  it('resolves @mentions by full name, email and unique first name, notifies and logs the comment', async () => {
    db.prepare("UPDATE users SET name = 'Hal Odonnell' WHERE id = 'u-hod'").run();
    const res = await lead.post('/api/email/tag-and-comment').send({
      projectId: 'proj-e',
      entityType: 'Issue',
      entityTitle: 'Leak',
      comment: 'Please review @Hal Odonnell and @lead.b@test.local, also @Cora',
    });
    expect(res.status).toBe(200);
    const tagged = res.body.recipients.map((r: any) => r.userId).sort();
    expect(tagged).toEqual(['u-coord', 'u-hod', 'u-lead-b']);

    const hod = await loginAs(app, 'hod');
    const inbox = await hod.get('/api/notifications');
    expect(inbox.body.notifications[0].title).toBe('Tagged on Issue: Leak');

    const feed = await lead.get('/api/projects/proj-e/updates');
    expect(feed.body.updates[0].text).toContain('Please review');
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
