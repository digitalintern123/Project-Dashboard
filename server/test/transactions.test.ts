import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db, uploadsDir } from '../src/db/database.js';

const app = makeApp();
let coord: any;
let lead: any;

beforeAll(async () => {
  insertProject('proj-tx', 'u-lead-a');
  coord = await loginAs(app, 'coordinator');
  lead = await loginAs(app, 'leadA');
});

/** Makes the next matching write fail inside the request, after earlier writes ran. */
function failOn(table: string, event: 'INSERT' | 'DELETE' | 'UPDATE') {
  db.exec(
    `CREATE TRIGGER fail_${table}_${event} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`,
  );
  return () => db.exec(`DROP TRIGGER fail_${table}_${event}`);
}

const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { c: number }).c;

describe('multi-table writes are atomic', () => {
  it('rolls back a new stage when its tag notification cannot be written', async () => {
    const restore = failOn('notifications', 'INSERT');
    try {
      const res = await lead
        .post('/api/projects/proj-tx/phases')
        .send({ id: 'tx-stage', name: 'Tx stage', taggedUsers: [testUsers.hod.id] });
      expect(res.status).toBe(500);
    } finally {
      restore();
    }
    expect(count("SELECT COUNT(*) c FROM phases WHERE id = 'tx-stage'")).toBe(0);
    expect(count('SELECT COUNT(*) c FROM email_queue')).toBe(0);
    expect(count("SELECT COUNT(*) c FROM audit_log WHERE entity_id = 'tx-stage'")).toBe(0);
  });

  it('rolls back a high-severity issue when its alert cannot be queued', async () => {
    const restore = failOn('email_queue', 'INSERT');
    try {
      const res = await lead
        .post('/api/projects/proj-tx/issues')
        .send({ id: 'tx-issue', title: 'Fire door', detail: 'Missing', severity: 'High' });
      expect(res.status).toBe(500);
    } finally {
      restore();
    }
    expect(count("SELECT COUNT(*) c FROM issues WHERE id = 'tx-issue'")).toBe(0);
    expect(count("SELECT COUNT(*) c FROM notifications WHERE title LIKE 'Critical Issue: Fire door%'")).toBe(0);
  });

  it('keeps a project, its photos and their files if the delete fails part-way', async () => {
    insertProject('proj-tx-del', 'u-lead-a');
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    const up = await lead.post('/api/projects/proj-tx-del/photos').attach('photos', png, 'a.png');
    const file = path.join(uploadsDir, path.basename(up.body.photo.url));

    const restore = failOn('projects', 'DELETE');
    try {
      expect((await coord.delete('/api/projects/proj-tx-del')).status).toBe(500);
    } finally {
      restore();
    }
    expect(count("SELECT COUNT(*) c FROM projects WHERE id = 'proj-tx-del'")).toBe(1);
    expect(count("SELECT COUNT(*) c FROM photos WHERE project_id = 'proj-tx-del'")).toBe(1);
    expect(fs.existsSync(file)).toBe(true);

    // Once the delete succeeds, the files go too.
    expect((await coord.delete('/api/projects/proj-tx-del')).status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('queues project-update emails all or nothing', async () => {
    db.exec(
      `CREATE TRIGGER fail_second BEFORE INSERT ON email_logs WHEN NEW.recipient_email = 'b@test.local' BEGIN SELECT RAISE(ABORT, 'injected'); END;`,
    );
    try {
      const res = await lead
        .post('/api/email/send-project-update')
        .send({ projectId: 'proj-tx', recipients: ['a@test.local', 'b@test.local'] });
      expect(res.status).toBe(500);
    } finally {
      db.exec('DROP TRIGGER fail_second');
    }
    expect(count("SELECT COUNT(*) c FROM email_logs WHERE recipient_email = 'a@test.local'")).toBe(0);
  });

  it('rejects async handlers wrapped in a transaction', async () => {
    const { transactional } = await import('../src/utils/tx.js');
    let error: unknown;
    transactional(async () => {})({} as any, {} as any, (err?: unknown) => (error = err));
    expect(String(error)).toMatch(/must be synchronous/);
  });
});
