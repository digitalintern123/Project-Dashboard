import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { migrationsDir } from '../paths.js';
import type Database from 'better-sqlite3';
import { logger } from '../logger.js';

/**
 * Versioned schema migrations.
 *
 * Migrations are SQL files in ./migrations named NNN_description.sql. Each runs
 * once, in its own transaction, and is recorded in schema_migrations with a
 * checksum. Never edit an applied migration: add a new one.
 *
 * A migration whose first line is `-- migrate:foreign-keys-off` runs with
 * foreign keys disabled (needed to rebuild a table that others reference) and
 * must leave `PRAGMA foreign_key_check` clean.
 */

export const MIGRATIONS_DIR = migrationsDir;

type MigrationFile = { version: number; name: string; sql: string; checksum: string };

export function loadMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .map((file) => /^(\d{3})_([a-z0-9_]+)\.sql$/.exec(file))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => {
      const sql = fs.readFileSync(path.join(dir, m[0]), 'utf-8');
      return {
        version: Number(m[1]),
        name: m[2],
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      };
    })
    .sort((a, b) => a.version - b.version);
}

function columnsOf(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

function tableSql(db: Database.Database, table: string): string {
  return (
    (
      db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as
        { sql?: string } | undefined
    )?.sql ?? ''
  );
}

/** The CREATE TABLE statement for a table as written in a migration file. */
function createStatementFrom(sql: string, table: string): string {
  const match = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`).exec(sql);
  if (!match) throw new Error(`No CREATE TABLE for ${table} in migration`);
  return match[0];
}

/**
 * Rebuilds a table with a new definition, keeping its rows, using SQLite's
 * documented procedure: foreign keys off, create the new table, copy the shared
 * columns, drop the old table, rename, then verify foreign keys. Renaming the old
 * table instead would rewrite other tables' foreign keys to point at it, and
 * dropping it would then break them.
 */
export function rebuildTable(db: Database.Database, table: string, createSql: string) {
  const tempName = `${table}__rebuild`;
  const createTemp = createSql.replace(
    new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\b`),
    `CREATE TABLE ${tempName}`,
  );

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`DROP TABLE IF EXISTS ${tempName}`);
      db.exec(createTemp);
      const newColumns = new Set(columnsOf(db, tempName));
      const shared = columnsOf(db, table)
        .filter((c) => newColumns.has(c))
        .join(', ');
      db.exec(`INSERT INTO ${tempName} (${shared}) SELECT ${shared} FROM ${table}`);
      db.exec(`DROP TABLE ${table}`);
      db.exec(`ALTER TABLE ${tempName} RENAME TO ${table}`);
      const problems = db.pragma('foreign_key_check') as unknown[];
      if (problems.length > 0) {
        throw new Error(`Foreign key check failed after rebuilding ${table}: ${JSON.stringify(problems.slice(0, 5))}`);
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/**
 * Brings a database created before versioned migrations up to the shape of
 * 001_initial: adds columns introduced over time and rebuilds tables whose CHECK
 * constraints changed. A no-op on a database created by 001.
 */
export function adoptLegacySchema(db: Database.Database, initialSql: string) {
  const addColumns: Record<string, [string, string][]> = {
    users: [
      ['must_change_password', 'INTEGER NOT NULL DEFAULT 0'],
      ['token_version', 'INTEGER NOT NULL DEFAULT 0'],
      ['failed_attempts', 'INTEGER NOT NULL DEFAULT 0'],
      ['locked_until', 'TEXT'],
    ],
    projects: [
      ['status', "TEXT NOT NULL DEFAULT 'Yet to start'"],
      ['projected_cost', 'REAL NOT NULL DEFAULT 0'],
      ['area', 'TEXT'],
      ['pax_keys', 'TEXT'],
    ],
    phases: [
      ['weight', 'REAL'],
      ['tagged_users', 'TEXT'],
      ['budget', 'REAL'],
    ],
    milestones: [['tagged_users', 'TEXT']],
    issues: [['tagged_users', 'TEXT']],
    notifications: [['recipient_id', 'TEXT']],
    photos: [['thumbnail_url', 'TEXT']],
  };

  db.transaction(() => {
    for (const [table, columns] of Object.entries(addColumns)) {
      const existing = new Set(columnsOf(db, table));
      for (const [name, type] of columns) {
        if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      }
    }
    // Legacy phase name
    db.prepare(
      "UPDATE phases SET name = 'Execution' WHERE name IN ('Build & install', 'Build and install', 'Build & installation')",
    ).run();
  })();

  // CHECK constraints only change by rebuilding the table.
  const usersSql = tableSql(db, 'users');
  if (!usersSql.includes('stakeholder') || !usersSql.includes('coordinator')) {
    rebuildTable(db, 'users', createStatementFrom(initialSql, 'users'));
    logger.info('✓ Migrated users table to support coordinator and stakeholder roles.');
  }
  if (!tableSql(db, 'projects').includes("'On Hold'")) {
    rebuildTable(db, 'projects', createStatementFrom(initialSql, 'projects'));
    logger.info("✓ Migrated projects table to allow the 'On Hold' status.");
  }
}

/** Applies every pending migration. Safe to call repeatedly. */
export function runMigrations(db: Database.Database, dir = MIGRATIONS_DIR): number[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const applied = new Map(
    (
      db.prepare('SELECT version, checksum FROM schema_migrations').all() as { version: number; checksum: string }[]
    ).map((r) => [r.version, r.checksum]),
  );
  const record = db.prepare('INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)');
  const ran: number[] = [];

  for (const migration of loadMigrations(dir)) {
    const previous = applied.get(migration.version);
    if (previous !== undefined) {
      if (previous !== migration.checksum) {
        logger.warn(
          `[Migrations] ${migration.version}_${migration.name}.sql changed after it was applied. Add a new migration instead.`,
        );
      }
      continue;
    }

    const foreignKeysOff = migration.sql.startsWith('-- migrate:foreign-keys-off');
    if (foreignKeysOff) db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        db.exec(migration.sql);
        if (foreignKeysOff) {
          const problems = db.pragma('foreign_key_check') as unknown[];
          if (problems.length > 0) throw new Error(`Foreign key check failed: ${JSON.stringify(problems.slice(0, 5))}`);
        }
      })();
      if (migration.version === 1 && migration.name === 'initial') adoptLegacySchema(db, migration.sql);
      record.run(migration.version, migration.name, migration.checksum);
    } finally {
      if (foreignKeysOff) db.pragma('foreign_keys = ON');
    }
    ran.push(migration.version);
    logger.info(`✓ Applied migration ${String(migration.version).padStart(3, '0')}_${migration.name}`);
  }
  return ran;
}
