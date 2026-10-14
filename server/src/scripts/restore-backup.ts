/**
 * Restores the database from one of the app's backups. Stop the app first.
 *
 *   node server/dist/restore-backup.js <path to encalm-YYYYMMDDTHHMMSSZ.db.gz>
 *
 * Uses DATA_DIR / DATABASE_PATH from the environment or .env, like the app.
 * The current database is renamed to *.before-restore-<time>, not deleted.
 */
import '../env.js';
import path from 'node:path';
import { restoreBackup } from '../utils/restore-backup.js';
import { defaultDataDir } from '../paths.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node server/dist/restore-backup.js <backup file (.db.gz)>');
  process.exit(2);
}

const dataDir = process.env.DATA_DIR || defaultDataDir;
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'encalm.db');

try {
  const result = await restoreBackup(path.resolve(file), { dataDir, dbPath });
  console.log(`Restored ${result.restoredFrom} (${result.projects} projects) into ${dbPath}.`);
  if (result.movedAside.length) console.log(`The previous database was kept as: ${result.movedAside.join(', ')}`);
  console.log('Start the app again (Plesk: Enable Node.js, then Restart App).');
} catch (err) {
  console.error(`Restore failed: ${(err as Error).message}`);
  process.exitCode = 1;
}
