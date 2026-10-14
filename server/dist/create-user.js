// server/src/env.ts
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env", quiet: true });

// server/src/db/database.ts
import Database from "better-sqlite3";
import path3 from "node:path";
import fs3 from "node:fs";

// server/src/paths.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function findProjectRoot(start) {
  let dir = start;
  for (; ; ) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Could not find the project root above ${start}`);
    dir = parent;
  }
}
var here = path.dirname(fileURLToPath(import.meta.url));
var projectRoot = findProjectRoot(here);
var defaultDataDir = path.join(projectRoot, "server", "data");
var clientDistDir = path.join(projectRoot, "dist");
var migrationsDir = fs.existsSync(path.join(here, "migrations")) ? path.join(here, "migrations") : path.join(projectRoot, "server", "src", "db", "migrations");

// server/src/db/migrate.ts
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// server/src/logger.ts
import pino from "pino";
var env = process.env.NODE_ENV || "development";
var REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  ...[
    "password",
    "currentPassword",
    "newPassword",
    "temporaryPassword",
    "password_hash",
    "pass",
    "clientSecret",
    "secret",
    "token",
    "accessToken",
    "refreshToken"
  ].flatMap((key) => [key, `*.${key}`, `*.*.${key}`])
];
function destination() {
  if (env === "production" || process.env.LOG_FORMAT === "json" || !process.stdout.isTTY) return void 0;
  return { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } };
}
var logger = pino({
  level: process.env.LOG_LEVEL || (env === "test" ? "silent" : "info"),
  base: { service: "encalm-dashboard", env },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  transport: destination()
});

// server/src/db/migrate.ts
var MIGRATIONS_DIR = migrationsDir;
function loadMigrations(dir = MIGRATIONS_DIR) {
  return fs2.readdirSync(dir).map((file) => /^(\d{3})_([a-z0-9_]+)\.sql$/.exec(file)).filter((m) => m !== null).map((m) => {
    const sql = fs2.readFileSync(path2.join(dir, m[0]), "utf-8");
    return {
      version: Number(m[1]),
      name: m[2],
      sql,
      checksum: crypto.createHash("sha256").update(sql).digest("hex")
    };
  }).sort((a, b) => a.version - b.version);
}
function columnsOf(db2, table) {
  return db2.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}
function tableSql(db2, table) {
  return db2.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)?.sql ?? "";
}
function createStatementFrom(sql, table) {
  const match = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`).exec(sql);
  if (!match) throw new Error(`No CREATE TABLE for ${table} in migration`);
  return match[0];
}
function rebuildTable(db2, table, createSql) {
  const tempName = `${table}__rebuild`;
  const createTemp = createSql.replace(
    new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\b`),
    `CREATE TABLE ${tempName}`
  );
  db2.pragma("foreign_keys = OFF");
  try {
    db2.transaction(() => {
      db2.exec(`DROP TABLE IF EXISTS ${tempName}`);
      db2.exec(createTemp);
      const newColumns = new Set(columnsOf(db2, tempName));
      const shared = columnsOf(db2, table).filter((c) => newColumns.has(c)).join(", ");
      db2.exec(`INSERT INTO ${tempName} (${shared}) SELECT ${shared} FROM ${table}`);
      db2.exec(`DROP TABLE ${table}`);
      db2.exec(`ALTER TABLE ${tempName} RENAME TO ${table}`);
      const problems = db2.pragma("foreign_key_check");
      if (problems.length > 0) {
        throw new Error(`Foreign key check failed after rebuilding ${table}: ${JSON.stringify(problems.slice(0, 5))}`);
      }
    })();
  } finally {
    db2.pragma("foreign_keys = ON");
  }
}
function adoptLegacySchema(db2, initialSql) {
  const addColumns = {
    users: [
      ["must_change_password", "INTEGER NOT NULL DEFAULT 0"],
      ["token_version", "INTEGER NOT NULL DEFAULT 0"],
      ["failed_attempts", "INTEGER NOT NULL DEFAULT 0"],
      ["locked_until", "TEXT"]
    ],
    projects: [
      ["status", "TEXT NOT NULL DEFAULT 'Yet to start'"],
      ["projected_cost", "REAL NOT NULL DEFAULT 0"],
      ["area", "TEXT"],
      ["pax_keys", "TEXT"]
    ],
    phases: [
      ["weight", "REAL"],
      ["tagged_users", "TEXT"],
      ["budget", "REAL"]
    ],
    milestones: [["tagged_users", "TEXT"]],
    issues: [["tagged_users", "TEXT"]],
    notifications: [["recipient_id", "TEXT"]],
    photos: [["thumbnail_url", "TEXT"]]
  };
  db2.transaction(() => {
    for (const [table, columns] of Object.entries(addColumns)) {
      const existing = new Set(columnsOf(db2, table));
      for (const [name2, type] of columns) {
        if (!existing.has(name2)) db2.exec(`ALTER TABLE ${table} ADD COLUMN ${name2} ${type}`);
      }
    }
    db2.prepare(
      "UPDATE phases SET name = 'Execution' WHERE name IN ('Build & install', 'Build and install', 'Build & installation')"
    ).run();
  })();
  const usersSql = tableSql(db2, "users");
  if (!usersSql.includes("stakeholder") || !usersSql.includes("coordinator")) {
    rebuildTable(db2, "users", createStatementFrom(initialSql, "users"));
    logger.info("\u2713 Migrated users table to support coordinator and stakeholder roles.");
  }
  if (!tableSql(db2, "projects").includes("'On Hold'")) {
    rebuildTable(db2, "projects", createStatementFrom(initialSql, "projects"));
    logger.info("\u2713 Migrated projects table to allow the 'On Hold' status.");
  }
}
function runMigrations(db2, dir = MIGRATIONS_DIR) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  const applied = new Map(
    db2.prepare("SELECT version, checksum FROM schema_migrations").all().map((r) => [r.version, r.checksum])
  );
  const record = db2.prepare("INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)");
  const ran = [];
  for (const migration of loadMigrations(dir)) {
    const previous = applied.get(migration.version);
    if (previous !== void 0) {
      if (previous !== migration.checksum) {
        logger.warn(
          `[Migrations] ${migration.version}_${migration.name}.sql changed after it was applied. Add a new migration instead.`
        );
      }
      continue;
    }
    const foreignKeysOff = migration.sql.startsWith("-- migrate:foreign-keys-off");
    if (foreignKeysOff) db2.pragma("foreign_keys = OFF");
    try {
      db2.transaction(() => {
        db2.exec(migration.sql);
        if (foreignKeysOff) {
          const problems = db2.pragma("foreign_key_check");
          if (problems.length > 0) throw new Error(`Foreign key check failed: ${JSON.stringify(problems.slice(0, 5))}`);
        }
      })();
      if (migration.version === 1 && migration.name === "initial") adoptLegacySchema(db2, migration.sql);
      record.run(migration.version, migration.name, migration.checksum);
    } finally {
      if (foreignKeysOff) db2.pragma("foreign_keys = ON");
    }
    ran.push(migration.version);
    logger.info(`\u2713 Applied migration ${String(migration.version).padStart(3, "0")}_${migration.name}`);
  }
  return ran;
}

// server/src/db/database.ts
var dataDir = process.env.DATA_DIR || defaultDataDir;
if (!fs3.existsSync(dataDir)) {
  fs3.mkdirSync(dataDir, { recursive: true });
}
var uploadsDir = path3.join(dataDir, "uploads");
if (!fs3.existsSync(uploadsDir)) {
  fs3.mkdirSync(uploadsDir, { recursive: true });
}
var dbPath = process.env.DATABASE_PATH || path3.join(dataDir, "encalm.db");
var db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");
db.pragma("cache_size = -64000");
db.pragma("busy_timeout = 5000");
function initDatabase() {
  runMigrations(db);
}

// server/src/utils/passwords.ts
import bcrypt from "bcryptjs";
var BCRYPT_COST = 12;
var MIN_PASSWORD_LENGTH = 10;
function checkPasswordPolicy(password2) {
  if (typeof password2 !== "string" || password2.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password2.length > 200) {
    return "Password must be at most 200 characters long.";
  }
  if (!/[A-Za-z]/.test(password2) || !/[0-9]/.test(password2)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}
function hashPassword(password2) {
  return bcrypt.hashSync(password2, BCRYPT_COST);
}

// server/src/scripts/create-user.ts
var args = process.argv.slice(2);
if (args.length < 3) {
  console.log(`
=====================================================
  Encalm Project Dashboard \u2014 User & Password Tool
=====================================================

Usage:
  npm run create-user -- "<Name>" "<Email>" "<Password>" [role] [title]

Arguments:
  Name      : Full name of the user (e.g. "Amit Sharma")
  Email     : Corporate email (e.g. "amit@encalm.com")
  Password  : Temporary password (min 10 chars, letters and numbers);
              the user must change it at first sign-in
  Role      : One of 'lead', 'coordinator', 'hod', 'viewer' (Default: 'lead')
              viewer = strictly view-only (no edits, tagging or emails)
  Title     : Job title (Default: 'Project Lead', 'Project Coordinator', 'Project HOD' or 'Viewer')

Examples:
  npm run create-user -- "Amit Sharma" "amit@encalm.com" "<temporary-password>" "lead" "Project Lead"
  npm run create-user -- "Priya Verma" "priya@encalm.com" "<temporary-password>" "coordinator" "Project Coordinator"
  npm run create-user -- "Executive User" "director@encalm.com" "<temporary-password>" "hod" "Director - PMO"
=====================================================
`);
  process.exit(1);
}
var name = args[0].trim();
var email = args[1].trim().toLowerCase();
var password = args[2].trim();
var roleInput = (args[3] || "lead").trim().toLowerCase();
var ROLES = ["coordinator", "lead", "hod", "viewer"];
if (!ROLES.includes(roleInput)) {
  console.error(`\u274C Unknown role "${roleInput}". Use one of: ${ROLES.join(", ")}.`);
  process.exit(1);
}
var role = roleInput;
var defaultTitles = {
  hod: "Project HOD",
  coordinator: "Project Coordinator",
  lead: "Project Lead",
  viewer: "Viewer"
};
var title = args[4] && args[4].trim() || defaultTitles[role] || "Project Lead";
var parts = name.split(/\s+/).filter(Boolean);
var initials = "PL";
if (parts.length >= 2) {
  initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
} else if (parts.length === 1 && parts[0].length >= 2) {
  initials = parts[0].substring(0, 2).toUpperCase();
}
var id = `user-${role}-${Date.now()}`;
var policyError = checkPasswordPolicy(password);
if (policyError) {
  console.error(`\u274C ${policyError}`);
  process.exit(1);
}
var passwordHash = hashPassword(password);
initDatabase();
try {
  const existing = db.prepare("SELECT id, email, role FROM users WHERE LOWER(email) = ?").get(email);
  if (existing) {
    db.prepare(
      `
      UPDATE users
      SET name = ?, role = ?, title = ?, initials = ?, password_hash = ?, must_change_password = 1
      WHERE LOWER(email) = ?
    `
    ).run(name, role, title, initials, passwordHash, email);
    console.log(`
\u2705 User "${email}" updated successfully!`);
    console.log(`   Name:     ${name}`);
    console.log(`   Role:     ${role}`);
    console.log(`   Title:    ${title}`);
    console.log(`   Password: (updated)
`);
  } else {
    db.prepare(
      `
      INSERT INTO users (id, name, email, role, title, initials, password_hash, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `
    ).run(id, name, email, role, title, initials, passwordHash);
    console.log(`
\u2705 User "${email}" created successfully!`);
    console.log(`   ID:       ${id}`);
    console.log(`   Name:     ${name}`);
    console.log(`   Role:     ${role}`);
    console.log(`   Title:    ${title}`);
    console.log(`   Initials: ${initials}
`);
  }
} catch (err) {
  console.error("\u274C Failed to create/update user:", err instanceof Error ? err.message : err);
  process.exit(1);
}
//# sourceMappingURL=create-user.js.map
