import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, loginAs } from './helpers.js';

describe('app smoke', () => {
  const app = makeApp();

  it('serves the readiness probe', async () => {
    const res = await request(app).get('/api/system/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('logs in a test user', async () => {
    const agent = await loginAs(app, 'coordinator');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('coordinator');
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
