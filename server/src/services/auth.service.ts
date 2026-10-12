import { usersRepo } from '../repositories/users.repo.js';
import type { UserRow } from '../repositories/rows.js';
import { checkPasswordPolicy, generateTemporaryPassword, hashPassword, verifyPassword } from '../utils/passwords.js';
import { revokeAllSessions } from '../utils/session.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError, badRequest, conflict, notFound } from '../utils/http-error.js';
import { logger } from '../logger.js';

// One message for every failure (unknown email, wrong password, locked account)
// so responses do not reveal which accounts exist or are locked.
export const INVALID_CREDENTIALS =
  'Invalid email or password. After repeated failed attempts, sign-in is paused for 15 minutes.';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

// Compared against when the email is unknown so response timing does not
// reveal which accounts exist.
const DUMMY_HASH = hashPassword(generateTemporaryPassword());

export type PublicUser = Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'title' | 'initials'> & {
  mustChangePassword: boolean;
};

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    initials: user.initials,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

/**
 * Checks credentials, applying the per-account lockout. Returns the user on
 * success; throws a generic 401 otherwise. Every outcome is audited.
 */
export function authenticate(email: string, password: string, ip: string | undefined): UserRow {
  const normalizedEmail = email.trim().toLowerCase();
  const user = usersRepo.findLoginByEmail(normalizedEmail);
  const passwordOk = verifyPassword(password, user?.password_hash || DUMMY_HASH);
  const locked = Boolean(user?.locked_until && new Date(user.locked_until).getTime() > Date.now());

  if (!user || locked || !passwordOk) {
    if (user && !locked) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        usersRepo.update(user.id, {
          failed_attempts: 0,
          locked_until: new Date(Date.now() + LOCKOUT_MS).toISOString(),
        });
        logger.warn(
          `[Auth] Account ${normalizedEmail} locked for 15 minutes after ${attempts} failed attempts (ip ${ip})`,
        );
        writeAudit({ userId: user.id, action: 'account_locked', entityType: 'user', entityId: user.id, ip });
      } else {
        usersRepo.update(user.id, { failed_attempts: attempts });
      }
    }
    logger.warn(`[Auth] Failed login for ${normalizedEmail} from ${ip}${locked ? ' (account locked)' : ''}`);
    writeAudit({
      userId: user?.id ?? null,
      action: 'login_failed',
      entityType: 'user',
      entityId: user?.id ?? null,
      after: { email: normalizedEmail, locked },
      ip,
    });
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  if (user.failed_attempts || user.locked_until) {
    usersRepo.update(user.id, { failed_attempts: 0, locked_until: null });
  }
  writeAudit({ userId: user.id, action: 'login', entityType: 'user', entityId: user.id, ip });
  return user;
}

/** Changes the user's own password and ends all their sessions. */
export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ip: string | undefined,
): UserRow {
  const user = usersRepo.find(userId);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) throw badRequest('Current password is incorrect');
  const policyError = checkPasswordPolicy(newPassword);
  if (policyError) throw badRequest(policyError);
  if (newPassword === currentPassword) throw badRequest('New password must be different from the current password');

  usersRepo.update(user.id, { password_hash: hashPassword(newPassword), must_change_password: 0 });
  revokeAllSessions(user.id);
  writeAudit({ userId: user.id, action: 'password_changed', entityType: 'user', entityId: user.id, ip });
  return usersRepo.find(user.id)!;
}

/** Sets a random temporary password that must be changed at next sign-in. */
export function resetPassword(targetId: string, actor: { id: string; email: string }, ip: string | undefined): string {
  const target = usersRepo.findLoginById(targetId);
  if (!target) throw notFound('User');
  const temporaryPassword = generateTemporaryPassword();
  usersRepo.update(target.id, {
    password_hash: hashPassword(temporaryPassword),
    must_change_password: 1,
    failed_attempts: 0,
    locked_until: null,
  });
  revokeAllSessions(target.id);
  writeAudit({ userId: actor.id, action: 'password_reset', entityType: 'user', entityId: target.id, ip });
  logger.info(`[Auth] ${actor.email} reset the password for ${target.email}`);
  return temporaryPassword;
}

export function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
  return 'PL';
}

/** Creates a Project Lead with a coordinator-chosen password they must change at first sign-in. */
export function createLead(input: { name: string; email: string; password: string; title?: string | null }) {
  const policyError = checkPasswordPolicy(input.password);
  if (policyError) throw badRequest(policyError);
  const email = input.email.trim().toLowerCase();
  if (usersRepo.emailTaken(email)) throw conflict('A user with this email address already exists');

  const name = input.name.trim();
  const lead = {
    id: `user-lead-${Date.now()}`,
    name,
    email,
    role: 'lead' as const,
    title: input.title?.trim() || 'Project Lead',
    initials: initialsFor(name),
  };
  usersRepo.insert({ ...lead, password_hash: hashPassword(input.password), must_change_password: 1 });
  return lead;
}
