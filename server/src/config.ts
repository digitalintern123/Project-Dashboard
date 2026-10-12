import { parseSettingsKey } from './utils/secrets.js';

/**
 * Startup configuration checks. In production the server refuses to start with
 * an unsafe JWT secret instead of running with one anyone can read in the repo.
 */

export const KNOWN_DEFAULT_JWT_SECRETS = [
  'encalm-secret-jwt-key-2026',
  'encalm-secure-prod-jwt-key-change-me',
  'replace-with-a-strong-random-secret-key-32-chars-minimum',
  'changeme',
  'secret',
];

export const MIN_JWT_SECRET_LENGTH = 32;

/** Returns a list of fatal configuration problems for the given environment. */
export function productionConfigErrors(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const errors: string[] = [];
  const secret = env.JWT_SECRET;
  if (!secret) {
    errors.push('JWT_SECRET is not set.');
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`);
  } else if (KNOWN_DEFAULT_JWT_SECRETS.includes(secret)) {
    errors.push('JWT_SECRET is set to a known default value.');
  }
  if (!parseSettingsKey(env.SETTINGS_ENCRYPTION_KEY)) {
    errors.push('SETTINGS_ENCRYPTION_KEY must be 32 random bytes, base64 or hex encoded (openssl rand -base64 32).');
  }
  return errors;
}

/** Exits the process if production configuration is unsafe. */
export function assertProductionConfig(): void {
  const errors = productionConfigErrors();
  if (errors.length > 0) {
    for (const e of errors) console.error(`[Config] FATAL: ${e}`);
    console.error('[Config] Generate secrets with: openssl rand -base64 48 (JWT_SECRET), openssl rand -base64 32 (SETTINGS_ENCRYPTION_KEY)');
    process.exit(1);
  }
}

/** Parses a positive integer environment variable, falling back to a default. */
export function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Base URL used in links inside emails. APP_BASE_URL wins; otherwise the URL the
 * request was served on. A client-supplied Origin header is only trusted when it
 * matches that URL (or is localhost in development), so a caller cannot make the
 * server email links that point at another site.
 */
export function publicBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const served = `${req.protocol}://${req.get('host')}`;
  const origin = req.get('origin');
  if (origin && process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return served;
}
