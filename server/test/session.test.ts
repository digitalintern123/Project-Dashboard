import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, loginAs, anon, TEST_PASSWORD, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();

function cookiesOf(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  return Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
}

function cookieValue(res: request.Response, name: string): string | undefined {
  const c = cookiesOf(res).find((x) => x.startsWith(`${name}=`));
  return c?.split(';')[0].slice(name.length + 1);
}

describe('login cookies', () => {
  it('sets httpOnly SameSite=Strict cookies and returns no token in the body', async () => {
    const res = await anon(app).post('/api/auth/login').send({ email: testUsers.hod.email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();

    const access = cookiesOf(res).find((c) => c.startsWith('encalm_at='))!;
    const refresh = cookiesOf(res).find((c) => c.startsWith('encalm_rt='))!;
    for (const c of [access, refresh]) {
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=Strict/i);
    }
    expect(access).toMatch(/Max-Age=1800/);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    expect(refresh).toMatch(/Max-Age=604800/);
  });

  it('no longer accepts an Authorization bearer header', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer whatever');
    expect(res.status).toBe(401);
  });
});

describe('CSRF', () => {
  it('rejects state-changing requests with a session cookie but no X-Requested-With header', async () => {
    const login = await anon(app).post('/api/auth/login').send({ email: testUsers.leadA.email, password: TEST_PASSWORD });
    const at = cookieValue(login, 'encalm_at')!;
    const res = await request(app).post('/api/notifications/read-all').set('Cookie', `encalm_at=${at}`);
    expect(res.status).toBe(403);

    const withHeader = await request(app)
      .post('/api/notifications/read-all')
      .set('Cookie', `encalm_at=${at}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(withHeader.status).toBe(200);
  });

  it('rejects login without the header', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testUsers.hod.email, password: TEST_PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('refresh rotation', () => {
  it('rotates the refresh token and detects reuse of an old one', async () => {
    const login = await anon(app).post('/api/auth/login').send({ email: testUsers.leadA.email, password: TEST_PASSWORD });
    const rt1 = cookieValue(login, 'encalm_rt')!;

    const r1 = await anon(app).post('/api/auth/refresh').set('Cookie', `encalm_rt=${rt1}`);
    expect(r1.status).toBe(200);
    expect(r1.body.user.id).toBe(testUsers.leadA.id);
    const rt2 = cookieValue(r1, 'encalm_rt')!;
    const at2 = cookieValue(r1, 'encalm_at')!;
    expect(rt2).not.toBe(rt1);

    // Within the grace window a second use of rt1 is treated as a concurrent-tab race.
    const raced = await anon(app).post('/api/auth/refresh').set('Cookie', `encalm_rt=${rt1}`);
    expect(raced.body.retry).toBe(true);

    // Outside the grace window, reusing rt1 revokes every session for the user.
    db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now', '-1 minute') WHERE revoked_at IS NOT NULL").run();
    const reuse = await anon(app).post('/api/auth/refresh').set('Cookie', `encalm_rt=${rt1}`);
    expect(reuse.status).toBe(401);

    expect((await anon(app).post('/api/auth/refresh').set('Cookie', `encalm_rt=${rt2}`)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', `encalm_at=${at2}`)).status).toBe(401);
  });

  it('rejects unknown and expired refresh tokens', async () => {
    expect((await anon(app).post('/api/auth/refresh').set('Cookie', 'encalm_rt=nope')).status).toBe(401);
    expect((await anon(app).post('/api/auth/refresh')).status).toBe(401);

    const login = await anon(app).post('/api/auth/login').send({ email: testUsers.hod.email, password: TEST_PASSWORD });
    const rt = cookieValue(login, 'encalm_rt')!;
    db.prepare("UPDATE refresh_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE revoked_at IS NULL").run();
    expect((await anon(app).post('/api/auth/refresh').set('Cookie', `encalm_rt=${rt}`)).status).toBe(401);
  });
});

describe('logout', () => {
  it('revokes the refresh token and clears cookies', async () => {
    const login = await anon(app).post('/api/auth/login').send({ email: testUsers.hod.email, password: TEST_PASSWORD });
    const rt = cookieValue(login, 'encalm_rt')!;
    const at = cookieValue(login, 'encalm_at')!;

    const out = await anon(app).post('/api/auth/logout').set('Cookie', `encalm_rt=${rt}; encalm_at=${at}`);
    expect(out.status).toBe(200);
    expect(cookiesOf(out).some((c) => c.startsWith('encalm_at=;'))).toBe(true);

    expect((await anon(app).post('/api/auth/refresh').set('Cookie', `encalm_rt=${rt}`)).status).toBe(401);
  });

  it('logout-all invalidates existing access tokens via token_version', async () => {
    const a = await loginAs(app, 'leadB');
    const b = await loginAs(app, 'leadB');
    expect((await b.get('/api/auth/me')).status).toBe(200);

    expect((await a.post('/api/auth/logout-all')).status).toBe(200);
    expect((await b.get('/api/auth/me')).status).toBe(401);
  });

  it('a password change signs out other sessions but keeps the current one', async () => {
    const other = await loginAs(app, 'coordinator');
    const current = await loginAs(app, 'coordinator');

    const res = await current.post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'Another-pass-123' });
    expect(res.status).toBe(200);
    expect((await current.get('/api/auth/me')).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
  });
});
