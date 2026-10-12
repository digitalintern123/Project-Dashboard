import { settingsRepo } from '../../repositories/settings.repo.js';
import { ENCRYPTED_SETTING_KEYS, decryptSecret, encryptSecret, isEncrypted } from '../../utils/secrets.js';
import { clearGraphTokenCache } from './transport.js';
import type { EmailProvider, MicrosoftGraphConfig, SmtpConfig } from './types.js';
import { logger } from '../../logger.js';

/** What the settings form sends back for a secret it never saw. */
const MASK = '••••••••';
const DEFAULT_SENDER = 'notifications@encalm.com';

/**
 * Retrieve the active email provider ('smtp' or 'microsoft_graph').
 * Defaults to 'smtp' (compatible with Outlook.com and Office 365).
 */
export function getActiveEmailProvider(): EmailProvider {
  const value = settingsRepo.get('email_provider');
  return value === 'microsoft_graph' ? 'microsoft_graph' : 'smtp';
}

export function saveActiveEmailProvider(provider: EmailProvider): void {
  settingsRepo.set('email_provider', provider);
}

/**
 * SMTP configuration from system_settings, falling back to environment variables.
 * Defaults suit Outlook.com / Office 365 (smtp-mail.outlook.com:587 STARTTLS).
 */
export function getSmtpConfig(): SmtpConfig {
  const get = settingsRepo.get;
  const host = get('smtp_host') || process.env.SMTP_HOST || 'smtp-mail.outlook.com';
  const portStr = get('smtp_port') || process.env.SMTP_PORT || '587';
  const secureStr = get('smtp_secure') || process.env.SMTP_SECURE || 'false';
  const user = get('smtp_user') || process.env.SMTP_USER || '';
  const pass = decryptSecret(get('smtp_pass')) || process.env.SMTP_PASS || '';
  const fromName = get('smtp_from_name') || process.env.SMTP_FROM_NAME || 'Encalm Project Dashboard';
  const fromEmail = get('smtp_from_email') || process.env.SMTP_FROM_EMAIL || user || DEFAULT_SENDER;

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
  if (config.fromEmail !== undefined) entries.push(['smtp_from_email', config.fromEmail]);
  settingsRepo.setMany(entries);
}

/** Microsoft Graph configuration from system_settings, falling back to environment variables. */
export function getGraphConfig(): MicrosoftGraphConfig {
  const get = settingsRepo.get;
  const env = process.env;
  const tenantId = get('graph_tenant_id') || env.AZURE_TENANT_ID || env.MS_GRAPH_TENANT_ID || '';
  const clientId = get('graph_client_id') || env.AZURE_CLIENT_ID || env.MS_GRAPH_CLIENT_ID || '';
  const clientSecret =
    decryptSecret(get('graph_client_secret')) || env.AZURE_CLIENT_SECRET || env.MS_GRAPH_CLIENT_SECRET || '';
  const senderEmail = get('graph_sender_email') || env.MS_GRAPH_SENDER_EMAIL || DEFAULT_SENDER;
  const saveToSentItems = get('graph_save_to_sent_items') || 'true';

  return {
    tenantId: tenantId.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    senderEmail: senderEmail.trim(),
    saveToSentItems: saveToSentItems === 'true' || saveToSentItems === '1',
  };
}

/** Saves the given Graph fields; a masked secret leaves the stored one unchanged. */
export function saveGraphConfig(config: Partial<MicrosoftGraphConfig>): void {
  const entries: Array<[string, string]> = [];
  if (config.tenantId !== undefined) entries.push(['graph_tenant_id', config.tenantId]);
  if (config.clientId !== undefined) entries.push(['graph_client_id', config.clientId]);
  if (config.clientSecret !== undefined && config.clientSecret !== MASK) {
    entries.push(['graph_client_secret', config.clientSecret ? encryptSecret(config.clientSecret) : '']);
  }
  if (config.senderEmail !== undefined) entries.push(['graph_sender_email', config.senderEmail]);
  if (config.saveToSentItems !== undefined) entries.push(['graph_save_to_sent_items', String(config.saveToSentItems)]);
  settingsRepo.setMany(entries);
  // Credentials may have changed.
  clearGraphTokenCache();
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

export type EmailSettingsInput = {
  provider?: EmailProvider;
  smtp?: Partial<SmtpConfig>;
  graph?: Partial<MicrosoftGraphConfig>;
  // Legacy flat Graph fields
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  senderEmail?: string;
  saveToSentItems?: boolean;
};

/** Applies a settings form submission (SMTP and/or Microsoft Graph). */
export function applyEmailSettings(input: EmailSettingsInput, { legacyGraphFields = true } = {}): void {
  if (input.provider) saveActiveEmailProvider(input.provider);
  if (input.smtp) saveSmtpConfig(input.smtp);

  const graph = legacyGraphFields
    ? {
        tenantId: input.graph?.tenantId ?? input.tenantId,
        clientId: input.graph?.clientId ?? input.clientId,
        clientSecret: input.graph?.clientSecret ?? input.clientSecret,
        senderEmail: input.graph?.senderEmail ?? input.senderEmail,
        saveToSentItems: input.graph?.saveToSentItems ?? input.saveToSentItems,
      }
    : input.graph;
  if (!graph) return;
  if (
    legacyGraphFields &&
    graph.tenantId === undefined &&
    graph.clientId === undefined &&
    graph.clientSecret === undefined &&
    graph.senderEmail === undefined
  ) {
    return;
  }
  saveGraphConfig({ ...graph, saveToSentItems: graph.saveToSentItems ?? true });
}

/** The current settings for the settings form, with every secret masked. */
export function describeEmailSettings() {
  const provider = getActiveEmailProvider();
  const smtp = getSmtpConfig();
  const graph = getGraphConfig();
  const isSmtpConfigured = Boolean(smtp.host && smtp.user && smtp.pass);
  const isGraphConfigured = Boolean(graph.tenantId && graph.clientId && graph.clientSecret && graph.senderEmail);
  const graphView = {
    tenantId: graph.tenantId || '',
    clientId: graph.clientId || '',
    clientSecret: graph.clientSecret ? MASK : '',
    senderEmail: graph.senderEmail || DEFAULT_SENDER,
    saveToSentItems: graph.saveToSentItems !== false,
  };

  return {
    provider,
    smtp: {
      host: smtp.host || 'smtp-mail.outlook.com',
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      user: smtp.user || '',
      pass: smtp.pass ? MASK : '',
      fromName: smtp.fromName || 'Encalm Project Dashboard',
      fromEmail: smtp.fromEmail || smtp.user || DEFAULT_SENDER,
      isConfigured: isSmtpConfigured,
    },
    graph: { ...graphView, isConfigured: isGraphConfigured },
    // Backwards-compatible convenience fields:
    ...graphView,
    isConfigured: provider === 'smtp' ? isSmtpConfigured : isGraphConfigured,
  };
}
