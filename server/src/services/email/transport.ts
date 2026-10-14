import dns from 'node:dns';
import nodemailer, { type Transporter } from 'nodemailer';
import { getGraphConfig, getSmtpConfig, isGraphConfigured, isSmtpConfigured } from './settings.js';
import type { EmailSender, MicrosoftGraphConfig, SmtpConfig } from './types.js';
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
  /** The signed-in user the email is sent as (from the queue, never from a request). */
  sender?: EmailSender | null;
  subject: string;
  html: string;
};

/** Display name used when an email goes out from a shared mailbox on someone's behalf. */
export const onBehalfName = (sender: EmailSender) => `${sender.name} via Encalm Projects`;

/**
 * The mailbox Graph sends from: the sender's own mailbox when their address is
 * in one of the allowed domains, otherwise the system mailbox.
 */
export function resolveGraphSender(sender: EmailSender | null | undefined, cfg: MicrosoftGraphConfig): string {
  const own = sender?.email.trim().toLowerCase();
  const domain = own?.split('@')[1];
  if (own && domain && (cfg.sendAsDomains ?? []).includes(domain)) return own;
  return cfg.senderEmail!;
}

/** Graph answers these when a user has no usable mailbox (not licensed, not found). */
const NO_MAILBOX = /ErrorInvalidUser|MailboxNotEnabledForRESTAPI|ResourceNotFound|ErrorItemNotFound/;

async function graphSend(cfg: MicrosoftGraphConfig, mailbox: string, message: OutgoingMessage) {
  const accessToken = await acquireGraphAccessToken(cfg);
  const system = mailbox.toLowerCase() === cfg.senderEmail!.toLowerCase();
  const replyTo = message.replyTo || (system ? message.sender?.email : undefined);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: { contentType: 'HTML', content: message.html },
        toRecipients: [{ emailAddress: { address: message.to, name: message.recipientName || message.to } }],
        ...(system && message.sender
          ? { from: { emailAddress: { address: mailbox, name: onBehalfName(message.sender) } } }
          : {}),
        ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
      },
      // The email appears in the sender's own Outlook "Sent Items".
      saveToSentItems: true,
    }),
  });
  if (res.ok || res.status === 202) return { ok: true as const };
  const errText = await res.text().catch(() => '');
  return { ok: false as const, status: res.status, errText };
}

/**
 * Delivers one message through the active provider. Throws on failure.
 * The sender is always the person recorded with the email: with Microsoft 365
 * it goes from their own mailbox; otherwise from the shared account as
 * "<name> via Encalm Projects", with replies going to them.
 */
export async function deliver(message: OutgoingMessage): Promise<void> {
  const cfg = getGraphConfig();
  if (isGraphConfigured(cfg)) {
    const mailbox = resolveGraphSender(message.sender, cfg);
    let result = await graphSend(cfg, mailbox, message);
    if (!result.ok && mailbox !== cfg.senderEmail && (result.status === 404 || NO_MAILBOX.test(result.errText))) {
      logger.warn(`[Email] ${mailbox} has no usable mailbox; sending through ${cfg.senderEmail} instead`);
      result = await graphSend(cfg, cfg.senderEmail!, message);
    }
    if (!result.ok) throw new Error(`Microsoft Graph API failed (${result.status}): ${result.errText}`);
    return;
  }

  const smtpCfg = getSmtpConfig();
  if (!isSmtpConfigured(smtpCfg)) {
    throw new EmailNotConfiguredError('No email provider configured - kept in the in-app outbox');
  }
  const transporter = await createSmtpTransporter(smtpCfg);
  // Address objects let nodemailer quote display names safely.
  await transporter.sendMail({
    from: {
      name: message.sender ? onBehalfName(message.sender) : smtpCfg.fromName || '',
      address: smtpCfg.user,
    },
    to: { name: message.recipientName || '', address: message.to },
    replyTo: message.replyTo || message.sender?.email || undefined,
    subject: message.subject,
    html: message.html,
  });
}
