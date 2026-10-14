import { settingsRepo } from '../../repositories/settings.repo.js';
import { ENCRYPTED_SETTING_KEYS, decryptSecret, encryptSecret, isEncrypted } from '../../utils/secrets.js';
import type { EmailProvider, MicrosoftGraphConfig, SmtpConfig } from './types.js';
import { logger } from '../../logger.js';

/** What the settings form sends back for a secret it never saw. */
const MASK = '••••••••';
const DEFAULT_SENDER = 'notifications@encalm.com';

/**
 * SMTP configuration from system_settings, falling back to environment variables.
 * Defaults suit Outlook.com / Office 365 (smtp-mail.outlook.com:587 STARTTLS).
 * Mail is always sent from the SMTP account itself: there is no separate,
 * editable "From" address that could name someone else.
 */
export function getSmtpConfig(): SmtpConfig {
  const get = settingsRepo.get;
  const host = get('smtp_host') || process.env.SMTP_HOST || 'smtp-mail.outlook.com';
  const portStr = get('smtp_port') || process.env.SMTP_PORT || '587';
  const secureStr = get('smtp_secure') || process.env.SMTP_SECURE || 'false';
  const user = get('smtp_user') || process.env.SMTP_USER || '';
  const pass = decryptSecret(get('smtp_pass')) || process.env.SMTP_PASS || '';
  const fromName = get('smtp_from_name') || process.env.SMTP_FROM_NAME || 'Encalm Project Dashboard';

  return {
    host: host.trim(),
    port: parseInt(portStr, 10) || 587,
    secure: secureStr === 'true' || secureStr === '1',
    user: user.trim(),
    pass: pass.trim(),
    fromName: fromName.trim(),
  };
}

export const isSmtpConfigured = (smtp: SmtpConfig = getSmtpConfig()) => Boolean(smtp.host && smtp.user && smtp.pass);

/** Saves the given SMTP fields; a masked password leaves the stored one unchanged. */
export function saveSmtpConfig(config: Partial<SmtpConfig>): void {
  const entries: Array<[string, string]> = [];
  if (config.host !== undefined) entries.push(['smtp_host', config.host]);
  if (config.port !== undefined) entries.push(['smtp_port', String(config.port)]);
  if (config.secure !== undefined) entries.push(['smtp_secure', String(config.secure)]);
  if (config.user !== undefined) entries.push(['smtp_user', config.user]);
  if (config.pass !== undefined && config.pass !== MASK) {
    entries.push(['smtp_pass', config.pass ? encryptSecret(config.pass) : '']);
  }
  if (config.fromName !== undefined) entries.push(['smtp_from_name', config.fromName]);
  settingsRepo.setMany(entries);
}

const domainOf = (email: string) => email.split('@')[1]?.trim().toLowerCase() || '';

/**
 * Microsoft Graph (Azure AD) configuration. Read from the server's environment
 * only, never from the database or the browser, so nobody using the app can
 * see the credentials or point them at another mailbox.
 */
export function getGraphConfig(env: NodeJS.ProcessEnv = process.env): MicrosoftGraphConfig {
  const tenantId = (env.MS_GRAPH_TENANT_ID || env.AZURE_TENANT_ID || '').trim();
  const clientId = (env.MS_GRAPH_CLIENT_ID || env.AZURE_CLIENT_ID || '').trim();
  const clientSecret = (env.MS_GRAPH_CLIENT_SECRET || env.AZURE_CLIENT_SECRET || '').trim();
  const senderEmail = (env.MS_GRAPH_SENDER_EMAIL || DEFAULT_SENDER).trim();
  const listed = (env.MS_GRAPH_SEND_AS_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  return {
    tenantId,
    clientId,
    clientSecret,
    senderEmail,
    sendAsDomains: listed.length ? listed : [domainOf(senderEmail)].filter(Boolean),
  };
}

export const isGraphConfigured = (cfg: MicrosoftGraphConfig = getGraphConfig()) =>
  Boolean(cfg.tenantId && cfg.clientId && cfg.clientSecret && cfg.senderEmail);

/**
 * The provider in use, chosen automatically: Microsoft 365 when the server is
 * configured for it, else SMTP, else 'outbox' (emails wait in the in-app outbox).
 */
export function getActiveEmailProvider(): EmailProvider | 'outbox' {
  if (isGraphConfigured()) return 'microsoft_graph';
  if (isSmtpConfigured()) return 'smtp';
  return 'outbox';
}

/** One-off migration: encrypts any secret still stored in plaintext. */
export function encryptPlaintextSettings(): void {
  let migrated = 0;
  for (const key of ENCRYPTED_SETTING_KEYS) {
    const value = settingsRepo.get(key);
    if (value && !isEncrypted(value)) {
      settingsRepo.set(key, encryptSecret(value));
      migrated++;
    }
  }
  if (migrated > 0) logger.info(`✓ Encrypted ${migrated} stored email secret(s) at rest.`);
}

export type EmailSettingsInput = { smtp?: Partial<SmtpConfig> };

/** Applies a settings form submission. Only SMTP can be changed from the app. */
export function applyEmailSettings(input: EmailSettingsInput): void {
  if (input.smtp) saveSmtpConfig(input.smtp);
}

/**
 * The settings for the settings form. Microsoft 365 is reported only as
 * connected or not: no IDs, secrets or mailboxes leave the server.
 */
export function describeEmailSettings() {
  const smtp = getSmtpConfig();
  const graph = getGraphConfig();
  return {
    provider: getActiveEmailProvider(),
    graph: { isConfigured: isGraphConfigured(graph), sendAsDomains: graph.sendAsDomains },
    smtp: {
      host: smtp.host || 'smtp-mail.outlook.com',
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      user: smtp.user || '',
      pass: smtp.pass ? MASK : '',
      fromName: smtp.fromName || 'Encalm Project Dashboard',
      isConfigured: isSmtpConfigured(smtp),
    },
  };
}
