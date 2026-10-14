import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { insertProject, loginAs, makeApp } from './helpers.js';
import { db, dataDir, dbPath, uploadsDir } from '../src/db/database.js';
import {
  KEEP_AT_LEAST,
  backupConfig,
  backupIsDue,
  listBackups,
  mirrorUploads,
  msUntil,
  pruneBackups,
  runBackup,
  startBackupScheduler,
  stopBackupScheduler,
  type BackupConfig,
} from '../src/utils/scheduled-backup.js';
import { restoreBackup } from '../src/utils/restore-backup.js';
import { releaseAppLock, writeAppLock } from '../src/utils/app-lock.js';

const app = makeApp();
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'encalm-bk-'));
const cfg = (over: Partial<BackupConfig> = {}): BackupConfig => ({
  enabled: true,
  dir: tmpDir(),
  retentionDays: 30,
  time: '02:15',
  ...over,
});
const gunzipTo = (gz: string, out: string) => fs.writeFileSync(out, zlib.gunzipSync(fs.readFileSync(gz)));

beforeAll(() => {
  insertProject('bk-1', null);
  insertProject('bk-2', null);
});
afterEach(() => {
  stopBackupScheduler();
  vi.useRealTimers();
});

describe('runBackup', () => {
  it('writes a checked, gzipped copy that matches the live database, even while it is being written', async () => {
    const c = cfg();
    fs.writeFileSync(path.join(uploadsDir, 'bk-photo.webp'), 'photo');
    const write = setInterval(
      () => db.prepare("UPDATE projects SET progress = progress + 1 WHERE id = 'bk-1'").run(),
      1,
    );
    const result = await runBackup(c, new Date('2026-10-14T02:15:00Z'));
    clearInterval(write);

    expect(result).toMatchObject({ ok: true, file: 'encalm-20261014T021500Z.db.gz', photosCopied: 1 });
    const restored = path.join(c.dir, 'check.db');
    gunzipTo(path.join(c.dir, 'encalm-20261014T021500Z.db.gz'), restored);
    const copy = new Database(restored, { readonly: true });
    expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
    const live = (db.prepare('SELECT COUNT(*) n FROM projects').get() as { n: number }).n;
    expect((copy.prepare('SELECT COUNT(*) n FROM projects').get() as { n: number }).n).toBe(live);
    expect(result.ok && result.projects).toBe(live);
    copy.close();
    expect(fs.readFileSync(path.join(c.dir, 'uploads', 'bk-photo.webp'), 'utf8')).toBe('photo');
    // No temporary files left behind.
    expect(fs.readdirSync(c.dir).filter((f) => f.startsWith('.'))).toEqual([]);
  });

  it('reports a failure instead of throwing, and leaves nothing half-written', async () => {
    const c = cfg();
    fs.writeFileSync(path.join(c.dir, '.backup.lock'), '');
    const result = await runBackup(c);
    expect(result).toMatchObject({ ok: false, error: 'Another backup is already running' });
    expect(listBackups(c.dir)).toEqual([]);
  });

  it('does not overlap: a second call while one runs gets the same result', async () => {
    const c = cfg();
    const [a, b] = await Promise.all([runBackup(c), runBackup(c)]);
    expect(a).toBe(b);
    expect(listBackups(c.dir)).toHaveLength(1);
  });
});

describe('retention, mirror and schedule', () => {
  it('deletes backups past the retention period but always keeps the newest few', () => {
    const dir = tmpDir();
    const days = [1, 2, 3, 40, 41, 42, 43, 44, 45, 46];
    const now = new Date('2026-10-14T00:00:00Z').getTime();
    for (const d of days) {
      const stamp = new Date(now - d * 86_400_000)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z$/, 'Z');
      fs.writeFileSync(path.join(dir, `encalm-${stamp}.db.gz`), 'x');
    }
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'keep me');
    const removed = pruneBackups(dir, 30, now);
    expect(removed).toHaveLength(days.length - KEEP_AT_LEAST);
    expect(listBackups(dir)).toHaveLength(KEEP_AT_LEAST);
    expect(fs.existsSync(path.join(dir, 'notes.txt'))).toBe(true);
  });

  it('mirrors only new photos and never deletes from the mirror', () => {
    const from = tmpDir();
    const to = tmpDir();
    fs.writeFileSync(path.join(from, 'a.webp'), 'a');
    fs.mkdirSync(path.join(from, 'thumbs'));
    fs.writeFileSync(path.join(from, 'thumbs', 'a.webp'), 't');
    expect(mirrorUploads(from, to)).toBe(2);
    expect(mirrorUploads(from, to)).toBe(0);
    fs.rmSync(path.join(from, 'a.webp'));
    expect(mirrorUploads(from, to)).toBe(0);
    expect(fs.existsSync(path.join(to, 'a.webp'))).toBe(true);
  });

  it('is due when there is no backup from the last day', async () => {
    const c = cfg();
    expect(backupIsDue(c)).toBe(true);
    await runBackup(c);
    expect(backupIsDue(c)).toBe(false);
    expect(backupIsDue(c, Date.now() + 25 * 3_600_000)).toBe(true);
  });

  it('runs a catch-up backup soon after start when one is due', async () => {
    const c = cfg();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    startBackupScheduler(c, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(listBackups(c.dir)).toHaveLength(1));
  });

  it('does nothing when disabled', () => {
    const c = cfg({ enabled: false });
    startBackupScheduler(c, 0);
    expect(listBackups(c.dir)).toEqual([]);
  });

  it('computes the wait until the next daily run', () => {
    const now = new Date(2026, 9, 14, 1, 15, 0);
    expect(msUntil('02:15', now)).toBe(3_600_000);
    expect(msUntil('01:15', now)).toBe(24 * 3_600_000);
  });

  it('reads its settings from the environment', () => {
    expect(backupConfig({ NODE_ENV: 'production' })).toMatchObject({
      enabled: true,
      time: '02:15',
      retentionDays: 30,
      dir: path.join(dataDir, 'backups'),
    });
    expect(
      backupConfig({
        NODE_ENV: 'production',
        BACKUP_ENABLED: 'false',
        BACKUP_TIME: '25:00',
        BACKUP_RETENTION_DAYS: '7',
      }),
    ).toMatchObject({ enabled: false, time: '02:15', retentionDays: 7 });
    expect(backupConfig({ NODE_ENV: 'test' }).enabled).toBe(false);
  });
});

describe('restoreBackup', () => {
  it('refuses while the app is running, then restores and keeps the old database aside', async () => {
    const c = cfg();
    const made = await runBackup(c);
    if (!made.ok) throw new Error(made.error);

    // A separate "live" data folder so the test database stays untouched.
    const liveDir = tmpDir();
    const livePath = path.join(liveDir, 'encalm.db');
    fs.writeFileSync(livePath, 'old database');
    fs.writeFileSync(`${livePath}-wal`, 'old wal');

    writeAppLock(liveDir);
    await expect(restoreBackup(path.join(c.dir, made.file), { dataDir: liveDir, dbPath: livePath })).rejects.toThrow(
      /app is running/,
    );
    releaseAppLock(liveDir);

    const result = await restoreBackup(path.join(c.dir, made.file), {
      dataDir: liveDir,
      dbPath: livePath,
      now: new Date('2026-10-14T03:00:00Z'),
    });
    expect(result.projects).toBe(made.projects);
    expect(result.movedAside.sort()).toEqual([
      'encalm.db-wal.before-restore-20261014T030000Z',
      'encalm.db.before-restore-20261014T030000Z',
    ]);
    expect(fs.readFileSync(path.join(liveDir, 'encalm.db.before-restore-20261014T030000Z'), 'utf8')).toBe(
      'old database',
    );
    const restored = new Database(livePath, { readonly: true });
    expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
    restored.close();
    expect(dbPath).not.toBe(livePath);
  });

  it('rejects a damaged backup without touching the database', async () => {
    const liveDir = tmpDir();
    const livePath = path.join(liveDir, 'encalm.db');
    fs.writeFileSync(livePath, 'current');
    const bad = path.join(liveDir, 'bad.db.gz');
    fs.writeFileSync(bad, zlib.gzipSync('not a database'));
    await expect(restoreBackup(bad, { dataDir: liveDir, dbPath: livePath })).rejects.toThrow();
    expect(fs.readFileSync(livePath, 'utf8')).toBe('current');
  });
});

describe('/api/system/backups', () => {
  it('is coordinator-only, makes a backup, audits it, and limits repeats', async () => {
    process.env.BACKUP_DIR = tmpDir();
    try {
      for (const role of ['leadA', 'hod'] as const) {
        const agent = await loginAs(app, role);
        expect((await agent.get('/api/system/backups')).status).toBe(403);
        expect((await agent.post('/api/system/backups')).status).toBe(403);
      }
      const coord = await loginAs(app, 'coordinator');
      expect((await coord.get('/api/system/backups')).body).toMatchObject({ count: 0, newest: null });

      const res = await coord.post('/api/system/backups');
      expect(res.status).toBe(200);
      expect(res.body.result).toMatchObject({ ok: true });
      expect(res.body.count).toBe(1);
      expect(res.body.newest.name).toBe(res.body.result.file);
      expect(
        db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action = 'backup' AND entity_type = 'database'").get(),
      ).toEqual({ n: 1 });

      expect((await coord.post('/api/system/backups')).status).toBe(429);
    } finally {
      delete process.env.BACKUP_DIR;
    }
  });
});
