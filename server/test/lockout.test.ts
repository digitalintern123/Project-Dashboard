import { describe, expect, it } from 'vitest';
import { makeApp, anon, TEST_PASSWORD, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();

describe('per-account lockout', () => {
  it('locks an account for 15 minutes after 5 failures, with a generic message', async () => {
    const email = testUsers.leadA.email;
    const fail = () => anon(app).post('/api/auth/login').send({ email, password: 'wrong-password-1' });

    const first = await fail();
    for (let i = 0; i < 4; i++) await fail();

    const row = db.prepare('SELECT locked_until FROM users WHERE id = ?').get(testUsers.leadA.id) as {
      locked_until: string;
    };
    const lockMinutes = (new Date(row.locked_until).getTime() - Date.now()) / 60000;
    expect(lockMinutes).toBeGreaterThan(14);
    expect(lockMinutes).toBeLessThanOrEqual(15);

    // Even the right password is refused while locked, with the same message.
    const locked = await anon(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
    expect(locked.status).toBe(401);
    expect(locked.body.error).toBe(first.body.error);

    // Once the lock expires the right password works and the counter resets.
    db.prepare("UPDATE users SET locked_until = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(testUsers.leadA.id);
    const ok = await anon(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
    expect(ok.status).toBe(200);
    const after = db
      .prepare('SELECT failed_attempts, locked_until FROM users WHERE id = ?')
      .get(testUsers.leadA.id) as any;
    expect(after.failed_attempts).toBe(0);
    expect(after.locked_until).toBeNull();
  });

  it('resets the failure counter after a successful login', async () => {
    const email = testUsers.hod.email;
    for (let i = 0; i < 4; i++) await anon(app).post('/api/auth/login').send({ email, password: 'wrong-password-1' });
    expect((await anon(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).status).toBe(200);
    await anon(app).post('/api/auth/login').send({ email, password: 'wrong-password-1' });
    const row = db.prepare('SELECT failed_attempts, locked_until FROM users WHERE id = ?').get(testUsers.hod.id) as any;
    expect(row.failed_attempts).toBe(1);
    expect(row.locked_until).toBeNull();
  });
});
