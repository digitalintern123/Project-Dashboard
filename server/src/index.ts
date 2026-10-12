import './env.js';
import type { Server } from 'node:http';
import { assertProductionConfig } from './config.js';
import { db, initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { autoRestoreSnapshotIfEmpty, saveDatabaseSnapshot } from './utils/backup.js';
import { createApp } from './app.js';
import { fanOutLegacyNotifications } from './utils/notify.js';
import { pruneExpiredRefreshTokens } from './utils/session.js';
import { encryptPlaintextSettings, startEmailWorker, stopEmailWorker } from './services/email.js';
import { logger } from './logger.js';
import { appRelease, captureError, flushSentry, initSentry } from './sentry.js';
import { listenTarget } from './listen.js';

assertProductionConfig();

const target = listenTarget();

const app = createApp();

// 12. Lifecycle & Server Startup
let server: Server | null = null;

async function startServer() {
  try {
    await initSentry();
    initDatabase();
    seedDatabase(false);
    autoRestoreSnapshotIfEmpty();
    fanOutLegacyNotifications();
    pruneExpiredRefreshTokens();
    encryptPlaintextSettings();
    startEmailWorker();

    const onListening = () => logger.info({ ...target, release: appRelease() }, 'Encalm Project Dashboard listening');
    server =
      'pipe' in target ? app.listen(target.pipe, onListening) : app.listen(target.port, target.host, onListening);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    captureError(err);
    await flushSentry();
    process.exit(1);
  }
}

// 13. Graceful Shutdown & Disaster Prevention
let shuttingDown = false;

function gracefulShutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');
  stopEmailWorker();

  const exit = (code: number) => void flushSentry().finally(() => process.exit(code));

  if (server) {
    server.close(() => {
      try {
        // Checkpoint the WAL and write the recovery snapshot before closing.
        db.pragma('wal_checkpoint(TRUNCATE)');
        saveDatabaseSnapshot();
        db.close();
        logger.info('Database closed; shutdown complete');
      } catch (err) {
        logger.error({ err }, 'Error closing the database during shutdown');
      }
      exit(exitCode);
    });

    // Force exit if connections do not close in 10s
    setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 10000).unref();
  } else {
    exit(exitCode);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  captureError(reason);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  captureError(err);
  gracefulShutdown('uncaughtException', 1);
});

void startServer();
