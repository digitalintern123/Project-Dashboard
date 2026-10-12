import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 10;

/** Returns an error message if the password does not meet policy, otherwise null. */
export function checkPasswordPolicy(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > 200) {
    return 'Password must be at most 200 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain both letters and numbers.';
  }
  return null;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string | null | undefined): boolean {
  if (!hash || typeof password !== 'string') return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

/** Random 16-character password that always satisfies the policy. */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  for (;;) {
    const bytes = crypto.randomBytes(16);
    const candidate = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    if (checkPasswordPolicy(candidate) === null) return candidate;
  }
}
