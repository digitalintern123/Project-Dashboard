import crypto from 'node:crypto';

/**
 * AES-256-GCM encryption for secrets stored in system_settings (SMTP password,
 * Microsoft Graph client secret). The key comes from SETTINGS_ENCRYPTION_KEY:
 * 32 random bytes, base64 or hex encoded (openssl rand -base64 32).
 *
 * Stored format: enc:v1:<iv>:<auth tag>:<ciphertext>, each part base64.
 */

const PREFIX = 'enc:v1:';
const DEV_KEY_SEED = 'encalm-development-settings-key';

/** system_settings keys whose values are encrypted at rest. */
export const ENCRYPTED_SETTING_KEYS = ['smtp_pass', 'graph_client_secret'];

let warnedDevKey = false;

/** Parses SETTINGS_ENCRYPTION_KEY; returns null if it is missing or malformed. */
export function parseSettingsKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 ? decoded : null;
}

function settingsKey(): Buffer {
  const key = parseSettingsKey(process.env.SETTINGS_ENCRYPTION_KEY);
  if (key) return key;
  // Production refuses to start without a valid key (config.ts), so this is dev/test only.
  if (!warnedDevKey) {
    warnedDevKey = true;
    console.warn('[Secrets] SETTINGS_ENCRYPTION_KEY not set; using a development-only key.');
  }
  return crypto.createHash('sha256').update(DEV_KEY_SEED).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', settingsKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a stored value. Legacy plaintext values are returned as-is (they are
 * encrypted at startup). A value that cannot be decrypted, e.g. after the key
 * changed, yields '' so the secret must be re-entered rather than crashing.
 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return '';
  if (!isEncrypted(stored)) return stored;
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', settingsKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    console.error(
      '[Secrets] Could not decrypt a stored secret. Was SETTINGS_ENCRYPTION_KEY changed? Re-enter it in Email settings.',
    );
    return '';
  }
}
