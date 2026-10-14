import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import Database from 'better-sqlite3';
import { db, dataDir, uploadsDir } from '../db/database.js';
import { logger } from '../logger.js';
import { captureError } from '../sentry.js';

/**
 * Nightly backups made by the app itself, so they work on any server
 * (including Plesk on Windows, where scripts/backup.sh cannot run):
 * a consistent online copy of the database (SQLite backup API, safe while the
 * app writes), checked and gzipped, plus a mirror of the uploaded photos.
 * File names match scripts/backup.sh: encalm-YYYYMMDDTHHMMSSZ.db.gz.
 */

export type BackupConfig = {
  enabled: boolean;
  dir: string;
  retentionDays: number;
  /** Daily run time, server local time, "HH:MM". */
  time: string;
};

export function backupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  const time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(env.BACKUP_TIME ?? '') ? env.BACKUP_TIME! : '02:15';
  return {
    enabled: env.BACKUP_ENABLED ? env.BACKUP_ENABLED !== 'false' : env.NODE_ENV === 'production',
    dir: env.BACKUP_DIR || path.join(dataDir, 'backups'),
    retentionDays: Math.max(1, Number(env.BACKUP_RETENTION_DAYS) || 30),
    time,
  };
}

/** Backups older than the retention period are deleted, but never the newest few. */
export const KEEP_AT_LEAST = 7;
const NAME = /^encalm-(\d{8}T\d{6}Z)\.db\.gz$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupFile = { name: string; size: number; createdAt: string };
export type BackupResult =
  | { ok: true; file: string; size: number; projects: number; photosCopied: number; at: string }
  | { ok: false; error: string; at: string };

let last: BackupResult | null = null;
let running: Promise<BackupResult> | null = null;
let timer: NodeJS.Timeout | null = null;

const stampOf = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
const fromStamp = (s: string) =>
  new Date(
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`,
  );

/** Database backups in `dir`, newest first. */
export function listBackups(dir: string): BackupFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => ({ name, match: NAME.exec(name) }))
    .filter((f): f is { name: string; match: RegExpExecArray } => Boolean(f.match))
    .map(({ name, match }) => ({
      name,
      size: fs.statSync(path.join(dir, name)).size,
      createdAt: fromStamp(match[1]).toISOString(),
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Copies photos that are not in the mirror yet. Photos never change, and nothing is deleted from the mirror. */
export function mirrorUploads(from: string, to: string): number {
  if (!fs.existsSync(from)) return 0;
  let copied = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copied += mirrorUploads(src, dest);
    } else if (entry.isFile() && !fs.existsSync(dest)) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(src, `${dest}.part`);
      fs.renameSync(`${dest}.part`, dest);
      copied++;
    }
  }
  return copied;
}

/** Deletes backups older than the retention period, always keeping the newest KEEP_AT_LEAST. */
export function pruneBackups(dir: string, retentionDays: number, now = Date.now()): string[] {
  const removed: string[] = [];
  for (const file of listBackups(dir).slice(KEEP_AT_LEAST)) {
    if (now - new Date(file.createdAt).getTime() > retentionDays * DAY_MS) {
      fs.rmSync(path.join(dir, file.name), { force: true });
      removed.push(file.name);
    }
  }
  return removed;
}

/**
 * Makes the copy a single self-contained file (no -wal/-shm side files) and
 * checks it is a sound, complete database. Returns its project count.
 */
function verifyCopy(file: string): number {
  const copy = new Database(file, { fileMustExist: true });
  try {
    copy.pragma('journal_mode = DELETE');
    const integrity = copy.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`Backup failed its integrity check: ${String(integrity)}`);
    return (copy.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n;
  } finally {
    copy.close();
  }
}

async function makeBackup(cfg: BackupConfig, now: Date): Promise<BackupResult> {
  fs.mkdirSync(cfg.dir, { recursive: true });
  const name = `encalm-${stampOf(now)}.db.gz`;
  const final = path.join(cfg.dir, name);
  const tmp = path.join(cfg.dir, `.tmp-${stampOf(now)}.db`);
  const lock = path.join(cfg.dir, '.backup.lock');

  // Another process (or a stuck run) may hold the folder; a lock older than an hour is stale.
  try {
    if (Date.now() - fs.statSync(lock).mtimeMs > 60 * 60 * 1000) fs.rmSync(lock, { force: true });
  } catch {
    // No lock.
  }
  let fd: number;
  try {
    fd = fs.openSync(lock, 'wx');
  } catch {
    throw new Error('Another backup is already running');
  }

  try {
    if (fs.existsSync(final)) throw new Error(`A backup named ${name} already exists; try again in a second`);
    await db.backup(tmp);
    const projects = verifyCopy(tmp);
    await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 9 }), fs.createWriteStream(`${final}.part`));
    fs.renameSync(`${final}.part`, final);
    const photosCopied = mirrorUploads(uploadsDir, path.join(cfg.dir, 'uploads'));
    pruneBackups(cfg.dir, cfg.retentionDays, now.getTime());
    return { ok: true, file: name, size: fs.statSync(final).size, projects, photosCopied, at: now.toISOString() };
  } finally {
    for (const leftover of [tmp, `${tmp}-wal`, `${tmp}-shm`, `${tmp}-journal`, `${final}.part`]) {
      fs.rmSync(leftover, { force: true });
    }
    fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}

/** Makes one backup now. Never throws: the result says what happened. */
export function runBackup(cfg: BackupConfig = backupConfig(), now = new Date()): Promise<BackupResult> {
  if (running) return running;
  running = makeBackup(cfg, now)
    .then((result) => {
      logger.info(
        { file: result.ok ? result.file : undefined, projects: result.ok ? result.projects : undefined },
        '[Backup] Database backed up',
      );
      return result;
    })
    .catch((err: unknown): BackupResult => {
      const error = (err instanceof Error && err.message) || 'Backup failed';
      logger.error({ err }, '[Backup] Backup failed');
      captureError(err, { area: 'backup' });
      return { ok: false, error, at: now.toISOString() };
    })
    .then((result) => {
      last = result;
      return result;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** The latest run in this process, and the backups on disk. */
export function backupStatus(cfg: BackupConfig = backupConfig()) {
  const files = listBackups(cfg.dir);
  return {
    enabled: cfg.enabled,
    time: cfg.time,
    retentionDays: cfg.retentionDays,
    lastRun: last,
    newest: files[0] ?? null,
    count: files.length,
    backups: files.slice(0, 10),
  };
}

/** Milliseconds from `now` until the next HH:MM, local time. */
export function msUntil(time: string, now = new Date()): number {
  const [h, m] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** True when there is no backup from the last 24 hours. */
export function backupIsDue(cfg: BackupConfig, now = Date.now()): boolean {
  const newest = listBackups(cfg.dir)[0];
  return !newest || now - new Date(newest.createdAt).getTime() > DAY_MS;
}

/**
 * Runs a backup every day at the configured time, plus one shortly after start
 * when the newest backup is more than a day old (the server was off at the time).
 */
export function startBackupScheduler(cfg: BackupConfig = backupConfig(), catchUpDelayMs = 5 * 60 * 1000): void {
  if (!cfg.enabled || timer) return;
  const schedule = (delay: number) => {
    timer = setTimeout(() => {
      void runBackup(cfg).finally(() => {
        if (timer) schedule(msUntil(cfg.time));
      });
    }, delay);
    timer.unref();
  };
  schedule(backupIsDue(cfg) ? catchUpDelayMs : msUntil(cfg.time));
  logger.info({ dir: cfg.dir, time: cfg.time }, '[Backup] Daily backups scheduled');
}

export function stopBackupScheduler(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
