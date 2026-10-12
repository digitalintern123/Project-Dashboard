import 'dotenv/config';
import { assertProductionConfig } from './config.js';
import { db, initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { autoRestoreSnapshotIfEmpty, saveDatabaseSnapshot } from './utils/backup.js';
import { createApp } from './app.js';
import { fanOutLegacyNotifications } from './utils/notify.js';
import { pruneExpiredRefreshTokens } from './utils/session.js';
import { encryptPlaintextSettings, startEmailWorker, stopEmailWorker } from './services/email.js';

assertProductionConfig();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(
  process.env.API_PORT ||
    process.env.BACKEND_PORT ||
    (isProduction && process.env.PORT && process.env.PORT !== '5173' ? process.env.PORT : 5000),
);

const app = createApp();

// 12. Lifecycle & Server Startup
let server: any = null;

async function startServer() {
  try {
    initDatabase();
    seedDatabase(false);
    autoRestoreSnapshotIfEmpty();
    fanOutLegacyNotifications();
    pruneExpiredRefreshTokens();
    encryptPlaintextSettings();
    startEmailWorker();

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(` Encalm Project Dashboard Server [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
      console.log(` Port:    http://0.0.0.0:${PORT}`);
      console.log(` Health:  http://localhost:${PORT}/api/system/health`);
      console.log(` Ready:   http://localhost:${PORT}/api/system/ready`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 13. Graceful Shutdown & Disaster Prevention
let shuttingDown = false;

function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[Process] ${signal} signal received. Commencing graceful shutdown...`);

  stopEmailWorker();

  if (server) {
    server.close(() => {
      console.log('[Process] HTTP server closed.');
      try {
        console.log('[Process] Checkpointing SQLite WAL and saving recovery snapshot...');
        db.pragma('wal_checkpoint(TRUNCATE)');
        saveDatabaseSnapshot();
        db.close();
        console.log('[Process] SQLite database safely closed.');
      } catch (dbErr) {
        console.error('[Process] Error closing database during shutdown:', dbErr);
      }
      process.exit(0);
    });

    // Force exit if connections do not close in 10s
    setTimeout(() => {
      console.error('[Process] Graceful shutdown timed out. Forcing process termination.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception thrown:', error);
  gracefulShutdown('uncaughtException');
});

startServer();
