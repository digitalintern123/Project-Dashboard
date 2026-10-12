import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';
import { pageFrom } from '../src/utils/paging.js';

const app = makeApp();
let coord: any;
let hod: any;

beforeAll(async () => {
  insertProject('proj-pg', 'u-lead-a');
  const addUpdate = db.prepare(
    "INSERT INTO updates (id, project_id, date, author, role, text, stage, kind, created_at) VALUES (?, 'proj-pg', '2026-01-01', 'A', 'Lead', ?, NULL, 'General', ?)",
  );
  const addPhoto = db.prepare(
    "INSERT INTO photos (id, project_id, url, caption, uploaded_by, taken_date, created_at) VALUES (?, 'proj-pg', ?, 'c', 'A', ?, ?)",
  );
  const addNotif = db.prepare(
    "INSERT INTO notifications (id, type, title, message, recipient_id, read, created_at) VALUES (?, 'system', ?, 'm', ?, 0, ?)",
  );
  const addLog = db.prepare(
    "INSERT INTO email_logs (id, recipient_email, subject, template_type, project_id, status, created_at) VALUES (?, 'a@b.c', ?, 'test_email', 'proj-pg', 'sent', ?)",
  );
  for (let i = 0; i < 5; i++) {
    const at = `2026-01-0${i + 1} 10:00:00`;
    addUpdate.run(`pg-u${i}`, `update ${i}`, at);
    addPhoto.run(`pg-p${i}`, `/uploads/pg-${i}.webp`, `2026-01-0${i + 1}`, at);
    addNotif.run(`pg-n${i}`, `note ${i}`, testUsers.hod.id, at);
    addLog.run(`pg-e${i}`, `mail ${i}`, at);
  }
  coord = await loginAs(app, 'coordinator');
  hod = await loginAs(app, 'hod');
});

describe('pageFrom', () => {
  it('uses defaults, clamps the limit and ignores a negative offset', () => {
    expect(pageFrom({}, 50)).toEqual({ limit: 50, offset: 0 });
    expect(pageFrom({ limit: '999', offset: '3' }, 50)).toEqual({ limit: 200, offset: 3 });
    expect(pageFrom({ limit: '0' }, 50, 100)).toEqual({ limit: 1, offset: 0 });
    expect(pageFrom({ offset: '-4' }, 10)).toEqual({ limit: 10, offset: 0 });
  });
});

describe('paginated lists', () => {
  it('pages a project’s updates newest first, with a total', async () => {
    const first = await hod.get('/api/projects/proj-pg/updates?limit=2');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ total: 5, limit: 2, offset: 0 });
    expect(first.body.updates.map((u: any) => u.text)).toEqual(['update 4', 'update 3']);
    const last = await hod.get('/api/projects/proj-pg/updates?limit=2&offset=4');
    expect(last.body.updates.map((u: any) => u.text)).toEqual(['update 0']);
  });

  it('pages the portfolio update feed', async () => {
    const res = await hod.get('/api/updates?limit=1&offset=1');
    expect(res.body.updates).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
  });

  it('pages project and portfolio photos', async () => {
    const proj = await hod.get('/api/projects/proj-pg/photos?limit=3');
    expect(proj.body.photos.map((p: any) => p.id)).toEqual(['pg-p4', 'pg-p3', 'pg-p2']);
    expect(proj.body.total).toBe(5);
    const all = await hod.get('/api/photos?limit=2&offset=2');
    expect(all.body.photos).toHaveLength(2);
    expect(all.body).toMatchObject({ limit: 2, offset: 2 });
  });

  it('pages notifications without changing the unread count', async () => {
    const res = await hod.get('/api/notifications?limit=2');
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(5);
  });

  it('pages email logs and caps the limit at 100', async () => {
    const res = await coord.get('/api/email/logs?projectId=proj-pg&limit=2&offset=1');
    expect(res.body.logs.map((l: any) => l.subject)).toEqual(['mail 3', 'mail 2']);
    expect(res.body.total).toBe(5);
    expect((await coord.get('/api/email/logs?limit=500')).body.limit).toBe(100);
  });

  it('rejects non-numeric paging values', async () => {
    for (const url of ['/api/updates?limit=x', '/api/photos?offset=-1', '/api/notifications?limit=1.5']) {
      expect((await hod.get(url)).status).toBe(400);
    }
  });
});
