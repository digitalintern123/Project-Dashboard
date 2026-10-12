import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
  acquireGraphAccessToken,
  resendEmailLog,
  saveActiveEmailProvider,
  saveGraphConfig,
  saveSmtpConfig,
  searchEncalmDirectory,
  sendEmail,
} from '../src/services/email.js';

beforeAll(() => setupTestDb());
afterEach(() => {
  sendMail.mockReset();
  vi.unstubAllGlobals();
});

const status = (id: string) => (db.prepare('SELECT status, error FROM email_logs WHERE id = ?').get(id) as any);
const mail = { to: 'r@test.local', recipientName: 'R', subject: 'S', html: '<p>x</p>', templateType: 'test_email' as const, replyTo: 'lead@test.local' };

describe('SMTP provider', () => {
  beforeAll(() => {
    saveActiveEmailProvider('smtp');
    saveSmtpConfig({ host: 'smtp.office365.com', port: 587, secure: false, user: 'notify@test.local', pass: 'pw', fromName: 'Encalm', fromEmail: 'notify@test.local' });
  });

  it('sends through the IPv4-resolved host with TLS and SNI, and logs it as sent', async () => {
    sendMail.mockResolvedValueOnce({ messageId: 'm1' });
    const res = await sendEmail(mail);
    expect(res.status).toBe('sent');
    expect(status(res.id).status).toBe('sent');
    const opts = (nodemailer.createTransport as any).mock.calls.at(-1)[0];
    expect(opts).toMatchObject({ host: '192.0.2.10', port: 587, requireTLS: true, tls: { servername: 'smtp.office365.com', rejectUnauthorized: true } });
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: { name: 'R', address: 'r@test.local' }, replyTo: 'lead@test.local' });
  });

  it('logs failures with the error', async () => {
    sendMail.mockRejectedValueOnce(new Error('535 auth failed'));
    const res = await sendEmail(mail);
    expect(res.status).toBe('failed');
    expect(status(res.id).error).toContain('535');
  });

  it('resends a failed email and marks it sent', async () => {
    sendMail.mockRejectedValueOnce(new Error('timeout'));
    const failed = await sendEmail(mail);
    sendMail.mockResolvedValueOnce({ messageId: 'm2' });
    const res = await resendEmailLog(failed.id);
    expect(res.success).toBe(true);
    expect(status(failed.id).status).toBe('sent');
  });

  it('marks a resend that fails again as failed', async () => {
    sendMail.mockRejectedValueOnce(new Error('timeout'));
    const failed = await sendEmail(mail);
    sendMail.mockRejectedValueOnce(new Error('still down'));
    const res = await resendEmailLog(failed.id);
    expect(res.success).toBe(false);
    expect(status(failed.id).status).toBe('failed');
  });
});

describe('Microsoft Graph provider', () => {
  beforeAll(() => {
    saveActiveEmailProvider('microsoft_graph');
    saveGraphConfig({ tenantId: 'tenant', clientId: 'client', clientSecret: 'secret', senderEmail: 'notify@test.local', saveToSentItems: true });
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

  it('gets a token once and sends via sendMail', async () => {
    const fetchMock = graphFetch();
    const res = await sendEmail(mail);
    expect(res.status).toBe('sent');
    const sendCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/sendMail'))!;
    expect(String(sendCall[0])).toContain('/users/notify%40test.local/sendMail');
    expect((sendCall[1] as any).headers.Authorization).toBe('Bearer token-123');

    await sendEmail(mail);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/token'))).toHaveLength(1);
  });

  it('records Graph errors as failed, and resends', async () => {
    graphFetch(500);
    const res = await sendEmail(mail);
    expect(res.status).toBe('failed');
    graphFetch(202);
    expect((await resendEmailLog(res.id)).success).toBe(true);
  });

  it('reports token errors from Azure AD', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad secret', { status: 401 })));
    saveGraphConfig({ clientSecret: 'rotated' }); // clears the cached token
    await expect(acquireGraphAccessToken({ tenantId: 't', clientId: 'c', clientSecret: 's' })).rejects.toThrow(/401/);
    await expect(acquireGraphAccessToken({ tenantId: '', clientId: 'c', clientSecret: 's' })).rejects.toThrow(/not fully configured/);
  });

  it('searches the directory, maps users and registers them locally', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      return new Response(JSON.stringify({
        value: [
          { id: 'g1', displayName: 'Asha Rao', mail: 'asha.rao@test.local', jobTitle: 'Project Lead', department: 'Projects' },
          { id: 'g2', displayName: 'No Mail', mail: null, userPrincipalName: null },
        ],
      }), { status: 200 });
    }));
    saveGraphConfig({ clientSecret: 'secret' });
    const users = await searchEncalmDirectory('asha');
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ name: 'Asha Rao', email: 'asha.rao@test.local', initials: 'AR' });
    expect(db.prepare("SELECT 1 FROM users WHERE email = 'asha.rao@test.local'").get()).toBeTruthy();
  });

  it('returns no directory users when Graph errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('/token') ? new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 }) : new Response('nope', { status: 403 })));
    expect(await searchEncalmDirectory('x')).toEqual([]);
  });
});
