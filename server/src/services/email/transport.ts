import dns from 'node:dns';
import nodemailer, { type Transporter } from 'nodemailer';
import { getActiveEmailProvider, getGraphConfig, getSmtpConfig } from './settings.js';
import type { MicrosoftGraphConfig, SmtpConfig } from './types.js';
import { logger } from '../../logger.js';

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
  } catch (err) {
    logger.warn({ err }, `[SMTP DNS] Failed to resolve IPv4 for ${originalHost}, falling back to hostname`);
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

/** Forgets the cached Graph token, e.g. after the credentials change. */
export function clearGraphTokenCache(): void {
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

export class EmailNotConfiguredError extends Error {}

export type OutgoingMessage = {
  to: string;
  recipientName?: string | null;
  replyTo?: string | null;
  subject: string;
  html: string;
};

/** Delivers one message through the active provider. Throws on failure. */
export async function deliver(message: OutgoingMessage): Promise<void> {
  if (getActiveEmailProvider() === 'smtp') {
    const smtpCfg = getSmtpConfig();
    if (!smtpCfg.host || !smtpCfg.user || !smtpCfg.pass) {
      throw new EmailNotConfiguredError('SMTP not configured - kept in the in-app outbox');
    }
    const transporter = await createSmtpTransporter(smtpCfg);
    // Address objects let nodemailer quote display names safely.
    await transporter.sendMail({
      from: { name: smtpCfg.fromName || '', address: smtpCfg.fromEmail || smtpCfg.user },
      to: { name: message.recipientName || '', address: message.to },
      replyTo: message.replyTo || undefined,
      subject: message.subject,
      html: message.html,
    });
    return;
  }

  const cfg = getGraphConfig();
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret || !cfg.senderEmail) {
    throw new EmailNotConfiguredError('Microsoft Graph API not configured - kept in the in-app outbox');
  }
  const accessToken = await acquireGraphAccessToken(cfg);
  const graphRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.senderEmail)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: 'HTML', content: message.html },
          toRecipients: [{ emailAddress: { address: message.to, name: message.recipientName || message.to } }],
          ...(message.replyTo ? { replyTo: [{ emailAddress: { address: message.replyTo } }] } : {}),
        },
        saveToSentItems: cfg.saveToSentItems !== false,
      }),
    },
  );
  if (!graphRes.ok && graphRes.status !== 202) {
    const errText = await graphRes.text().catch(() => '');
    throw new Error(`Microsoft Graph API failed (${graphRes.status}): ${errText}`);
  }
}
