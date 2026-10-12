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
  return errors;
}

/** Exits the process if production configuration is unsafe. */
export function assertProductionConfig(): void {
  const errors = productionConfigErrors();
  if (errors.length > 0) {
    for (const e of errors) console.error(`[Config] FATAL: ${e}`);
    console.error('[Config] Generate a secret with: openssl rand -base64 48');
    process.exit(1);
  }
}

/** Parses a positive integer environment variable, falling back to a default. */
export function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
