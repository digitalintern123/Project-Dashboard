import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { makeApp, loginAs, TEST_PASSWORD, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';
import { ensureUsersSeeded } from '../src/db/seed.js';
import { checkPasswordPolicy, generateTemporaryPassword } from '../src/utils/passwords.js';
import { users as seedUsers } from '../../src/data/users.js';

const app = makeApp();

describe('password policy', () => {
  it.each([
    ['short1', false],
    ['onlyletterslong', false],
    ['1234567890', false],
    ['letters12345', true],
  ])('%s -> valid=%s', (pw, ok) => {
    expect(checkPasswordPolicy(pw) === null).toBe(ok);
  });

  it('generates 16-char passwords that pass the policy', () => {
    const pw = generateTemporaryPassword();
    expect(pw).toHaveLength(16);
    expect(checkPasswordPolicy(pw)).toBeNull();
  });
});

describe('login', () => {
  it('no longer accepts the coordinator alias', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'coordinator', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('returns the same generic error for unknown users and wrong passwords', async () => {
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.local', password: 'whatever123' });
    const wrong = await request(app).post('/api/auth/login').send({ email: testUsers.hod.email, password: 'wrong-pass-123' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });
});

describe('seeding', () => {
  it('creates seeded users with a random password and must_change_password, and never overwrites existing ones', () => {
    ensureUsersSeeded();
    const first = seedUsers[0];
    const row = db.prepare('SELECT password_hash, must_change_password FROM users WHERE id = ?').get(first.id) as any;
    expect(row.must_change_password).toBe(1);
    expect(bcrypt.compareSync('encalm', row.password_hash)).toBe(false);

    ensureUsersSeeded();
    const again = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(first.id) as any;
    expect(again.password_hash).toBe(row.password_hash);
  });
});

describe('forced and voluntary password change', () => {
  it('blocks other routes until the password is changed, then allows them', async () => {
    db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(testUsers.leadB.id);
    const agent = await loginAs(app, 'leadB');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);

    const blocked = await agent.get('/api/projects');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const weak = await agent.post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const wrongCurrent = await agent.post('/api/auth/change-password').send({ currentPassword: 'nope-nope-1', newPassword: 'Brand-new-pass-1' });
    expect(wrongCurrent.status).toBe(400);

    const ok = await agent.post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'Brand-new-pass-1' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.mustChangePassword).toBe(false);

    expect((await agent.get('/api/projects')).status).toBe(200);

    // Restore the shared test password for other tests.
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(TEST_PASSWORD, 4), testUsers.leadB.id);
  });
});

describe('coordinator password reset', () => {
  it('is coordinator-only and forces a change at next sign-in', async () => {
    const lead = await loginAs(app, 'leadA');
    expect((await lead.post(`/api/auth/users/${testUsers.hod.id}/reset-password`)).status).toBe(403);

    const coord = await loginAs(app, 'coordinator');
    const res = await coord.post(`/api/auth/users/${testUsers.hod.id}/reset-password`);
    expect(res.status).toBe(200);
    expect(checkPasswordPolicy(res.body.temporaryPassword)).toBeNull();

    const login = await request(app).post('/api/auth/login').send({ email: testUsers.hod.email, password: res.body.temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    expect((await coord.post('/api/auth/users/nope/reset-password')).status).toBe(404);
  });
});

describe('create-lead', () => {
  it('enforces the password policy', async () => {
    const coord = await loginAs(app, 'coordinator');
    const weak = await coord.post('/api/auth/create-lead').send({ name: 'New Lead', email: 'new.lead@test.local', password: 'abc' });
    expect(weak.status).toBe(400);
    const ok = await coord.post('/api/auth/create-lead').send({ name: 'New Lead', email: 'new.lead@test.local', password: 'Good-pass-123' });
    expect(ok.status).toBe(201);
  });
});
