import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject } from './helpers.js';
import { clientDistDir } from '../src/paths.js';

const app = makeApp();
let lead: any;

beforeAll(async () => {
  insertProject('proj-cache', 'u-lead-a');
  lead = await loginAs(app, 'leadA');
});

describe('API caching', () => {
  it('GETs are private, revalidated, and answer 304 when unchanged', async () => {
    const first = await lead.get('/api/projects/proj-cache');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('private, no-cache');
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();

    const again = await lead.get('/api/projects/proj-cache').set('If-None-Match', etag);
    expect(again.status).toBe(304);
    expect(again.text).toBe('');
  });

  it('a change produces a new ETag', async () => {
    const before = (await lead.get('/api/projects/proj-cache')).headers.etag;
    await lead.patch('/api/projects/proj-cache').send({ progress: 42 });
    const after = await lead.get('/api/projects/proj-cache').set('If-None-Match', before);
    expect(after.status).toBe(200);
    expect(after.headers.etag).not.toBe(before);
  });

  it('auth responses and writes are never stored', async () => {
    expect((await lead.get('/api/auth/me')).headers['cache-control']).toBe('no-store');
    const write = await lead.patch('/api/projects/proj-cache').send({ progress: 43 });
    expect(write.headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/projects')).headers['cache-control']).toBe('private, no-cache');
  });
});

describe.runIf(fs.existsSync(path.join(clientDistDir, 'index.html')))('SPA entry point', () => {
  it('is never served from cache, at / or a client route', async () => {
    for (const url of ['/', '/projects']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toMatch(/no-cache/);
    }
  });
});
