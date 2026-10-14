import fs from 'node:fs';
import path from 'node:path';

/**
 * A marker file that says "the app is running against this data folder", so
 * offline tools (the restore helper) refuse to swap the database under it.
 */
const lockPath = (dataDir: string) => path.join(dataDir, '.app.lock');

export function writeAppLock(dataDir: string): void {
  fs.writeFileSync(lockPath(dataDir), String(process.pid));
}

export function releaseAppLock(dataDir: string): void {
  try {
    if (fs.readFileSync(lockPath(dataDir), 'utf8').trim() === String(process.pid)) fs.rmSync(lockPath(dataDir));
  } catch {
    // Already gone.
  }
}

/** True when a live process holds the lock. A lock left by a crashed process does not count. */
export function isAppRunning(dataDir: string): boolean {
  let pid: number;
  try {
    pid = Number(fs.readFileSync(lockPath(dataDir), 'utf8').trim());
  } catch {
    return false;
  }
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
