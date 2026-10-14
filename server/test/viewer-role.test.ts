import bcrypt from 'bcryptjs';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, insertProject, makeApp } from './helpers.js';
import { db } from '../src/db/database.js';

const app = makeApp();
const P = '/api/projects/proj-v';
let viewer: ReturnType<typeof request.agent>;

beforeAll(async () => {
  insertProject('proj-v', null); // unassigned: even leads may edit it, viewers may not
  db.prepare(
    "INSERT OR REPLACE INTO users (id, name, email, password_hash, role, title, initials) VALUES ('u-viewer', 'Vera Viewer', 'viewer@test.local', ?, 'viewer', 'Viewer', 'VV')",
  ).run(bcrypt.hashSync(TEST_PASSWORD, 4));
  viewer = request.agent(app);
  viewer.set('X-Requested-With', 'XMLHttpRequest');
  const res = await viewer.post('/api/auth/login').send({ email: 'viewer@test.local', password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe('viewer');
});

describe('viewer role (strictly view-only)', () => {
  it('can see everything', async () => {
    for (const path of [
      '/api/projects',
      P,
      `${P}/updates`,
      '/api/updates',
      '/api/photos',
      '/api/auth/users',
      '/api/notifications',
    ]) {
      expect((await viewer.get(path)).status, path).toBe(200);
    }
  });

  it('cannot change, tag, email or administer anything', async () => {
    const attempts: Array<[string, string, object?]> = [
      ['post', '/api/projects', { name: 'X', location: 'Delhi', category: 'Lounge' }],
      ['patch', P, { name: 'Changed' }],
      ['delete', P],
      ['post', `${P}/phases`, { name: 'Stage' }],
      ['post', `${P}/milestones`, { title: 'M', targetDate: '2027-01-01' }],
      ['post', `${P}/issues`, { title: 'I', severity: 'Low', detail: 'd' }],
      ['post', `${P}/updates`, { text: 'note', date: '14 Oct 2026' }],
      ['post', `${P}/photos`],
      ['post', '/api/email/tag-and-comment', { projectId: 'proj-v', taggedUserIds: ['u-coord'] }],
      ['post', '/api/email/send-project-update', { projectId: 'proj-v', recipients: ['a@test.local'] }],
      ['post', '/api/email/settings', { smtp: { host: 'x' } }],
      ['post', '/api/email/test', {}],
      ['post', '/api/system/backups'],
      ['post', '/api/system/import', { projects: [] }],
      ['post', '/api/projects/sync', { projects: [] }],
      ['post', '/api/auth/create-lead', { name: 'N', email: 'n@test.local' }],
      ['post', '/api/auth/users/u-coord/reset-password'],
    ];
    for (const [method, path, body] of attempts) {
      const res = await (viewer as any)[method](path).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
    expect((db.prepare("SELECT name FROM projects WHERE id = 'proj-v'").get() as { name: string }).name).not.toBe(
      'Changed',
    );
  });

  it('cannot browse the company directory and gets no project notifications', async () => {
    expect((await viewer.get('/api/email/directory?q=a')).status).toBe(403);
    const { usersRepo } = await import('../src/repositories/users.repo.js');
    expect(usersRepo.inboxUserIds()).not.toContain('u-viewer');
  });
});

describe('create-user script', () => {
  const run = (role: string) => {
    try {
      execFileSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'server/src/scripts/create-user.ts',
          'Typo Person',
          'typo@test.local',
          'Temp-pass-2026',
          role,
        ],
        { env: process.env, stdio: 'pipe' },
      );
      return { code: 0, out: '' };
    } catch (err) {
      const e = err as { status: number; stderr: Buffer; stdout: Buffer };
      return { code: e.status, out: `${e.stdout}${e.stderr}` };
    }
  };

  it('refuses an unknown role instead of quietly creating a lead', () => {
    const res = run('viwer');
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/Unknown role "viwer"/);
    expect(db.prepare("SELECT 1 FROM users WHERE email = 'typo@test.local'").get()).toBeUndefined();
  });

  it('creates a viewer', () => {
    expect(run('viewer').code).toBe(0);
    const row = db.prepare("SELECT role, title FROM users WHERE email = 'typo@test.local'").get();
    expect(row).toEqual({ role: 'viewer', title: 'Viewer' });
  });
});
