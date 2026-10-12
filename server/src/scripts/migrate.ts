/**
 * Applies pending database migrations and exits. The deploy script runs this
 * before switching releases, so a failing migration stops the deploy while the
 * old release is still serving. The server also migrates on start, so this is
 * optional when running by hand.
 */
import '../env.js';
import { db, dataDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { logger } from '../logger.js';

try {
  const applied = runMigrations(db);
  const current = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null };
  logger.info(
    { dataDir, applied, schemaVersion: current.v },
    applied.length ? 'Migrations applied' : 'Schema up to date',
  );
  db.close();
} catch (err) {
  logger.fatal({ err, dataDir }, 'Migration failed');
  process.exitCode = 1;
}
