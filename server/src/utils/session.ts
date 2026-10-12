import crypto from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { ACCESS_COOKIE_NAME, JWT_SECRET } from '../middleware/auth.js';

export const ACCESS_COOKIE = ACCESS_COOKIE_NAME;
export const REFRESH_COOKIE = 'encalm_rt';

const ACCESS_TTL_SECONDS = 30 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === 'production';

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

// The refresh cookie is only ever sent to the auth endpoints that need it.
const REFRESH_COOKIE_PATH = '/api/auth';

export type AccessTokenClaims = { id: string; tv: number };

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(userId: string, tokenVersion: number): string {
  const claims: AccessTokenClaims = { id: userId, tv: tokenVersion };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS });
}

function createRefreshToken(userId: string): { id: string; token: string } {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare(
    `
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `,
  ).run(id, userId, hashToken(token), new Date(Date.now() + REFRESH_TTL_MS).toISOString());
  return { id, token };
}

function setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), path: '/', maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });
}

function currentTokenVersion(userId: string): number | null {
  const row = db.prepare('SELECT token_version FROM users WHERE id = ?').get(userId) as
    { token_version: number } | undefined;
  return row ? row.token_version : null;
}

/** Starts a new session for the user: fresh access token and refresh token cookies. */
export function startSession(res: Response, userId: string): void {
  const tv = currentTokenVersion(userId) ?? 0;
  const refresh = createRefreshToken(userId);
  setSessionCookies(res, signAccessToken(userId, tv), refresh.token);
}

// Two tabs refreshing at the same moment both present the same token. A token
// rotated this recently is treated as that race, not as theft.
const ROTATION_GRACE_MS = 15 * 1000;

export type RotateResult = { status: 'rotated'; userId: string } | { status: 'raced' } | { status: 'invalid' };

/**
 * Exchanges a refresh token for a new access token and a new refresh token
 * (rotation). Presenting an already-used token outside the grace window
 * revokes every session for that user, since it means the token was copied.
 */
export function rotateSession(res: Response, presentedToken: string | undefined): RotateResult {
  if (!presentedToken) return { status: 'invalid' };
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(presentedToken)) as
    | { id: string; user_id: string; expires_at: string; revoked_at: string | null; replaced_by: string | null }
    | undefined;
  if (!row) return { status: 'invalid' };

  if (row.revoked_at) {
    const revokedAt = new Date(`${row.revoked_at.replace(' ', 'T')}Z`).getTime();
    if (row.replaced_by && Date.now() - revokedAt < ROTATION_GRACE_MS) {
      return { status: 'raced' };
    }
    console.warn(`[Auth] Refresh token reuse detected for user ${row.user_id}; revoking all sessions.`);
    revokeAllSessions(row.user_id);
    return { status: 'invalid' };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) return { status: 'invalid' };

  const tv = currentTokenVersion(row.user_id);
  if (tv === null) return { status: 'invalid' };

  const next = createRefreshToken(row.user_id);
  db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now'), replaced_by = ? WHERE id = ?").run(
    next.id,
    row.id,
  );
  setSessionCookies(res, signAccessToken(row.user_id, tv), next.token);
  return { status: 'rotated', userId: row.user_id };
}

/** Revokes the refresh token behind this cookie, if any; returns its user id. */
export function revokeSession(presentedToken: string | undefined): string | null {
  if (!presentedToken) return null;
  const hash = hashToken(presentedToken);
  const row = db.prepare('SELECT user_id FROM refresh_tokens WHERE token_hash = ?').get(hash) as
    { user_id: string } | undefined;
  db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL").run(
    hash,
  );
  return row?.user_id ?? null;
}

/** Invalidates every access and refresh token the user holds. */
export function revokeAllSessions(userId: string): void {
  db.transaction(() => {
    db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId);
    db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(
      userId,
    );
  })();
}

/** Removes refresh tokens that expired more than a day ago. */
export function pruneExpiredRefreshTokens(): void {
  db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
}
