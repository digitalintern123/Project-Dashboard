import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();
let coord: any;
let lead: any;

beforeAll(async () => {
  insertProject('proj-s1', 'u-lead-a');
  insertProject('proj-s2', 'u-lead-b');
  coord = await loginAs(app, 'coordinator');
  lead = await loginAs(app, 'leadA');
});

const projectCount = () => (db.prepare('SELECT COUNT(*) c FROM projects').get() as { c: number }).c;

describe('export and import', () => {
  let exported: any;

  it('exports the full portfolio for coordinators and leads', async () => {
    const res = await lead.get('/api/system/export');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ version: 1, projectCount: 2 });
    exported = res.body;
  });

  it('imports an export, restoring deleted data', async () => {
    await coord.delete('/api/projects/proj-s2');
    expect(projectCount()).toBe(1);
    const res = await coord.post('/api/system/import').send(exported);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(projectCount()).toBe(2);
  });

  it('accepts imports larger than the normal 1 MB limit', async () => {
    const big = {
      ...exported,
      projects: exported.projects.map((p: any) => ({ ...p, specification: { notes: 'x'.repeat(600_000) } })),
    };
    const res = await coord.post('/api/system/import').send(big);
    expect(res.status).toBe(200);
  });
});

describe('reset and clear', () => {
  it('are blocked in production unless ALLOW_SYSTEM_RESET is set', async () => {
    process.env.NODE_ENV = 'production';
    try {
      expect((await coord.post('/api/system/reset')).status).toBe(403);
      expect((await coord.post('/api/system/clear')).status).toBe(403);
    } finally {
      process.env.NODE_ENV = 'test';
    }
    expect(projectCount()).toBe(2);
  });

  it('clear removes all project data but keeps users', async () => {
    const res = await coord.post('/api/system/clear');
    expect(res.status).toBe(200);
    expect(projectCount()).toBe(0);
    expect((db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c).toBeGreaterThan(0);
    // Coordinator session still works.
    expect((await coord.get('/api/auth/me')).status).toBe(200);
  });

  it('reset also leaves an empty portfolio', async () => {
    insertProject('proj-s3', 'u-lead-a');
    expect((await coord.post('/api/system/reset')).status).toBe(200);
    expect(projectCount()).toBe(0);
  });
});

describe('health', () => {
  it('reports counts and memory for the coordinator', async () => {
    const res = await coord.get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.counts.projects).toBe(projectCount());
  });
});
