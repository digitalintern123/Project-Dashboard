import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, loginAs } from './helpers.js';
import { productionConfigErrors } from '../src/config.js';

const app = makeApp();

describe('production config', () => {
  const KEY = Buffer.alloc(32, 7).toString('base64');
  const prod = (JWT_SECRET?: string, SETTINGS_ENCRYPTION_KEY: string | undefined = KEY) =>
    productionConfigErrors({ NODE_ENV: 'production', JWT_SECRET, SETTINGS_ENCRYPTION_KEY } as NodeJS.ProcessEnv);

  it('rejects a missing, short or default JWT secret', () => {
    expect(prod(undefined)).not.toHaveLength(0);
    expect(prod('short-secret')).not.toHaveLength(0);
    expect(prod('encalm-secure-prod-jwt-key-change-me')).not.toHaveLength(0);
    expect(prod('replace-with-a-strong-random-secret-key-32-chars-minimum')).not.toHaveLength(0);
  });

  it('requires a valid 32-byte SETTINGS_ENCRYPTION_KEY', () => {
    const good = 'k'.repeat(10) + 'Xy7-random-0123456789-abcdefghij';
    expect(prod(good, '')).not.toHaveLength(0);
    expect(prod(good, 'too-short')).not.toHaveLength(0);
    expect(prod(good, 'ab'.repeat(32))).toHaveLength(0);
  });

  it('accepts a long random secret, and does not apply outside production', () => {
    expect(prod('k'.repeat(10) + 'Xy7-random-0123456789-abcdefghij')).toHaveLength(0);
    expect(productionConfigErrors({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toHaveLength(0);
  });
});

describe('security headers', () => {
  it('sends a strict CSP, HSTS and same-origin CORP', async () => {
    const res = await request(app).get('/api/system/ready');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('CORS', () => {
  it('does not reflect arbitrary origins', async () => {
    const res = await request(app).get('/api/system/ready').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not block same-origin requests that carry an Origin header', async () => {
    const res = await request(app).get('/api/system/ready').set('Origin', 'https://projects.encalm.com');
    expect(res.status).toBe(200);
  });
});

describe('body size', () => {
  it('rejects JSON bodies over 1 MB', async () => {
    const agent = await loginAs(app, 'coordinator');
    const res = await agent
      .post('/api/projects')
      .send({ name: 'x'.repeat(1_100_000), location: 'Delhi', category: 'Lounge' });
    expect(res.status).toBe(413);
  });
});
