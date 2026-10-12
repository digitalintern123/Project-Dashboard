import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake SMTP transport and DNS so no network is touched.
const sendMail = vi.fn();
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));
vi.mock('node:dns', async (orig) => {
  const real = (await orig()) as any;
  return { default: { ...real.default, promises: { resolve4: vi.fn(async () => ['192.0.2.10']) } } };
});

import nodemailer from 'nodemailer';
import { setupTestDb } from './helpers.js';
import { db } from '../src/db/database.js';
import {
  EMAIL_MAX_ATTEMPTS,
  EMAIL_RETRY_BASE_MS,
  acquireGraphAccessToken,
  processEmailQueue,
  queueEmail,
  resendEmailLog,
  saveActiveEmailProvider,
  saveGraphConfig,
  saveSmtpConfig,
  searchEncalmDirectory,
  sendEmailNow,
  startEmailWorker,
  stopEmailWorker,
} from '../src/services/email.js';

beforeAll(() => setupTestDb());
beforeEach(() => {
  db.prepare('DELETE FROM email_queue').run();
});
afterEach(() => {
  sendMail.mockReset();
  vi.unstubAllGlobals();
  stopEmailWorker();
});

const log = (id: string) => db.prepare('SELECT status, error, reply_to FROM email_logs WHERE id = ?').get(id) as any;
const queued = (id: string) => db.prepare('SELECT * FROM email_queue WHERE log_id = ?').get(id) as any;
const mail = {
  to: 'r@test.local',
  recipientName: 'R',
  subject: 'S',
  html: '<p>x</p>',
  templateType: 'test_email' as const,
  replyTo: 'lead@test.local',
};

describe('queueing', () => {
  it('returns immediately with a queued log entry, without contacting the provider', () => {
    const res = queueEmail(mail);
    expect(res.status).toBe('queued');
    expect(log(res.id)).toMatchObject({ status: 'queued', reply_to: 'lead@test.local' });
    expect(queued(res.id).attempts).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('keeps emails in the outbox when no provider is configured', async () => {
    saveActiveEmailProvider('smtp');
    saveSmtpConfig({ host: '', user: '', pass: '' });
    const { id } = queueEmail(mail);
    await processEmailQueue();
    expect(log(id).status).toBe('outbox');
    expect(queued(id)).toBeUndefined();
  });
});

describe('SMTP delivery through the queue', () => {
  beforeAll(() => {
    saveActiveEmailProvider('smtp');
    saveSmtpConfig({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      user: 'notify@test.local',
      pass: 'pw',
      fromName: 'Encalm',
      fromEmail: 'notify@test.local',
    });
  });

  it('delivers through the IPv4-resolved host with TLS and SNI', async () => {
    sendMail.mockResolvedValueOnce({ messageId: 'm1' });
    const { id } = queueEmail(mail);
    expect(await processEmailQueue()).toBe(1);
    expect(log(id)).toMatchObject({ status: 'sent', error: null });
    expect(queued(id)).toBeUndefined();
    const opts = (nodemailer.createTransport as any).mock.calls.at(-1)[0];
    expect(opts).toMatchObject({
      host: '192.0.2.10',
      port: 587,
      requireTLS: true,
      tls: { servername: 'smtp.office365.com', rejectUnauthorized: true },
    });
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: { name: 'R', address: 'r@test.local' },
      replyTo: 'lead@test.local',
    });
  });

  it('retries with exponential backoff, then gives up after the maximum attempts', async () => {
    sendMail.mockRejectedValue(new Error('421 try later'));
    const { id } = queueEmail(mail);
    let now = Date.now();
    const delays: number[] = [];

    for (let attempt = 1; attempt < EMAIL_MAX_ATTEMPTS; attempt++) {
      await processEmailQueue(now);
      const row = queued(id);
      expect(row.attempts).toBe(attempt);
      expect(log(id).status).toBe('queued');
      const next = new Date(row.next_attempt_at).getTime();
      delays.push(next - now);
      // Not due yet: nothing happens.
      expect(await processEmailQueue(next - 1000)).toBe(0);
      now = next;
    }
    expect(delays).toEqual([1, 2, 4, 8].map((m) => m * EMAIL_RETRY_BASE_MS));

    await processEmailQueue(now);
    expect(log(id)).toMatchObject({ status: 'failed', error: '421 try later' });
    expect(queued(id)).toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(EMAIL_MAX_ATTEMPTS);
  });

  it('succeeds on a later attempt', async () => {
    sendMail.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({});
    const { id } = queueEmail(mail);
    await processEmailQueue();
    await processEmailQueue(Date.now() + EMAIL_RETRY_BASE_MS + 1000);
    expect(log(id).status).toBe('sent');
  });

  it('requeues a failed email for resend', async () => {
    sendMail.mockRejectedValueOnce(new Error('down'));
    const { id } = queueEmail(mail, 1);
    await processEmailQueue();
    expect(log(id).status).toBe('failed');

    expect(resendEmailLog(id)).toEqual({ success: true, status: 'queued' });
    expect(resendEmailLog(id)).toEqual({ success: true, status: 'queued' }); // already queued
    sendMail.mockResolvedValueOnce({});
    await processEmailQueue();
    expect(log(id).status).toBe('sent');
    expect(resendEmailLog('nope').status).toBe('not_found');
  });

  it('sends the settings test email immediately, without retries', async () => {
    sendMail.mockRejectedValueOnce(new Error('535 auth failed'));
    const res = await sendEmailNow(mail);
    expect(res).toMatchObject({ status: 'failed', error: '535 auth failed' });
    expect(queued(res.id)).toBeUndefined();
  });

  it('does not deliver the same email twice when processing overlaps', async () => {
    let release!: () => void;
    sendMail.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    queueEmail(mail);
    const first = processEmailQueue();
    const second = processEmailQueue();
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('the worker delivers new emails on its own and recovers interrupted ones', async () => {
    sendMail.mockResolvedValue({});
    const { id: stale } = queueEmail(mail);
    db.prepare('UPDATE email_queue SET locked_until = ? WHERE log_id = ?').run(
      new Date(Date.now() + 3_600_000).toISOString(),
      stale,
    );
    startEmailWorker(50);
    const { id } = queueEmail(mail);
    await vi.waitFor(() => {
      expect(log(id).status).toBe('sent');
      expect(log(stale).status).toBe('sent');
    });
  });
});

describe('Microsoft Graph provider', () => {
  beforeAll(() => {
    saveActiveEmailProvider('microsoft_graph');
    saveGraphConfig({
      tenantId: 'tenant',
      clientId: 'client',
      clientSecret: 'secret',
      senderEmail: 'notify@test.local',
      saveToSentItems: true,
    });
  });

  function graphFetch(sendStatus = 202) {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/oauth2/v2.0/token')) {
        return new Response(JSON.stringify({ access_token: 'token-123', expires_in: 3600 }), { status: 200 });
      }
      return new Response('', { status: sendStatus });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('gets a token once and sends via sendMail with reply-to', async () => {
    const fetchMock = graphFetch();
    const a = queueEmail(mail);
    const b = queueEmail(mail);
    await processEmailQueue();
    expect(log(a.id).status).toBe('sent');
    expect(log(b.id).status).toBe('sent');
    const sendCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/sendMail'))!;
    expect(String(sendCall[0])).toContain('/users/notify%40test.local/sendMail');
    expect((sendCall[1] as any).headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse((sendCall[1] as any).body).message.replyTo[0].emailAddress.address).toBe('lead@test.local');
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/token'))).toHaveLength(1);
  });

  it('retries Graph errors', async () => {
    graphFetch(500);
    const { id } = queueEmail(mail);
    await processEmailQueue();
    expect(queued(id).attempts).toBe(1);
    expect(log(id).error).toContain('500');
  });

  it('reports token errors from Azure AD', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad secret', { status: 401 })),
    );
    saveGraphConfig({ clientSecret: 'rotated' }); // clears the cached token
    await expect(acquireGraphAccessToken({ tenantId: 't', clientId: 'c', clientSecret: 's' })).rejects.toThrow(/401/);
    await expect(acquireGraphAccessToken({ tenantId: '', clientId: 'c', clientSecret: 's' })).rejects.toThrow(
      /not fully configured/,
    );
  });

  it('searches the directory, maps users and registers them locally', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/token'))
          return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
        return new Response(
          JSON.stringify({
            value: [
              {
                id: 'g1',
                displayName: 'Asha Rao',
                mail: 'asha.rao@test.local',
                jobTitle: 'Project Lead',
                department: 'Projects',
              },
              { id: 'g2', displayName: 'No Mail', mail: null, userPrincipalName: null },
            ],
          }),
          { status: 200 },
        );
      }),
    );
    saveGraphConfig({ clientSecret: 'secret' });
    const users = await searchEncalmDirectory('asha');
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ name: 'Asha Rao', email: 'asha.rao@test.local', initials: 'AR' });
    expect(db.prepare("SELECT 1 FROM users WHERE email = 'asha.rao@test.local'").get()).toBeTruthy();
  });

  it('returns no directory users when Graph errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/token')
          ? new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
          : new Response('nope', { status: 403 }),
      ),
    );
    expect(await searchEncalmDirectory('x')).toEqual([]);
  });
});
