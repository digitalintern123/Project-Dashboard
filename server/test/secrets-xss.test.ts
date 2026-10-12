import { describe, expect, it } from 'vitest';
import { makeApp, loginAs } from './helpers.js';
import { db } from '../src/db/database.js';
import { decryptSecret, encryptSecret, isEncrypted } from '../src/utils/secrets.js';
import {
  buildCriticalIssueHtml,
  buildProjectSummaryHtml,
  buildTagNotificationHtml,
  encryptPlaintextSettings,
  getSmtpConfig,
} from '../src/services/email.js';
import { publicBaseUrl } from '../src/config.js';

const app = makeApp();
const XSS = '<img src=x onerror="alert(1)">';

describe('settings encryption (AES-256-GCM)', () => {
  it('round-trips, uses a fresh IV each time, and rejects tampering', () => {
    const a = encryptSecret('smtp-password-1');
    const b = encryptSecret('smtp-password-1');
    expect(a).not.toBe(b);
    expect(isEncrypted(a)).toBe(true);
    expect(decryptSecret(a)).toBe('smtp-password-1');

    const parts = a.split(':');
    parts[4] = Buffer.from('tampered').toString('base64');
    expect(decryptSecret(parts.join(':'))).toBe('');
  });

  it('stores secrets saved through the API encrypted, and never returns them', async () => {
    const coord = await loginAs(app, 'coordinator');
    const res = await coord.post('/api/email/settings').send({
      provider: 'smtp',
      smtp: { host: 'smtp.office365.com', port: 587, user: 'notify@test.local', pass: 'Sup3r-secret' },
      graph: { tenantId: 't', clientId: 'c', clientSecret: 'graph-secret-value', senderEmail: 'notify@test.local' },
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Sup3r-secret');
    expect(JSON.stringify(res.body)).not.toContain('graph-secret-value');

    const raw = (key: string) =>
      (db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string }).value;
    expect(isEncrypted(raw('smtp_pass'))).toBe(true);
    expect(isEncrypted(raw('graph_client_secret'))).toBe(true);
    expect(getSmtpConfig().pass).toBe('Sup3r-secret');

    // Sending back the masked placeholder keeps the stored secret.
    await coord.post('/api/email/settings').send({ smtp: { pass: '••••••••' } });
    expect(getSmtpConfig().pass).toBe('Sup3r-secret');
  });

  it('encrypts legacy plaintext values in place', () => {
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_pass', 'legacy-plain')").run();
    encryptPlaintextSettings();
    const raw = (db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_pass'").get() as { value: string })
      .value;
    expect(isEncrypted(raw)).toBe(true);
    expect(getSmtpConfig().pass).toBe('legacy-plain');
  });
});

describe('email templates escape user content', () => {
  it('escapes titles, comments and notes', () => {
    const tag = buildTagNotificationHtml({
      recipientName: XSS,
      taggedByName: 'Lee',
      entityType: 'Issue',
      entityTitle: XSS,
      comment: `please check @Lee ${XSS}`,
      projectName: XSS,
      dashboardUrl: 'https://projects.encalm.com/project/x" onmouseover="alert(1)',
    });
    const issue = buildCriticalIssueHtml({
      recipientName: 'R',
      issueTitle: XSS,
      severity: 'High',
      detail: XSS,
      projectName: 'P',
      dashboardUrl: 'https://x',
    });
    const summary = buildProjectSummaryHtml({
      recipientName: 'R',
      projectName: 'P',
      senderName: XSS,
      progress: 5,
      health: 'On track',
      status: 'In Design',
      customNote: XSS,
      dashboardUrl: 'https://x',
    });

    for (const html of [tag, issue, summary]) {
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    }
    expect(tag).not.toContain('" onmouseover="');
    // @mention highlighting still works on escaped text.
    expect(tag).toContain('>@Lee</span>');
  });
});

describe('links in emails', () => {
  const fakeReq = (headers: Record<string, string>) => ({
    protocol: 'https',
    get: (name: string) => headers[name.toLowerCase()],
  });

  it('ignores a spoofed Origin header', () => {
    delete process.env.APP_BASE_URL;
    expect(publicBaseUrl(fakeReq({ host: 'projects.encalm.com', origin: 'https://evil.example' }))).toBe(
      'https://projects.encalm.com',
    );
  });

  it('prefers APP_BASE_URL when configured', () => {
    process.env.APP_BASE_URL = 'https://projects.encalm.com/';
    expect(publicBaseUrl(fakeReq({ host: 'internal:5000' }))).toBe('https://projects.encalm.com');
    delete process.env.APP_BASE_URL;
  });
});
