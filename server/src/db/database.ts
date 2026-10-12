import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * ============================================================================
 * ARCHITECTURAL SINGLE SOURCE OF TRUTH (SSOT)
 * ============================================================================
 * The SQLite Database (`encalm.db`) is the canonical, authoritative master for
 * all portfolio data (projects, phases, milestones, issues, photos, updates,
 * notifications, and user authentications).
 *
 * Secondary artifacts (`portfolio-database.json` and client bundle fallbacks)
 * are derived point-in-time snapshots and must never override live database records.
 * ============================================================================
 */
export const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'encalm.db');
export const db = new Database(dbPath);

// Performance & data integrity pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('busy_timeout = 5000');

/** Creates or upgrades the schema by applying pending migrations (db/migrations). */
export function initDatabase() {
  runMigrations(db);
}
