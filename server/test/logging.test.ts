import { Writable } from 'node:stream';
import pino from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { makeApp } from './helpers.js';
import { REDACT_PATHS } from '../src/logger.js';
import { dsnOrigin, scrubEvent } from '../src/sentry.js';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(chunk.toString()));
      done();
    },
  });
  return { log: pino({ redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, stream), lines };
}

describe('log redaction', () => {
  it('hides cookies, auth headers, passwords and secrets wherever they appear', () => {
    const { log, lines } = capture();
    log.info({
      req: { headers: { cookie: 'encalm_at=abc', authorization: 'Bearer x', host: 'h' } },
      res: { headers: { 'set-cookie': 'encalm_rt=def' } },
      password: 'p1',
      body: { newPassword: 'p2', smtp: { pass: 'p3' } },
      graph: { clientSecret: 's' },
      refreshToken: 'r',
    });
    const out = JSON.stringify(lines[0]);
    for (const secret of ['abc', 'Bearer x', 'def', 'p1', 'p2', 'p3', '"s"', '"r"']) expect(out).not.toContain(secret);
    expect(out).toContain('"host":"h"');
  });
});

describe('request ids', () => {
  const app = makeApp();

  it('issues an X-Request-Id, or echoes a well-formed one from the proxy', async () => {
    const fresh = await request(app).get('/api/system/ready');
    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await request(app).get('/api/system/ready').set('X-Request-Id', 'nginx-abc123');
    expect(echoed.headers['x-request-id']).toBe('nginx-abc123');
    const unsafe = await request(app).get('/api/system/ready').set('X-Request-Id', 'bad id; drop');
    expect(unsafe.headers['x-request-id']).not.toContain('bad');
  });
});

describe('Sentry wiring', () => {
  afterEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_CLIENT_DSN;
  });

  it('client-config has no DSN and the CSP allows only self when Sentry is off', async () => {
    const res = await request(makeApp()).get('/api/client-config');
    expect(res.status).toBe(200);
    expect(res.body.sentryDsn).toBeNull();
    expect(res.headers['content-security-policy']).toContain("connect-src 'self';");
  });

  it('exposes the browser DSN and allows its ingest origin in the CSP', async () => {
    process.env.SENTRY_DSN = 'https://server@o1.ingest.sentry.io/1';
    process.env.SENTRY_CLIENT_DSN = 'https://client@o2.ingest.de.sentry.io/2';
    const res = await request(makeApp()).get('/api/client-config');
    expect(res.body.sentryDsn).toBe('https://client@o2.ingest.de.sentry.io/2');
    expect(res.headers['content-security-policy']).toContain("connect-src 'self' https://o2.ingest.de.sentry.io");
  });

  it('parses DSN origins defensively', () => {
    expect(dsnOrigin('')).toBeNull();
    expect(dsnOrigin('not a url')).toBeNull();
    expect(dsnOrigin('https://k@o1.ingest.sentry.io/9')).toBe('https://o1.ingest.sentry.io');
  });

  it('strips cookies, auth headers and request bodies from events', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        cookies: { encalm_at: 'x' },
        data: { password: 'p' },
        headers: { Cookie: 'a=b', Authorization: 'Bearer t', 'User-Agent': 'ua' },
      },
    } as ErrorEvent);
    expect(event.request).toEqual({ headers: { 'User-Agent': 'ua' } });
  });
});
