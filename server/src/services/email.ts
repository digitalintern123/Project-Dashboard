import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db/database.js';
import { ENCRYPTED_SETTING_KEYS, decryptSecret, encryptSecret, isEncrypted } from '../utils/secrets.js';

export type EmailProvider = 'smtp' | 'microsoft_graph';

export interface EmailLogEntry {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  templateType: string;
  projectId: string | null;
  status: 'sent' | 'failed' | 'outbox';
  htmlContent: string;
  error: string | null;
  createdAt: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
}

export interface MicrosoftGraphConfig {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  senderEmail?: string;
  saveToSentItems?: boolean;
}

/**
 * Retrieve the active email provider ('smtp' or 'microsoft_graph').
 * Defaults to 'smtp' (compatible with Outlook.com and Office 365).
 */
export function getActiveEmailProvider(): EmailProvider {
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('email_provider') as { value: string } | undefined;
    if (row && (row.value === 'smtp' || row.value === 'microsoft_graph')) {
      return row.value as EmailProvider;
    }
  } catch {}
  return 'smtp';
}

/**
 * Set the active email provider ('smtp' or 'microsoft_graph').
 */
export function saveActiveEmailProvider(provider: EmailProvider): void {
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('email_provider', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(provider);
}

/**
 * Retrieve SMTP configuration from system_settings table, falling back to environment variables.
 * Default settings pre-configured for Outlook.com / Office 365 (smtp-mail.outlook.com:587 STARTTLS).
 */
export function getSmtpConfig(): SmtpConfig {
  const getSetting = (key: string): string | undefined => {
    try {
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : undefined;
    } catch {
      return undefined;
    }
  };

  const host = getSetting('smtp_host') || process.env.SMTP_HOST || 'smtp-mail.outlook.com';
  const portStr = getSetting('smtp_port') || process.env.SMTP_PORT || '587';
  const secureStr = getSetting('smtp_secure') || process.env.SMTP_SECURE || 'false';
  const user = getSetting('smtp_user') || process.env.SMTP_USER || '';
  const pass = decryptSecret(getSetting('smtp_pass')) || process.env.SMTP_PASS || '';
  const fromName = getSetting('smtp_from_name') || process.env.SMTP_FROM_NAME || 'Encalm Project Dashboard';
  const fromEmail = getSetting('smtp_from_email') || process.env.SMTP_FROM_EMAIL || user || 'notifications@encalm.com';

  return {
    host: host.trim(),
    port: parseInt(portStr, 10) || 587,
    secure: secureStr === 'true' || secureStr === '1',
    user: user.trim(),
    pass: pass.trim(),
    fromName: fromName.trim(),
    fromEmail: fromEmail.trim(),
  };
}

/**
 * Save SMTP configuration into SQLite system_settings table.
 */
export function saveSmtpConfig(config: Partial<SmtpConfig>): void {
  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const tx = db.transaction(() => {
    if (config.host !== undefined) upsert.run('smtp_host', config.host);
    if (config.port !== undefined) upsert.run('smtp_port', String(config.port));
    if (config.secure !== undefined) upsert.run('smtp_secure', String(config.secure));
    if (config.user !== undefined) upsert.run('smtp_user', config.user);
    if (config.pass !== undefined && config.pass !== '••••••••') {
      upsert.run('smtp_pass', config.pass ? encryptSecret(config.pass) : '');
    }
    if (config.fromName !== undefined) upsert.run('smtp_from_name', config.fromName);
    if (config.fromEmail !== undefined) upsert.run('smtp_from_email', config.fromEmail);
  });

  tx();
}

/**
 * Shared helper to create an IPv4-enforced nodemailer Transporter.
 * Resolves SMTP host to IPv4 using dns.promises.resolve4 to prevent
 * "connect ENETUNREACH" errors caused by nodemailer picking unreachable IPv6 addresses for smtp.office365.com.
 * Sets tls.servername to original host for SNI / TLS certificate validation.
 * Sets tls.rejectUnauthorized to true (allowing false only when env SMTP_ALLOW_SELF_SIGNED=true).
 * Sets requireTLS to true when not using port 465.
 * Preserves standard connection and socket timeouts.
 */
async function createSmtpTransporter(smtpCfg: SmtpConfig): Promise<Transporter> {
  const originalHost = smtpCfg.host;
  let resolvedHost = originalHost;

  try {
    const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(originalHost);
    if (!isIpv4) {
      const addresses = await dns.promises.resolve4(originalHost);
      if (addresses && addresses.length > 0) {
        resolvedHost = addresses[0];
      }
    }
  } catch (err: any) {
    console.warn(`[SMTP DNS] Failed to resolve IPv4 for ${originalHost}, falling back to hostname:`, err.message);
    resolvedHost = originalHost;
  }

  const isImplicitTls = smtpCfg.secure || smtpCfg.port === 465;
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === 'true';

  return nodemailer.createTransport({
    host: resolvedHost,
    port: smtpCfg.port,
    secure: isImplicitTls,
    requireTLS: !isImplicitTls,
    auth: {
      user: smtpCfg.user,
      pass: smtpCfg.pass,
    },
    tls: {
      servername: originalHost,
      rejectUnauthorized: !allowSelfSigned,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

// In-memory token cache for Microsoft Graph OAuth 2.0
let cachedToken: {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
} | null = null;

/**
 * Retrieve Microsoft Graph API configuration from system_settings table, falling back to environment variables.
 */
export function getGraphConfig(): MicrosoftGraphConfig {
  const getSetting = (key: string): string | undefined => {
    try {
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : undefined;
    } catch {
      return undefined;
    }
  };

  const tenantId = getSetting('graph_tenant_id') || process.env.AZURE_TENANT_ID || process.env.MS_GRAPH_TENANT_ID || '';
  const clientId = getSetting('graph_client_id') || process.env.AZURE_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID || '';
  const clientSecret = decryptSecret(getSetting('graph_client_secret')) || process.env.AZURE_CLIENT_SECRET || process.env.MS_GRAPH_CLIENT_SECRET || '';
  const senderEmail = getSetting('graph_sender_email') || process.env.MS_GRAPH_SENDER_EMAIL || 'notifications@encalm.com';
  const saveToSentItemsStr = getSetting('graph_save_to_sent_items') || 'true';

  return {
    tenantId: tenantId.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    senderEmail: senderEmail.trim(),
    saveToSentItems: saveToSentItemsStr === 'true' || saveToSentItemsStr === '1',
  };
}

/**
 * Save Microsoft Graph API configuration into SQLite system_settings table.
 */
export function saveGraphConfig(config: Partial<MicrosoftGraphConfig>): void {
  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const tx = db.transaction(() => {
    if (config.tenantId !== undefined) upsert.run('graph_tenant_id', config.tenantId);
    if (config.clientId !== undefined) upsert.run('graph_client_id', config.clientId);
    if (config.clientSecret !== undefined && config.clientSecret !== '••••••••') {
      upsert.run('graph_client_secret', config.clientSecret ? encryptSecret(config.clientSecret) : '');
    }
    if (config.senderEmail !== undefined) upsert.run('graph_sender_email', config.senderEmail);
    if (config.saveToSentItems !== undefined) upsert.run('graph_save_to_sent_items', String(config.saveToSentItems));
  });

  tx();
  // Clear cached token if credentials change
  cachedToken = null;
}

/**
 * Acquire Microsoft Graph OAuth 2.0 Access Token using Client Credentials Flow.
 * Endpoint: https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
 */
export async function acquireGraphAccessToken(cfg: MicrosoftGraphConfig): Promise<string> {
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) {
    throw new Error('Microsoft Graph API is not fully configured (missing Tenant ID, Client ID, or Client Secret)');
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.accessToken;
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`;
  const bodyParams = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Azure AD OAuth error (${res.status}): ${errorBody}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.accessToken;
}

export interface SendEmailOptions {
  to: string;
  recipientName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  templateType: 'tag_notification' | 'critical_issue' | 'milestone_approval' | 'project_summary' | 'test_email';
  projectId?: string;
}

/**
 * Core email dispatcher supporting both standard SMTP (Outlook.com, Office 365, Custom)
 * and Microsoft Graph API (Azure AD OAuth).
 * Automatically falls back to SQLite in-app Outbox if credentials are not yet configured or during development.
 * Never throws unhandled errors to calling controllers; logs delivery status into SQLite.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{
  id: string;
  status: 'sent' | 'failed' | 'outbox';
  error?: string;
}> {
  const emailId = `eml-${randomUUID()}`;
  const provider = getActiveEmailProvider();

  // Provider 1: Standard SMTP (Outlook.com / Office 365 / Custom SMTP)
  if (provider === 'smtp') {
    const smtpCfg = getSmtpConfig();
    const isConfigured = Boolean(smtpCfg.host && smtpCfg.user && smtpCfg.pass);

    // If SMTP is not configured, store in outbox for review
    if (!isConfigured) {
      try {
        db.prepare(`
          INSERT INTO email_logs (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'outbox', ?, 'SMTP not configured - Queued in in-app outbox', datetime('now'))
        `).run(
          emailId,
          options.to,
          options.recipientName || null,
          options.subject,
          options.templateType,
          options.projectId || null,
          options.html
        );
        console.log(`[Email Outbox] Queued email "${options.subject}" to ${options.to} (SMTP not configured)`);
        return { id: emailId, status: 'outbox', error: 'SMTP not configured' };
      } catch (err: any) {
        console.error('[Email Outbox Save Error]', err);
        return { id: emailId, status: 'outbox', error: err.message };
      }
    }

    // Attempt real SMTP dispatch via nodemailer
    try {
      const transporter = await createSmtpTransporter(smtpCfg);

      // Address objects let nodemailer quote display names safely.
      const fromAddress = { name: smtpCfg.fromName || '', address: smtpCfg.fromEmail || smtpCfg.user };

      await transporter.sendMail({
        from: fromAddress,
        to: { name: options.recipientName || '', address: options.to },
        replyTo: options.replyTo,
        subject: options.subject,
        html: options.html,
      });

      db.prepare(`
        INSERT INTO email_logs (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, null, datetime('now'))
      `).run(
        emailId,
        options.to,
        options.recipientName || null,
        options.subject,
        options.templateType,
        options.projectId || null,
        options.html
      );

      console.log(`[SMTP Email Sent] Delivered "${options.subject}" to ${options.to} via ${smtpCfg.host}:${smtpCfg.port}`);
      return { id: emailId, status: 'sent' };
    } catch (error: any) {
      const errorMsg = error?.message || 'SMTP delivery failed';
      console.warn(`[SMTP Email Failed] Could not deliver to ${options.to}:`, errorMsg);

      db.prepare(`
        INSERT INTO email_logs (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?, datetime('now'))
      `).run(
        emailId,
        options.to,
        options.recipientName || null,
        options.subject,
        options.templateType,
        options.projectId || null,
        options.html,
        errorMsg
      );

      return { id: emailId, status: 'failed', error: errorMsg };
    }
  }

  // Provider 2: Microsoft Graph API (Azure AD OAuth 2.0)
  const cfg = getGraphConfig();

  // If Microsoft Graph is not configured, store directly in outbox for review
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret || !cfg.senderEmail) {
    try {
      db.prepare(`
        INSERT INTO email_logs (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'outbox', ?, 'Microsoft Graph API not configured - Queued in in-app outbox', datetime('now'))
      `).run(
        emailId,
        options.to,
        options.recipientName || null,
        options.subject,
        options.templateType,
        options.projectId || null,
        options.html
      );
      console.log(`[Email Outbox] Queued email "${options.subject}" to ${options.to}`);
      return { id: emailId, status: 'outbox', error: 'Microsoft Graph API not configured' };
    } catch (err: any) {
      console.error('[Email Outbox Save Error]', err);
      return { id: emailId, status: 'outbox', error: err.message };
    }
  }

  // Attempt real Microsoft Graph API dispatch
  try {
    const accessToken = await acquireGraphAccessToken(cfg);

    const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.senderEmail)}/sendMail`;
    const messagePayload = {
      message: {
        subject: options.subject,
        body: {
          contentType: 'HTML',
          content: options.html,
        },
        toRecipients: [
          {
            emailAddress: {
              address: options.to,
              name: options.recipientName || options.to,
            },
          },
        ],
        ...(options.replyTo
          ? {
              replyTo: [
                {
                  emailAddress: {
                    address: options.replyTo,
                  },
                },
              ],
            }
          : {}),
      },
      saveToSentItems: cfg.saveToSentItems !== false,
    };

    const graphRes = await fetch(sendEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!graphRes.ok && graphRes.status !== 202) {
      const errText = await graphRes.text().catch(() => '');
      throw new Error(`Microsoft Graph API failed (${graphRes.status}): ${errText}`);
    }

    db.prepare(`
      INSERT INTO email_logs (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, null, datetime('now'))
    `).run(
      emailId,
      options.to,
      options.recipientName || null,
      options.subject,
      options.templateType,
      options.projectId || null,
      options.html
    );

    console.log(`[Microsoft Graph Email Sent] Delivered "${options.subject}" to ${options.to}`);
    return { id: emailId, status: 'sent' };
  } catch (error: any) {
    const errorMsg = error?.message || 'Microsoft Graph API delivery failed';
    console.warn(`[Microsoft Graph Email Failed] Could not deliver to ${options.to}:`, errorMsg);

    db.prepare(`
      INSERT INTO email_logs (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?, datetime('now'))
    `).run(
      emailId,
      options.to,
      options.recipientName || null,
      options.subject,
      options.templateType,
      options.projectId || null,
      options.html,
      errorMsg
    );

    return { id: emailId, status: 'failed', error: errorMsg };
  }
}

/**
 * Resend an email from the log table using the active provider (SMTP or Microsoft Graph)
 */
export async function resendEmailLog(id: string): Promise<{ success: boolean; status: string; error?: string }> {
  const row = db.prepare('SELECT * FROM email_logs WHERE id = ?').get(id) as any;
  if (!row) {
    return { success: false, status: 'not_found', error: 'Email record not found' };
  }

  const provider = getActiveEmailProvider();

  if (provider === 'smtp') {
    const smtpCfg = getSmtpConfig();
    if (!smtpCfg.host || !smtpCfg.user || !smtpCfg.pass) {
      return { success: false, status: 'outbox', error: 'SMTP is not yet configured' };
    }

    try {
      const transporter = await createSmtpTransporter(smtpCfg);

      // Address objects let nodemailer quote display names safely.
      const fromAddress = { name: smtpCfg.fromName || '', address: smtpCfg.fromEmail || smtpCfg.user };

      await transporter.sendMail({
        from: fromAddress,
        to: { name: row.recipient_name || '', address: row.recipient_email },
        subject: row.subject,
        html: row.html_content,
      });

      db.prepare("UPDATE email_logs SET status = 'sent', error = null WHERE id = ?").run(id);
      return { success: true, status: 'sent' };
    } catch (err: any) {
      const errorMsg = err.message || 'SMTP resend failed';
      db.prepare("UPDATE email_logs SET status = 'failed', error = ? WHERE id = ?").run(errorMsg, id);
      return { success: false, status: 'failed', error: errorMsg };
    }
  }

  // Provider: Microsoft Graph API
  const cfg = getGraphConfig();
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret || !cfg.senderEmail) {
    return { success: false, status: 'outbox', error: 'Microsoft Graph API is not yet configured' };
  }

  try {
    const accessToken = await acquireGraphAccessToken(cfg);

    const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.senderEmail)}/sendMail`;
    const messagePayload = {
      message: {
        subject: row.subject,
        body: {
          contentType: 'HTML',
          content: row.html_content,
        },
        toRecipients: [
          {
            emailAddress: {
              address: row.recipient_email,
              name: row.recipient_name || row.recipient_email,
            },
          },
        ],
      },
      saveToSentItems: cfg.saveToSentItems !== false,
    };

    const graphRes = await fetch(sendEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!graphRes.ok && graphRes.status !== 202) {
      const errText = await graphRes.text().catch(() => '');
      throw new Error(`Microsoft Graph API resend failed (${graphRes.status}): ${errText}`);
    }

    db.prepare("UPDATE email_logs SET status = 'sent', error = null WHERE id = ?").run(id);
    return { success: true, status: 'sent' };
  } catch (err: any) {
    const errorMsg = err.message || 'Resend failed';
    db.prepare("UPDATE email_logs SET status = 'failed', error = ? WHERE id = ?").run(errorMsg, id);
    return { success: false, status: 'failed', error: errorMsg };
  }
}

/* ========================================================================= */
/*                          Branded HTML Templates                           */
/* ========================================================================= */

/** One-off migration: encrypts any secret still stored in plaintext. */
export function encryptPlaintextSettings(): void {
  const update = db.prepare("UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?");
  let migrated = 0;
  for (const key of ENCRYPTED_SETTING_KEYS) {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row?.value && !isEncrypted(row.value)) {
      update.run(encryptSecret(row.value), key);
      migrated++;
    }
  }
  if (migrated > 0) console.log(`✓ Encrypted ${migrated} stored email secret(s) at rest.`);
}

/** Escapes text for safe use in HTML element content and quoted attributes. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseEmailWrapper(contentHtml: string, previewText: string = 'Encalm Projects Notification'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(previewText)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f7f5ef;
      color: #1a202c;
    }
    .wrapper {
      max-width: 600px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2ddd3;
      box-shadow: 0 4px 20px rgba(23, 62, 73, 0.06);
    }
    .header {
      background: #173e49;
      padding: 24px 32px;
      border-bottom: 3px solid #d19b35;
    }
    .brand {
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-sub {
      color: #d19b35;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .body-content {
      padding: 32px;
      font-size: 14px;
      line-height: 1.6;
      color: #2d3748;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-gold { background: #fdf3d8; color: #9a711f; border: 1px solid #eadcb1; }
    .badge-teal { background: #edf5f0; color: #2e7c67; border: 1px solid #cbe4d9; }
    .badge-red { background: #fae5e1; color: #b2473d; border: 1px solid #f3c2bc; }
    .card-box {
      background: #faf8f2;
      border: 1px solid #e8e3d5;
      border-radius: 8px;
      padding: 18px;
      margin: 20px 0;
    }
    .btn {
      display: inline-block;
      background: #2e7c67;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 16px;
    }
    .footer {
      background: #faf8f2;
      padding: 20px 32px;
      border-top: 1px solid #e8e3d5;
      font-size: 11px;
      color: #718096;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">ENCALM HOSPITALITY</div>
      <div class="brand-sub">Project Dashboard</div>
    </div>
    <div class="body-content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">This is an automated notification from the <strong>Encalm Project Dashboard</strong>.</p>
      <p style="margin: 0;">Encalm Hospitality Private Limited • Airport Lounges, Transit Hotels & F&B Operations</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Template 1: User Tag & Comment Notification (Self-Contained Executive Email)
 */
export function buildTagNotificationHtml(data: {
  recipientName: string;
  taggedByName: string;
  senderEmail?: string;
  entityType: 'Task' | 'Stage' | 'Milestone' | 'Issue' | 'Update' | 'General';
  entityTitle: string;
  entityContext?: string;
  comment?: string;
  projectName: string;
  projectCode?: string;
  projectLocation?: string;
  currentStage?: string;
  targetDate?: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(`
    <div style="margin-bottom: 20px;">
      <p style="font-size: 16px; font-weight: 700; color: #173e49; margin: 0 0 6px 0;">
        Hello ${esc(data.recipientName)},
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #2d3748;">
        <strong>${esc(data.taggedByName)}</strong> from the Project Delivery Team has tagged you on a <strong>${esc(data.entityType)}</strong> in:
      </p>
      <p style="margin: 6px 0 0 0; font-size: 17px; font-weight: 800; color: #173e49;">
        ${esc(data.projectName)} ${data.projectCode ? `<span style="font-size: 12px; font-weight: 600; color: #2e7c67; background: #edf5f0; padding: 2px 7px; border-radius: 4px; margin-left: 6px; border: 1px solid #cbe4d9;">${esc(data.projectCode)}</span>` : ''}
      </p>
    </div>

    <!-- Executive Project Context Grid -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; background: #faf8f3; border: 1px solid #e8e3d5; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
      <tbody>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600; width: 35%;">Facility / Location:</td>
          <td style="padding: 10px 14px; color: #173e49; font-weight: 700;">${esc(data.projectLocation || 'Encalm Airport Facility')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Current Project Stage:</td>
          <td style="padding: 10px 14px; color: #2e7c67; font-weight: 700;">${esc(data.currentStage || 'Active Delivery')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Tagged Item (${esc(data.entityType)}):</td>
          <td style="padding: 10px 14px; color: #173e49; font-weight: 700;">${esc(data.entityTitle)}</td>
        </tr>
        ${data.targetDate || data.entityContext ? `
        <tr>
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Timeline / Target Date:</td>
          <td style="padding: 10px 14px; color: #d19b35; font-weight: 700;">${esc(data.targetDate || data.entityContext)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- Prominently Highlighted Comment / Action Required Card -->
    ${data.comment ? `
      <div style="background: #fffdf5; border: 2px solid #d19b35; border-radius: 10px; padding: 18px 20px; margin: 22px 0; box-shadow: 0 2px 8px rgba(209, 155, 53, 0.08);">
        <div style="margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #8c671b; text-transform: uppercase; letter-spacing: 0.8px;">
            🚨 ACTION REQUIRED / COMMENT FROM ${esc(data.taggedByName.toUpperCase())}:
          </span>
        </div>
        <div style="font-size: 15px; font-weight: 600; color: #173e49; line-height: 1.6; white-space: pre-wrap;">
          "${esc(data.comment).replace(/@([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)?)/g, '<span style="color: #2e7c67; font-weight: 700; background: #edf5f0; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbe4d9;">@$1</span>')}"
        </div>
      </div>
    ` : ''}

    <!-- Zero-Login Reply Banner -->
    <div style="background: #edf5f0; border: 1.5px solid #2e7c67; border-radius: 8px; padding: 16px 18px; margin: 22px 0; text-align: left;">
      <div style="font-size: 13.5px; font-weight: 700; color: #173e49; margin-bottom: 4px;">
        ✉️ Zero-Login Required — Simply Hit "Reply" in Outlook
      </div>
      <div style="font-size: 12.5px; color: #235445; line-height: 1.5;">
        You do not need to create an account or log into the dashboard. When you reply directly to this email in Outlook, your response will be delivered straight to <strong>${esc(data.taggedByName)}</strong> at <a href="mailto:${esc(data.senderEmail || 'chinmay.saxena@encalm.com')}" style="color: #173e49; font-weight: 700;">${esc(data.senderEmail || 'chinmay.saxena@encalm.com')}</a>.
      </div>
    </div>

    <!-- Optional Dashboard Link -->
    <div style="text-align: center; margin-top: 18px;">
      <a href="${esc(data.dashboardUrl)}" style="color: #718096; font-size: 12px; text-decoration: underline;" target="_blank">
        (Optional) Open Project Workspace in Dashboard →
      </a>
    </div>
  `, `Action Required in ${esc(data.projectName)}: ${esc(data.entityTitle)}`);
}

/**
 * Template 2: Critical Issue Alert
 */
export function buildCriticalIssueHtml(data: {
  recipientName: string;
  issueTitle: string;
  severity: string;
  category?: string;
  detail: string;
  projectName: string;
  raisedBy?: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(`
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
      <span class="badge badge-red">CRITICAL ISSUE ALERT</span>
      <span class="badge badge-gold">${esc(data.projectName)}</span>
    </div>

    <p style="font-size: 16px; font-weight: 700; color: #b2473d; margin-top: 0;">
      Attention ${esc(data.recipientName)},
    </p>
    <p>
      A high-severity issue requiring immediate leadership oversight has been logged on <strong>${esc(data.projectName)}</strong>.
    </p>

    <div class="card-box" style="border-left: 4px solid #b2473d;">
      <div style="font-size: 15px; font-weight: 700; color: #173e49; margin-bottom: 6px;">
        ${esc(data.issueTitle)}
      </div>
      <div style="font-size: 12px; color: #718096; margin-bottom: 12px;">
        Severity: <strong style="color: #b2473d;">${esc(data.severity)}</strong> &nbsp;•&nbsp; 
        Category: <strong>${esc(data.category || 'General')}</strong>
        ${data.raisedBy ? ` &nbsp;•&nbsp; Raised by: <strong>${esc(data.raisedBy)}</strong>` : ''}
      </div>
      <p style="margin: 0; font-size: 13px; color: #2d3748; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2ddd3;">
        ${esc(data.detail)}
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" style="background: #b2473d;" target="_blank">Review Critical Issue →</a>
    </div>
  `, `Critical Issue Alert: ${esc(data.projectName)}`);
}

/**
 * Template 3: Milestone Approval Required
 */
export function buildMilestoneApprovalHtml(data: {
  recipientName: string;
  milestoneTitle: string;
  targetDate: string;
  stage?: string;
  projectName: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(`
    <p style="font-size: 16px; font-weight: 700; color: #173e49; margin-top: 0;">
      Dear ${esc(data.recipientName)},
    </p>
    <p>
      A milestone requiring governance sign-off on <strong>${esc(data.projectName)}</strong> is waiting for review.
    </p>

    <div class="card-box">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #718096; margin-bottom: 6px;">
        Milestone Pending Approval
      </div>
      <div style="font-size: 16px; font-weight: 700; color: #173e49; margin-bottom: 8px;">
        ${esc(data.milestoneTitle)}
      </div>
      <div style="font-size: 12px; color: #4a5568;">
        Target Date: <strong>${esc(data.targetDate)}</strong> 
        ${data.stage ? `&nbsp;•&nbsp; Stage: <strong>${esc(data.stage)}</strong>` : ''}
      </div>
    </div>

    <p>As Project Coordinator, please log in to approve or reject this milestone milestone request.</p>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" target="_blank">Review & Sign Off Milestone →</a>
    </div>
  `, `Milestone Approval: ${esc(data.milestoneTitle)}`);
}

/**
 * Template 4: Executive Project Summary
 */
export function buildProjectSummaryHtml(data: {
  recipientName: string;
  projectName: string;
  senderName: string;
  progress: number;
  health: string;
  status: string;
  customNote?: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(`
    <p style="font-size: 16px; font-weight: 700; color: #173e49; margin-top: 0;">
      Hello ${esc(data.recipientName)},
    </p>
    <p>
      <strong>${esc(data.senderName)}</strong> has shared an executive project status update for <strong>${esc(data.projectName)}</strong>.
    </p>

    <div class="card-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 16px; font-weight: 700; color: #173e49;">${esc(data.projectName)}</span>
        <span class="badge badge-teal">${esc(data.status)}</span>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0;">
        <tr>
          <td style="padding: 6px 0; color: #718096;">Progress:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #2e7c67;">${esc(data.progress)}% Completed</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #718096;">Health:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right;">${esc(data.health)}</td>
        </tr>
      </table>

      ${data.customNote ? `
        <div style="margin-top: 12px; padding: 12px; background: #ffffff; border-radius: 6px; border: 1px solid #e2ddd3;">
          <div style="font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; margin-bottom: 4px;">Executive Note:</div>
          <div style="font-size: 13px; color: #2d3748; white-space: pre-wrap;">${esc(data.customNote)}</div>
        </div>
      ` : ''}
    </div>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" target="_blank">Open Project in Dashboard →</a>
    </div>
  `, `Project Update: ${esc(data.projectName)}`);
}

/**
 * Template 5: SMTP Test Email
 */
export function buildTestEmailHtml(recipientName: string): string {
  return baseEmailWrapper(`
    <p style="font-size: 16px; font-weight: 700; color: #2e7c67; margin-top: 0;">
      ✓ SMTP Integration Connected Successfully!
    </p>
    <p>
      Hello <strong>${esc(recipientName)}</strong>,
    </p>
    <p>
      This is a test notification confirming that the Encalm Project Dashboard email service is operational and properly authenticated with your SMTP server.
    </p>

    <div class="card-box" style="border-left: 4px solid #2e7c67;">
      <div style="font-size: 13px; color: #2d3748;">
        <strong>Configuration Status:</strong> Active & Verified<br />
        <strong>Timestamp:</strong> ${new Date().toUTCString()}
      </div>
    </div>
  `, 'Encalm Project Dashboard SMTP Test Email');
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  department?: string;
  initials: string;
}

/**
 * Searches the Encalm corporate directory via Microsoft Graph API.
 * Uses User.Read.All permission to fetch live employees.
 */
export async function searchEncalmDirectory(searchQuery: string = ''): Promise<DirectoryUser[]> {
  const cfg = getGraphConfig();
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) {
    return [];
  }

  try {
    const accessToken = await acquireGraphAccessToken(cfg);
    const cleanQuery = searchQuery.trim().replace(/['"]/g, '');

    let url = 'https://graph.microsoft.com/v1.0/users?$top=30&$select=id,displayName,mail,userPrincipalName,jobTitle,department';
    if (cleanQuery) {
      url += `&$filter=startswith(displayName,'${encodeURIComponent(cleanQuery)}') or startswith(mail,'${encodeURIComponent(cleanQuery)}') or startswith(userPrincipalName,'${encodeURIComponent(cleanQuery)}')`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Microsoft Graph Directory] Query failed (${res.status}): ${errText}`);
      return [];
    }

    const data = (await res.json()) as { value?: any[] };
    const items = data.value || [];

    // Fetch local user accounts to map any directory users sharing the same email to canonical IDs
    const localUsers = db.prepare('SELECT id, name, email, role, title, initials FROM users').all() as Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      title: string;
      initials: string;
    }>;

    return items
      .filter((u) => u.displayName && (u.mail || u.userPrincipalName))
      .map((u) => {
        const email = (u.mail || u.userPrincipalName || '').toLowerCase().trim();
        const name = (u.displayName || '').trim();
        const parts = name.split(/\s+/);
        const initials = (
          (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')
        ).toUpperCase() || 'U';

        // Check if user already exists as a local account
        const matchedLocal = localUsers.find(
          (lu) => lu.email && lu.email.toLowerCase() === email
        );

        let role = matchedLocal ? matchedLocal.role : 'stakeholder';
        const titleLower = (u.jobTitle || '').toLowerCase();
        if (!matchedLocal) {
          if (titleLower.includes('hod') || titleLower.includes('head')) role = 'hod';
          else if (titleLower.includes('lead') || titleLower.includes('manager')) role = 'lead';
          else if (titleLower.includes('coordinator')) role = 'coordinator';
        }

        const finalId = matchedLocal ? matchedLocal.id : `azure-${u.id}`;
        const finalTitle = matchedLocal ? matchedLocal.title : (u.jobTitle || u.department || 'Encalm Team');
        const finalInitials = matchedLocal ? matchedLocal.initials : initials;

        // Auto-register directory users in SQLite database so tag chips and queries resolve reliably
        try {
          db.prepare(`
            INSERT INTO users (id, name, email, password_hash, role, title, initials, created_at)
            VALUES (?, ?, ?, '', ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              email = excluded.email,
              title = excluded.title,
              initials = excluded.initials
          `).run(finalId, name, email, role, finalTitle, finalInitials);
        } catch {
          // Ignore conflict / insertion errors
        }

        return {
          id: finalId,
          name: matchedLocal ? matchedLocal.name : name,
          email,
          role,
          title: finalTitle,
          department: u.department || undefined,
          initials: finalInitials,
        };
      });
  } catch (err: any) {
    console.error('[Microsoft Graph Directory Error]', err.message);
    return [];
  }
}

