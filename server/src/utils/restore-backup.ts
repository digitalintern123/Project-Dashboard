import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import Database from 'better-sqlite3';
import { isAppRunning } from './app-lock.js';

export type RestoreResult = { restoredFrom: string; movedAside: string[]; projects: number };

/**
 * Replaces the database with a backup (.db.gz or .db). Must run with the app
 * stopped. The current database files are renamed, never deleted, so the
 * restore itself can be undone.
 */
export async function restoreBackup(
  backupFile: string,
  { dataDir, dbPath, now = new Date() }: { dataDir: string; dbPath: string; now?: Date },
): Promise<RestoreResult> {
  if (!fs.existsSync(backupFile)) throw new Error(`Backup not found: ${backupFile}`);
  if (isAppRunning(dataDir)) {
    throw new Error('The app is running. Stop it first (Plesk: Disable Node.js), then run the restore again.');
  }

  const tmp = `${dbPath}.restore-tmp`;
  fs.rmSync(tmp, { force: true });
  try {
    if (backupFile.endsWith('.gz')) {
      await pipeline(fs.createReadStream(backupFile), zlib.createGunzip(), fs.createWriteStream(tmp));
    } else {
      fs.copyFileSync(backupFile, tmp);
    }
    const copy = new Database(tmp, { readonly: true, fileMustExist: true });
    let projects: number;
    try {
      const integrity = copy.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') throw new Error(`The backup failed its integrity check: ${String(integrity)}`);
      projects = (copy.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n;
    } finally {
      copy.close();
    }

    const suffix = `.before-restore-${now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z')}`;
    const movedAside: string[] = [];
    for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
      if (fs.existsSync(file)) {
        fs.renameSync(file, `${file}${suffix}`);
        movedAside.push(path.basename(`${file}${suffix}`));
      }
    }
    fs.renameSync(tmp, dbPath);
    return { restoredFrom: path.basename(backupFile), movedAside, projects };
  } finally {
    for (const leftover of [tmp, `${tmp}-wal`, `${tmp}-shm`]) fs.rmSync(leftover, { force: true });
  }
}
