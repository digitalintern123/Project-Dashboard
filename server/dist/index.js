// server/src/env.ts
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env", quiet: true });

// server/src/utils/secrets.ts
import crypto from "node:crypto";

// server/src/logger.ts
import { randomUUID } from "node:crypto";
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
var REQUEST_ID = /^[A-Za-z0-9._-]{1,100}$/;
function requestId(req, res) {
  const incoming = req.headers["x-request-id"];
  const id2 = typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", id2);
  return id2;
}

// server/src/utils/secrets.ts
var PREFIX = "enc:v1:";
var DEV_KEY_SEED = "encalm-development-settings-key";
var ENCRYPTED_SETTING_KEYS = ["smtp_pass", "graph_client_secret"];
var warnedDevKey = false;
function parseSettingsKey(raw) {
  if (!raw) return null;
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 ? decoded : null;
}
function settingsKey() {
  const key = parseSettingsKey(process.env.SETTINGS_ENCRYPTION_KEY);
  if (key) return key;
  if (!warnedDevKey) {
    warnedDevKey = true;
    logger.warn("[Secrets] SETTINGS_ENCRYPTION_KEY not set; using a development-only key.");
  }
  return crypto.createHash("sha256").update(DEV_KEY_SEED).digest();
}
function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}
function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", settingsKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}
function decryptSecret(stored) {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored;
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", settingsKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    logger.error(
      "[Secrets] Could not decrypt a stored secret. Was SETTINGS_ENCRYPTION_KEY changed? Re-enter it in Email settings."
    );
    return "";
  }
}

// server/src/config.ts
var KNOWN_DEFAULT_JWT_SECRETS = [
  "encalm-secret-jwt-key-2026",
  "encalm-secure-prod-jwt-key-change-me",
  "replace-with-a-strong-random-secret-key-32-chars-minimum",
  "changeme",
  "secret"
];
var MIN_JWT_SECRET_LENGTH = 32;
function productionConfigErrors(env2 = process.env) {
  if (env2.NODE_ENV !== "production") return [];
  const errors = [];
  const secret = env2.JWT_SECRET;
  if (!secret) {
    errors.push("JWT_SECRET is not set.");
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`);
  } else if (KNOWN_DEFAULT_JWT_SECRETS.includes(secret)) {
    errors.push("JWT_SECRET is set to a known default value.");
  }
  if (!parseSettingsKey(env2.SETTINGS_ENCRYPTION_KEY)) {
    errors.push("SETTINGS_ENCRYPTION_KEY must be 32 random bytes, base64 or hex encoded (openssl rand -base64 32).");
  }
  return errors;
}
function assertProductionConfig() {
  const errors = productionConfigErrors();
  if (errors.length > 0) {
    for (const e of errors) logger.error(`[Config] FATAL: ${e}`);
    logger.error(
      "[Config] Generate secrets with: openssl rand -base64 48 (JWT_SECRET), openssl rand -base64 32 (SETTINGS_ENCRYPTION_KEY)"
    );
    process.exit(1);
  }
}
function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
function publicBaseUrl(req) {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const served = `${req.protocol}://${req.get("host")}`;
  const origin = req.get("origin");
  if (origin && process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return served;
}

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
import crypto2 from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
var MIGRATIONS_DIR = migrationsDir;
function loadMigrations(dir = MIGRATIONS_DIR) {
  return fs2.readdirSync(dir).map((file) => /^(\d{3})_([a-z0-9_]+)\.sql$/.exec(file)).filter((m) => m !== null).map((m) => {
    const sql = fs2.readFileSync(path2.join(dir, m[0]), "utf-8");
    return {
      version: Number(m[1]),
      name: m[2],
      sql,
      checksum: crypto2.createHash("sha256").update(sql).digest("hex")
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
      for (const [name, type] of columns) {
        if (!existing.has(name)) db2.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
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

// src/data/users.ts
var DEFAULT_HOD_ID = "user-ruchika-chauhan";
var DEFAULT_COORDINATOR_ID = "user-praveen-pal";
var users = [
  {
    id: DEFAULT_HOD_ID,
    name: "Ruchika Chauhan",
    email: "hod@encalm.com",
    role: "hod",
    title: "Project HOD",
    initials: "RC"
  },
  {
    id: DEFAULT_COORDINATOR_ID,
    name: "Praveen Pal",
    email: "digital.intern@encalm.com",
    role: "coordinator",
    title: "Project Coordinator",
    initials: "PP"
  }
];

// server/src/utils/passwords.ts
import crypto3 from "node:crypto";
import bcrypt from "bcryptjs";
var BCRYPT_COST = 12;
var MIN_PASSWORD_LENGTH = 10;
function checkPasswordPolicy(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > 200) {
    return "Password must be at most 200 characters long.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}
function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_COST);
}
function verifyPassword(password, hash) {
  if (!hash || typeof password !== "string") return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  for (; ; ) {
    const bytes = crypto3.randomBytes(16);
    const candidate = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    if (checkPasswordPolicy(candidate) === null) return candidate;
  }
}

// server/src/db/seed.ts
var LEGACY_DEFAULT_PASSWORD = "encalm";
function ensureUsersSeeded() {
  initDatabase();
  const findUser = db.prepare("SELECT id FROM users WHERE id = ?");
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, title, initials, must_change_password)
    VALUES (@id, @name, @email, @password_hash, @role, @title, @initials, 1)
  `);
  const flagMustChange = db.prepare("UPDATE users SET must_change_password = 1 WHERE id = ?");
  const created = [];
  const tx = db.transaction(() => {
    for (const u of users) {
      const email = u.email || `${u.id.replace("user-", "")}@encalm.com`;
      const existing = findUser.get(u.id);
      if (existing) continue;
      const password = generateTemporaryPassword();
      insertUser.run({
        id: u.id,
        name: u.name,
        email,
        password_hash: hashPassword(password),
        role: u.role,
        title: u.title,
        initials: u.initials
      });
      created.push({ email, password });
    }
  });
  tx();
  const checkDone = db.prepare("SELECT 1 FROM system_settings WHERE key = 'legacy_password_check_done'").get();
  if (!checkDone) {
    const candidates = db.prepare(
      "SELECT id, password_hash FROM users WHERE must_change_password = 0 AND COALESCE(password_hash, '') != ''"
    ).all();
    let flagged = 0;
    for (const c of candidates) {
      if (verifyPassword(LEGACY_DEFAULT_PASSWORD, c.password_hash)) {
        flagMustChange.run(c.id);
        flagged++;
      }
    }
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('legacy_password_check_done', '1')").run();
    if (flagged > 0)
      logger.info(`\u2713 ${flagged} account(s) still on the old default password must change it at next sign-in.`);
  }
  if (created.length > 0) {
    console.log("================================================================");
    console.log(" New user accounts created. Temporary passwords (shown ONCE):");
    for (const c of created) console.log(`   ${c.email}  ${c.password}`);
    console.log(" Each user must change their password at first sign-in.");
    console.log("================================================================");
  }
  logger.info("\u2713 User accounts synchronized for authentication.");
}
function clearAllProjectData() {
  initDatabase();
  ensureUsersSeeded();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM notifications").run();
    db.prepare("DELETE FROM updates").run();
    db.prepare("DELETE FROM issues").run();
    db.prepare("DELETE FROM milestones").run();
    db.prepare("DELETE FROM phases").run();
    db.prepare("DELETE FROM projects").run();
  });
  tx();
  logger.info("\u2713 All project data removed. Database is now empty and ready for fresh input.");
}
function seedDatabase(force = false) {
  ensureUsersSeeded();
  if (force) {
    clearAllProjectData();
  }
}

// server/src/utils/backup.ts
import fs4 from "node:fs";
import path4 from "node:path";

// server/src/repositories/sql.ts
function updateColumns(table, where, columns) {
  const entries = Object.entries(columns).filter(([, v]) => v !== void 0);
  if (entries.length === 0) return 0;
  const whereEntries = Object.entries(where);
  const sql = `UPDATE ${table} SET ${entries.map(([c]) => `${c} = ?`).join(", ")} WHERE ${whereEntries.map(([c]) => `${c} = ?`).join(" AND ")}`;
  return db.prepare(sql).run(...entries.map(([, v]) => v), ...whereEntries.map(([, v]) => v)).changes;
}
function groupByProject(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const list = map.get(row.project_id);
    if (list) list.push(row);
    else map.set(row.project_id, [row]);
  }
  return map;
}
var placeholders = (n) => Array.from({ length: n }, () => "?").join(", ");
function todayLabel() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// server/src/repositories/projects.repo.ts
var projectsRepo = {
  find(id2) {
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(id2);
  },
  exists(id2) {
    return Boolean(db.prepare("SELECT 1 FROM projects WHERE id = ?").get(id2));
  },
  count() {
    return db.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
  },
  /** All projects: open ones first, then by risk, progress and name. */
  listOrdered() {
    return db.prepare(
      `SELECT * FROM projects
         ORDER BY
           CASE WHEN (status != 'Operational' AND COALESCE(progress, 0) < 100) THEN 0 ELSE 1 END,
           CASE health WHEN 'Delayed' THEN 0 WHEN 'At risk' THEN 1 WHEN 'On track' THEN 2 ELSE 3 END,
           COALESCE(progress, 0),
           name`
    ).all();
  },
  /** Child rows for many projects in five queries, whatever the number of projects. */
  childrenFor(projectIds) {
    const result = /* @__PURE__ */ new Map();
    for (const id2 of projectIds) result.set(id2, { phases: [], milestones: [], issues: [], updates: [], photos: [] });
    if (projectIds.length === 0) return result;
    const inList = placeholders(projectIds.length);
    const load = (sql) => groupByProject(db.prepare(sql.replace("(:ids)", `(${inList})`)).all(...projectIds));
    const phases = load("SELECT * FROM phases WHERE project_id IN (:ids) ORDER BY order_index");
    const milestones = load(
      "SELECT * FROM milestones WHERE project_id IN (:ids) ORDER BY order_index, date"
    );
    const issues = load("SELECT * FROM issues WHERE project_id IN (:ids) ORDER BY order_index, id DESC");
    const updates = load(
      "SELECT * FROM updates WHERE project_id IN (:ids) ORDER BY created_at DESC, rowid DESC"
    );
    const photos = load(
      "SELECT * FROM photos WHERE project_id IN (:ids) ORDER BY taken_date DESC, created_at DESC"
    );
    for (const [id2, children] of result) {
      children.phases = phases.get(id2) ?? [];
      children.milestones = milestones.get(id2) ?? [];
      children.issues = issues.get(id2) ?? [];
      children.updates = updates.get(id2) ?? [];
      children.photos = photos.get(id2) ?? [];
    }
    return result;
  },
  insert(row) {
    db.prepare(
      `INSERT INTO projects (
        id, name, location, category, code, health, status, progress, target_date, target_label,
        aop, awarded, spent, projected_cost, area, pax_keys, next_milestone, next_milestone_date, lead_id, start_date,
        last_updated, specification_json, template_id
      ) VALUES (
        @id, @name, @location, @category, @code, @health, @status, @progress, @target_date, @target_label,
        @aop, @awarded, @spent, @projected_cost, @area, @pax_keys, @next_milestone, @next_milestone_date, @lead_id, @start_date,
        @last_updated, @specification_json, @template_id
      )`
    ).run(row);
  },
  update(id2, columns) {
    updateColumns("projects", { id: id2 }, columns);
  },
  /** Deletes the project with its photos and notifications (other children cascade). */
  delete(id2) {
    db.prepare("DELETE FROM photos WHERE project_id = ?").run(id2);
    db.prepare("DELETE FROM notifications WHERE project_id = ?").run(id2);
    return db.prepare("DELETE FROM projects WHERE id = ?").run(id2).changes > 0;
  }
};

// server/src/utils/backup.ts
var SNAPSHOT_FILE_PATH = path4.join(dataDir, "portfolio-database.json");
function parseTaggedUsers(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val !== "string") return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
function exportPortfolioProjects() {
  const rows = db.prepare("SELECT * FROM projects ORDER BY name ASC").all();
  const children = projectsRepo.childrenFor(rows.map((r) => r.id));
  return rows.map((row) => toExportRecord(row, children.get(row.id)));
}
function toExportRecord(row, { phases, milestones, issues, updates, photos }) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    category: row.category,
    code: row.code,
    health: row.health,
    status: row.status || "Yet to start",
    progress: row.progress,
    targetDate: row.target_date,
    targetLabel: row.target_label,
    aop: row.aop,
    awarded: row.awarded,
    spent: row.spent,
    projectedCost: row.projected_cost ?? 0,
    area: row.area || void 0,
    paxKeys: row.pax_keys || void 0,
    nextMilestone: row.next_milestone,
    nextMilestoneDate: row.next_milestone_date,
    leadId: row.lead_id,
    startDate: row.start_date,
    lastUpdated: row.last_updated,
    templateId: row.template_id,
    specification: row.specification_json ? JSON.parse(row.specification_json) : void 0,
    phases: phases.map((ph) => ({
      id: ph.id,
      name: ph.name,
      status: ph.status,
      progress: ph.progress,
      owner: ph.owner,
      plannedStart: ph.planned_start,
      plannedFinish: ph.planned_finish,
      actualFinish: ph.actual_finish,
      workCompleted: ph.work_completed,
      nextAction: ph.next_action,
      decisionRequired: ph.decision_required,
      weight: ph.weight ?? null,
      taggedUsers: parseTaggedUsers(ph.tagged_users),
      updatedAt: ph.updated_at
    })),
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      status: m.status,
      stage: m.stage,
      owner: m.owner,
      approvalRequired: Boolean(m.approval_required),
      approvalStatus: m.approval_status,
      completedDate: m.completed_date,
      taggedUsers: parseTaggedUsers(m.tagged_users)
    })),
    issues: issues.map((i) => ({
      id: i.id,
      title: i.title,
      detail: i.detail,
      severity: i.severity,
      owner: i.owner,
      category: i.category,
      status: i.status,
      stage: i.stage,
      dateRaised: i.date_raised,
      dueDate: i.due_date,
      impactCost: i.impact_cost,
      impactSchedule: i.impact_schedule,
      impactScope: i.impact_scope,
      action: i.action,
      resolution: i.resolution,
      taggedUsers: parseTaggedUsers(i.tagged_users)
    })),
    updates: updates.map((u) => ({
      id: u.id,
      date: u.date,
      author: u.author,
      role: u.role,
      text: u.text,
      stage: u.stage,
      kind: u.kind
    })),
    photos: photos.map((p) => ({
      id: p.id,
      projectId: p.project_id,
      url: p.url,
      thumbnailUrl: p.thumbnail_url || void 0,
      caption: p.caption,
      stage: p.stage,
      category: p.category,
      takenDate: p.taken_date,
      uploadedBy: p.uploaded_by,
      role: p.role,
      fileSize: p.file_size,
      createdAt: p.created_at
    }))
  };
}
function saveDatabaseSnapshot() {
  try {
    const projects = exportPortfolioProjects();
    const notifications = db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100").all();
    const snapshot = {
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      projectCount: projects.length,
      projects,
      notifications
    };
    fs4.writeFileSync(SNAPSHOT_FILE_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
    logger.info(`[Backup] Saved snapshot with ${projects.length} projects to ${SNAPSHOT_FILE_PATH}`);
  } catch (err) {
    logger.warn({ err }, "[Backup] Failed to save snapshot");
  }
}
function restoreDatabaseFromJSON(data) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (projects.length === 0) {
    return { success: true, count: 0 };
  }
  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, name, location, category, code, health, status, progress, target_date, target_label,
      aop, awarded, spent, projected_cost, area, pax_keys, next_milestone, next_milestone_date, lead_id, start_date,
      last_updated, specification_json, template_id
    ) VALUES (
      @id, @name, @location, @category, @code, @health, @status, @progress, @target_date, @target_label,
      @aop, @awarded, @spent, @projected_cost, @area, @pax_keys, @next_milestone, @next_milestone_date, @lead_id, @start_date,
      @last_updated, @specification_json, @template_id
    )
  `);
  const insertPhase = db.prepare(`
    INSERT OR REPLACE INTO phases (
      id, project_id, name, status, progress, weight, owner, order_index,
      planned_start, planned_finish, actual_finish, work_completed, next_action, decision_required, tagged_users, updated_at
    ) VALUES (
      @id, @project_id, @name, @status, @progress, @weight, @owner, @order_index,
      @planned_start, @planned_finish, @actual_finish, @work_completed, @next_action, @decision_required, @tagged_users, @updated_at
    )
  `);
  const insertMilestone = db.prepare(`
    INSERT OR REPLACE INTO milestones (
      id, project_id, title, date, status, stage, owner,
      approval_required, approval_status, completed_date, tagged_users, order_index
    ) VALUES (
      @id, @project_id, @title, @date, @status, @stage, @owner,
      @approval_required, @approval_status, @completed_date, @tagged_users, @order_index
    )
  `);
  const insertIssue = db.prepare(`
    INSERT OR REPLACE INTO issues (
      id, project_id, title, detail, severity, owner, category, status,
      stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
      action, resolution, tagged_users, order_index
    ) VALUES (
      @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
      @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
      @action, @resolution, @tagged_users, @order_index
    )
  `);
  const insertUpdate = db.prepare(`
    INSERT OR REPLACE INTO updates (
      id, project_id, date, author, role, text, stage, kind
    ) VALUES (
      @id, @project_id, @date, @author, @role, @text, @stage, @kind
    )
  `);
  const insertPhoto = db.prepare(`
    INSERT OR REPLACE INTO photos (
      id, project_id, url, thumbnail_url, caption, stage, category, taken_date, uploaded_by, role, file_size, created_at
    ) VALUES (
      @id, @project_id, @url, @thumbnail_url, @caption, @stage, @category, @taken_date, @uploaded_by, @role, @file_size, @created_at
    )
  `);
  const tx = db.transaction(() => {
    for (const p of projects) {
      insertProject.run({
        id: p.id,
        name: p.name,
        location: p.location || "Delhi",
        category: p.category || "Airport Lounge",
        code: p.code || "ENC-PRJ",
        health: p.health || "On track",
        status: p.status || "Yet to start",
        progress: Number(p.progress) || 0,
        target_date: p.targetDate || "",
        target_label: p.targetLabel || p.targetDate || "",
        aop: Number(p.aop) || 0,
        awarded: Number(p.awarded) || 0,
        spent: Number(p.spent) || 0,
        projected_cost: Number(p.projectedCost ?? p.projected_cost ?? p.aop ?? 0),
        area: p.area || p.specification?.area || null,
        pax_keys: p.paxKeys || p.pax_keys || p.specification?.capacity || null,
        next_milestone: p.nextMilestone || "Project brief",
        next_milestone_date: p.nextMilestoneDate || p.startDate || "",
        lead_id: p.leadId || "user-lead-1",
        start_date: p.startDate || null,
        last_updated: p.lastUpdated || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
        specification_json: p.specification ? JSON.stringify(p.specification) : null,
        template_id: p.templateId || null
      });
      db.prepare("DELETE FROM phases WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM milestones WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM issues WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM updates WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM photos WHERE project_id = ?").run(p.id);
      if (Array.isArray(p.phases)) {
        p.phases.forEach((ph, idx) => {
          insertPhase.run({
            id: ph.id || `${p.id}-phase-${idx}`,
            project_id: p.id,
            name: ph.name,
            status: ph.status || "upcoming",
            progress: Number(ph.progress) || 0,
            weight: ph.weight || null,
            owner: ph.owner || "PMO",
            order_index: idx,
            planned_start: ph.plannedStart || ph.planned_start || null,
            planned_finish: ph.plannedFinish || ph.planned_finish || null,
            actual_finish: ph.actualFinish || ph.actual_finish || null,
            work_completed: ph.workCompleted || ph.work_completed || null,
            next_action: ph.nextAction || ph.next_action || null,
            decision_required: ph.decisionRequired || ph.decision_required || null,
            tagged_users: JSON.stringify(parseTaggedUsers(ph.taggedUsers || ph.tagged_users)),
            updated_at: ph.updatedAt || ph.updated_at || null
          });
        });
      }
      if (Array.isArray(p.milestones)) {
        p.milestones.forEach((m, idx) => {
          insertMilestone.run({
            id: m.id || `${p.id}-milestone-${idx}`,
            project_id: p.id,
            title: m.title,
            date: m.date,
            status: m.status || "upcoming",
            stage: m.stage || null,
            owner: m.owner || null,
            approval_required: m.approvalRequired ? 1 : 0,
            approval_status: m.approvalStatus || "Not required",
            completed_date: m.completedDate || m.completed_date || null,
            tagged_users: JSON.stringify(parseTaggedUsers(m.taggedUsers || m.tagged_users)),
            order_index: idx
          });
        });
      }
      if (Array.isArray(p.issues)) {
        p.issues.forEach((iss, idx) => {
          insertIssue.run({
            id: iss.id || `${p.id}-issue-${idx}`,
            project_id: p.id,
            title: iss.title,
            detail: iss.detail,
            severity: iss.severity || "Medium",
            owner: iss.owner || "Project Lead",
            category: iss.category || "Other",
            status: iss.status || "Open",
            stage: iss.stage || null,
            date_raised: iss.dateRaised || iss.date_raised || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
            due_date: iss.dueDate || iss.due_date || null,
            impact_cost: iss.impactCost || iss.impact_cost || null,
            impact_schedule: iss.impactSchedule || iss.impact_schedule || null,
            impact_scope: iss.impactScope || iss.impact_scope || null,
            action: iss.action || null,
            resolution: iss.resolution || null,
            tagged_users: JSON.stringify(parseTaggedUsers(iss.taggedUsers || iss.tagged_users)),
            order_index: idx
          });
        });
      }
      if (Array.isArray(p.updates)) {
        p.updates.forEach((u, idx) => {
          insertUpdate.run({
            id: u.id || `${p.id}-update-${idx}`,
            project_id: p.id,
            date: u.date || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
            author: u.author || "Project Lead",
            role: u.role || "Project Lead",
            text: u.text,
            stage: u.stage || null,
            kind: u.kind || "General"
          });
        });
      }
      if (Array.isArray(p.photos)) {
        p.photos.forEach((ph, idx) => {
          insertPhoto.run({
            id: ph.id || `${p.id}-photo-${idx}`,
            project_id: p.id,
            url: ph.url,
            thumbnail_url: ph.thumbnailUrl || ph.thumbnail_url || null,
            caption: ph.caption || "",
            stage: ph.stage || null,
            category: ph.category || "Progress",
            taken_date: ph.takenDate || ph.taken_date || null,
            uploaded_by: ph.uploadedBy || ph.uploaded_by || "PMO",
            role: ph.role || "Lead",
            file_size: ph.fileSize || ph.file_size || null,
            created_at: ph.createdAt || ph.created_at || (/* @__PURE__ */ new Date()).toISOString()
          });
        });
      }
    }
  });
  tx();
  saveDatabaseSnapshot();
  return { success: true, count: projects.length };
}
function autoRestoreSnapshotIfEmpty() {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM projects").get();
    if (row && row.count === 0) {
      if (fs4.existsSync(SNAPSHOT_FILE_PATH)) {
        const raw = fs4.readFileSync(SNAPSHOT_FILE_PATH, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          logger.info(
            `[Auto-Restore] Database is empty. Restoring ${data.projects.length} projects from ${SNAPSHOT_FILE_PATH}...`
          );
          restoreDatabaseFromJSON(data);
          logger.info(`[Auto-Restore] Restored ${data.projects.length} projects.`);
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "[Auto-Restore] Check failed");
  }
}

// server/src/app.ts
import express2 from "express";
import cors from "cors";
import fs8 from "node:fs";
import path8 from "node:path";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";

// server/src/utils/session.ts
import crypto4 from "node:crypto";
import jwt2 from "jsonwebtoken";

// server/src/middleware/auth.ts
import jwt from "jsonwebtoken";
var DEV_JWT_SECRET = "encalm-secret-jwt-key-2026";
var JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;
var PASSWORD_CHANGE_ALLOWED = /* @__PURE__ */ new Set([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/logout-all"
]);
var ACCESS_COOKIE_NAME = "encalm_at";
function loadUser(id2) {
  const row = db.prepare(
    "SELECT id, name, email, role, title, initials, must_change_password, token_version FROM users WHERE id = ?"
  ).get(id2);
  if (!row) return void 0;
  const { must_change_password, token_version, ...rest } = row;
  return { ...rest, mustChangePassword: Boolean(must_change_password), tokenVersion: token_version };
}
function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Authentication is required" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.id || typeof decoded.tv !== "number") {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }
    const user = loadUser(decoded.id);
    if (!user || user.tokenVersion !== decoded.tv) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(`${req.baseUrl}${req.path}`)) {
      return res.status(403).json({ error: "You must change your password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
    }
    const { tokenVersion: _tv, ...publicUser } = user;
    req.user = publicUser;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
  }
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Action restricted to ${allowedRoles.join(" or ")} role(s). Current role is ${req.user.role}.`
      });
    }
    next();
  };
}
function canUserEditProject(projectId5, user) {
  if (user.role === "coordinator") return true;
  if (user.role === "hod" || user.role === "viewer") return false;
  if (user.role === "lead") {
    const project = db.prepare("SELECT lead_id FROM projects WHERE id = ?").get(projectId5);
    if (!project) return false;
    return !project.lead_id || project.lead_id === user.id;
  }
  return false;
}
function requireProjectAccess(projectIdParam = "id") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Authentication required" });
    }
    const projectId5 = req.params[projectIdParam] || req.body?.projectId || req.params.projectId || req.params.id;
    if (!projectId5) {
      return res.status(400).json({ error: "Project ID is required" });
    }
    const exists = db.prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId5);
    if (!exists) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (!canUserEditProject(projectId5, req.user)) {
      return res.status(403).json({
        error: req.user.role === "hod" || req.user.role === "viewer" ? "Forbidden: this account is view-only" : "Forbidden: You can only edit projects allotted to you"
      });
    }
    next();
  };
}
function canUserTagOnProject(projectId5, user) {
  if (user.role === "coordinator" || user.role === "hod") return true;
  if (user.role === "viewer") return false;
  return canUserEditProject(projectId5, user);
}
function requireTagAccess() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized: Authentication required" });
    const projectId5 = req.body?.projectId;
    if (!projectId5) return res.status(400).json({ error: "Project ID is required" });
    if (!db.prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId5)) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (!canUserTagOnProject(projectId5, req.user)) {
      return res.status(403).json({ error: "Forbidden: You can only tag people on projects allotted to you" });
    }
    next();
  };
}

// server/src/utils/session.ts
var ACCESS_COOKIE = ACCESS_COOKIE_NAME;
var REFRESH_COOKIE = "encalm_rt";
var ACCESS_TTL_SECONDS = 30 * 60;
var REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var isProduction = process.env.NODE_ENV === "production";
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    ...process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}
  };
}
var REFRESH_COOKIE_PATH = "/api/auth";
function hashToken(token) {
  return crypto4.createHash("sha256").update(token).digest("hex");
}
function signAccessToken(userId, tokenVersion) {
  const claims = { id: userId, tv: tokenVersion };
  return jwt2.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS });
}
function createRefreshToken(userId) {
  const id2 = crypto4.randomUUID();
  const token = crypto4.randomBytes(32).toString("base64url");
  db.prepare(
    `
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(id2, userId, hashToken(token), new Date(Date.now() + REFRESH_TTL_MS).toISOString());
  return { id: id2, token };
}
function setSessionCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), path: "/", maxAge: ACCESS_TTL_SECONDS * 1e3 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_MS
  });
}
function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });
}
function currentTokenVersion(userId) {
  const row = db.prepare("SELECT token_version FROM users WHERE id = ?").get(userId);
  return row ? row.token_version : null;
}
function startSession(res, userId) {
  const tv = currentTokenVersion(userId) ?? 0;
  const refresh = createRefreshToken(userId);
  setSessionCookies(res, signAccessToken(userId, tv), refresh.token);
}
var ROTATION_GRACE_MS = 15 * 1e3;
function rotateSession(res, presentedToken) {
  if (!presentedToken) return { status: "invalid" };
  const row = db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(hashToken(presentedToken));
  if (!row) return { status: "invalid" };
  if (row.revoked_at) {
    const revokedAt = (/* @__PURE__ */ new Date(`${row.revoked_at.replace(" ", "T")}Z`)).getTime();
    if (row.replaced_by && Date.now() - revokedAt < ROTATION_GRACE_MS) {
      return { status: "raced" };
    }
    logger.warn(`[Auth] Refresh token reuse detected for user ${row.user_id}; revoking all sessions.`);
    revokeAllSessions(row.user_id);
    return { status: "invalid" };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) return { status: "invalid" };
  const tv = currentTokenVersion(row.user_id);
  if (tv === null) return { status: "invalid" };
  const next = createRefreshToken(row.user_id);
  db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now'), replaced_by = ? WHERE id = ?").run(
    next.id,
    row.id
  );
  setSessionCookies(res, signAccessToken(row.user_id, tv), next.token);
  return { status: "rotated", userId: row.user_id };
}
function revokeSession(presentedToken) {
  if (!presentedToken) return null;
  const hash = hashToken(presentedToken);
  const row = db.prepare("SELECT user_id FROM refresh_tokens WHERE token_hash = ?").get(hash);
  db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL").run(
    hash
  );
  return row?.user_id ?? null;
}
function revokeAllSessions(userId) {
  db.transaction(() => {
    db.prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?").run(userId);
    db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(
      userId
    );
  })();
}
function pruneExpiredRefreshTokens() {
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(
    new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()
  );
}

// server/src/utils/http-error.ts
var HttpError = class extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
  status;
  extra;
};
var notFound = (what) => new HttpError(404, `${what} not found`);
var badRequest = (message) => new HttpError(400, message);
var forbidden = (message) => new HttpError(403, message);
var conflict = (message) => new HttpError(409, message);

// server/src/validation/large-json.ts
import express from "express";
var LARGE_JSON_PATHS = /* @__PURE__ */ new Set(["/api/system/import", "/api/projects/sync"]);
var largeJson = express.json({ limit: "10mb" });

// server/src/sentry.ts
import fs5 from "node:fs";
import path5 from "node:path";
var serverDsn = () => process.env.SENTRY_DSN?.trim() || "";
var clientDsn = () => process.env.SENTRY_CLIENT_DSN?.trim() || serverDsn();
var sentryEnvironment = () => process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
var commitFiles = /* @__PURE__ */ new Map();
function appRelease(root = projectRoot) {
  if (process.env.APP_RELEASE) return process.env.APP_RELEASE;
  if (!commitFiles.has(root)) {
    let commit;
    try {
      commit = fs5.readFileSync(path5.join(root, "SOURCE_COMMIT"), "utf8").trim().slice(0, 8) || void 0;
    } catch {
      commit = void 0;
    }
    commitFiles.set(root, commit);
  }
  return commitFiles.get(root);
}
function dsnOrigin(dsn) {
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}
var sentry = null;
function scrubEvent(event) {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (/^(cookie|authorization|x-csrf-token)$/i.test(name)) delete event.request.headers[name];
      }
    }
  }
  return event;
}
async function initSentry() {
  const dsn = serverDsn();
  if (!dsn || sentry) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    release: appRelease(),
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    beforeSend: scrubEvent
  });
  sentry = Sentry;
  logger.info({ environment: sentryEnvironment() }, "Sentry error tracking enabled");
}
function captureError(err, context = {}) {
  sentry?.captureException(err, { extra: context });
}
async function flushSentry(timeoutMs = 2e3) {
  await sentry?.flush(timeoutMs);
}

// server/src/routes/auth.ts
import { Router } from "express";

// server/src/validation/validate.ts
function validate(schemas) {
  return (req, res, next) => {
    const errors = [];
    const parts = ["params", "query", "body"];
    const parsed = {};
    for (const part of parts) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(part === "body" ? req.body ?? {} : req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({ field: [part, ...issue.path.map(String)].join("."), message: issue.message });
        }
      }
    }
    if (errors.length > 0) {
      const first = errors[0];
      return res.status(400).json({
        error: `Invalid ${first.field.replace(/^(body|params|query)\./, "")}: ${first.message}`,
        fields: errors.slice(0, 20)
      });
    }
    if (parsed.body !== void 0) req.body = parsed.body;
    next();
  };
}

// server/src/validation/schemas.ts
import { z } from "zod";
var id = z.string().regex(/^[A-Za-z0-9._@:-]{1,200}$/, "Invalid id");
var text = (max) => z.string().trim().max(max);
var optText = (max) => text(max).nullish();
var dateText = optText(40);
var taggedUsers = z.array(id).max(100).optional();
var looseNumber = z.preprocess(
  (v) => v === "" || v === null ? null : typeof v === "string" ? Number(v) : v,
  z.number().finite().nullable()
);
var money = looseNumber.refine((v) => v === null || v >= 0 && v < 1e13, "Out of range");
var percent = looseNumber.refine((v) => v === null || v >= 0 && v <= 100, "Must be between 0 and 100");
var health = z.enum(["On track", "At risk", "Delayed", "Not started"]);
var projectStatus = z.enum([
  "Yet to start",
  "In Design",
  "In Tendering",
  "Under Construction",
  "Operational",
  "On Hold"
]);
var phaseStatus = z.enum(["upcoming", "active", "blocked", "complete"]);
var milestoneStatus = z.enum(["upcoming", "complete", "late"]);
var approvalStatus = z.enum(["Not required", "Pending", "Approved", "Rejected"]);
var severity = z.enum(["High", "Medium", "Low"]);
var updateKind = z.enum(["Progress", "Decision", "Risk", "General"]);
var boundedObject = (maxBytes) => z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= maxBytes, `Must be under ${maxBytes} bytes`);
var projectParams = z.object({ id });
var phaseParams = z.object({ id, phaseId: id });
var milestoneParams = z.object({ id, milestoneId: id });
var issueParams = z.object({ id, issueId: id });
var photoParams = z.object({ id, photoId: id });
var idParams = z.object({ id });
var pageFields = {
  limit: z.string().regex(/^\d{1,3}$/).optional(),
  offset: z.string().regex(/^\d{1,7}$/).optional()
};
var pageQuery = z.object(pageFields);
var emailLogsQuery = z.object({ projectId: id.optional(), ...pageFields });
var directoryQuery = z.object({ q: z.string().max(100).optional() });
var auditQuery = z.object({
  ...pageFields,
  userId: id.optional(),
  entityType: z.string().regex(/^[a-z_]{1,40}$/).optional(),
  entityId: z.string().max(4e3).optional(),
  action: z.string().regex(/^[a-z_]{1,40}$/).optional()
});
var loginBody = z.object({
  email: text(254).min(1),
  password: z.string().min(1).max(200)
});
var changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200)
});
var createLeadBody = z.object({
  name: text(120).min(1),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
  title: optText(120)
});
var phaseFields = {
  name: text(200).min(1),
  status: phaseStatus,
  progress: percent,
  weight: looseNumber.refine((v) => v === null || v >= 0 && v <= 1e3, "Out of range"),
  budget: money,
  owner: text(120),
  plannedStart: dateText,
  plannedFinish: dateText,
  actualFinish: dateText,
  workCompleted: optText(5e3),
  nextAction: optText(5e3),
  decisionRequired: optText(5e3),
  taggedUsers
};
var createPhaseBody = z.object({ id: id.optional(), ...phaseFields }).partial().extend({
  name: text(200).min(1).optional()
});
var updatePhaseBody = z.object(phaseFields).partial().extend({ notify: z.boolean().optional() });
var movePhaseBody = z.object({
  phaseIndex: z.number().int().min(0).max(1e3),
  direction: z.union([z.literal(-1), z.literal(1)])
});
var milestoneFields = {
  title: text(300).min(1),
  date: text(40),
  status: milestoneStatus,
  stage: optText(200),
  owner: optText(120),
  approvalRequired: z.boolean(),
  approvalStatus,
  completedDate: dateText,
  taggedUsers
};
var createMilestoneBody = z.object({ id: id.optional(), ...milestoneFields }).partial().required({ title: true, date: true });
var updateMilestoneBody = z.object(milestoneFields).partial().extend({ notify: z.boolean().optional() });
var issueFields = {
  title: text(300).min(1),
  detail: text(1e4),
  severity,
  owner: optText(120),
  category: optText(60),
  status: optText(60),
  stage: optText(200),
  dateRaised: dateText,
  dueDate: dateText,
  issueAriseDate: dateText,
  targetClosureDate: dateText,
  impactCost: optText(2e3),
  impactSchedule: optText(2e3),
  impactScope: optText(2e3),
  action: optText(5e3),
  resolution: optText(5e3),
  taggedUsers
};
var createIssueBody = z.object({ id: id.optional(), ...issueFields }).partial().required({ title: true, detail: true });
var updateIssueBody = z.object(issueFields).partial().extend({ notify: z.boolean().optional() });
var createUpdateBody = z.object({
  text: text(1e4).min(1),
  date: dateText,
  author: optText(120),
  role: optText(120),
  stage: optText(200),
  kind: updateKind.optional(),
  /** People picked with @ in the update: each gets a notification and an email. */
  taggedUsers
});
var projectScalarFields = {
  name: text(200).min(1),
  code: text(60),
  location: text(80).min(1),
  category: text(80).min(1),
  health,
  status: projectStatus,
  progress: percent,
  startDate: dateText,
  targetDate: dateText,
  targetLabel: optText(60),
  aop: money,
  awarded: money,
  spent: money,
  projectedCost: money,
  projected_cost: money,
  area: optText(200),
  paxKeys: optText(200),
  pax_keys: optText(200),
  nextMilestone: optText(300),
  nextMilestoneDate: dateText,
  leadId: id.or(z.literal("")),
  specification: boundedObject(5e4)
};
var createProjectBody = z.object({
  id: id.optional(),
  templateId: optText(60),
  ...projectScalarFields,
  phases: z.array(
    z.object({ id: id.optional(), ...phaseFields }).partial().required({ name: true })
  ).max(50).optional(),
  milestones: z.array(
    z.object({ id: id.optional(), ...milestoneFields }).partial().required({ title: true, date: true })
  ).max(200).optional(),
  issues: z.array(
    z.object({ id: id.optional(), ...issueFields }).partial().required({ title: true, detail: true })
  ).max(200).optional()
}).partial().required({ name: true, location: true, category: true });
var updateProjectBody = z.object({
  ...projectScalarFields,
  phases: z.array(z.object({ id: id.optional(), budget: money.optional() })).max(50).optional()
}).partial();
var allotProjectBody = z.object({ leadId: id });
var portfolioProject = z.looseObject({ id, name: text(200).min(1) });
var syncProjectsBody = z.object({
  projects: z.array(portfolioProject).max(2e3),
  explicit: z.boolean().optional()
});
var importBody = z.looseObject({
  projects: z.array(portfolioProject).max(2e3),
  notifications: z.array(z.unknown()).max(1e4).optional()
});
var smtpSettings = z.object({
  host: optText(253),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: optText(254),
  pass: z.string().max(500).optional(),
  fromName: optText(120)
}).strict();
var emailSettingsBody = z.object({ smtp: smtpSettings.optional() }).strict();
var emailTestBody = z.object({}).strict();
var recipient = z.union([
  z.string().trim().email().max(254),
  z.object({ email: z.string().trim().email().max(254), name: optText(120) })
]);
var sendProjectUpdateBody = z.object({
  projectId: id,
  recipients: z.array(recipient).min(1).max(50),
  customNote: optText(5e3)
});
var tagAndCommentBody = z.object({
  projectId: id,
  entityType: z.enum(["Task", "Stage", "Milestone", "Issue", "Update", "General"]).optional(),
  entityId: id.optional(),
  entityTitle: optText(300),
  entityContext: optText(2e3),
  taggedUserIds: z.array(id).max(100).optional(),
  comment: optText(5e3)
});

// server/src/utils/audit.ts
import crypto5 from "node:crypto";

// server/src/repositories/audit.repo.ts
var FILTER_COLUMNS = {
  userId: "a.user_id",
  entityType: "a.entity_type",
  entityId: "a.entity_id",
  action: "a.action"
};
function whereClause(filter) {
  const clauses = [];
  const params = [];
  for (const [key, column] of Object.entries(FILTER_COLUMNS)) {
    const value = filter[key];
    if (value) {
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}
var auditRepo = {
  insert(row) {
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, before_json, after_json, ip, created_at)
       VALUES (@id, @user_id, @action, @entity_type, @entity_id, @before_json, @after_json, @ip,
               strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    ).run(row);
  },
  count(filter) {
    const where = whereClause(filter);
    const row = db.prepare(`SELECT COUNT(*) AS count FROM audit_log a ${where.sql}`).get(...where.params);
    return row.count;
  },
  /** Newest first, with the acting user's name and email. */
  list(filter, limit, offset) {
    const where = whereClause(filter);
    return db.prepare(
      `SELECT a.*, u.name AS user_name, u.email AS user_email
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         ${where.sql}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ? OFFSET ?`
    ).all(...where.params, limit, offset);
  },
  /** The current row of `table` (a fixed, trusted table name). */
  findRow(table, id2) {
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id2);
  }
};

// server/src/utils/audit.ts
var REDACTED_COLUMNS = /* @__PURE__ */ new Set(["password_hash", "token_hash", "html_content"]);
var AUDITED_TABLES = /* @__PURE__ */ new Set(["projects", "phases", "milestones", "issues", "updates", "photos", "users"]);
function rowSnapshot(table, id2) {
  if (!id2 || !AUDITED_TABLES.has(table)) return null;
  const row = auditRepo.findRow(table, id2);
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).filter(([k]) => !REDACTED_COLUMNS.has(k)));
}
function writeAudit(entry) {
  try {
    auditRepo.insert({
      id: crypto5.randomUUID(),
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before_json: entry.before == null ? null : JSON.stringify(entry.before),
      after_json: entry.after == null ? null : JSON.stringify(entry.after),
      ip: entry.ip ?? null
    });
  } catch (err) {
    logger.error({ err }, "[Audit] Failed to write audit entry");
  }
}
function audited(spec) {
  return (req, res, next) => {
    const initialId = spec.id?.(req);
    const before = spec.table ? rowSnapshot(spec.table, initialId) : null;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        const entityId = res.locals.auditEntityId ?? initialId ?? null;
        const after = spec.action === "delete" ? null : res.locals.auditAfter ?? (spec.table ? rowSnapshot(spec.table, entityId) : spec.details?.(req) ?? null);
        writeAudit({
          userId: req.user?.id ?? null,
          action: spec.action,
          entityType: spec.entityType,
          entityId,
          before,
          after,
          ip: req.ip
        });
      }
      return originalJson(body);
    };
    next();
  };
}

// server/src/utils/tx.ts
var afterCommitQueue = null;
function afterCommit(fn) {
  if (afterCommitQueue) afterCommitQueue.push(fn);
  else fn();
}
function transactional(handler) {
  return (req, res, next) => {
    const callbacks = [];
    afterCommitQueue = callbacks;
    try {
      db.transaction(() => {
        const result = handler(req, res);
        if (result && typeof result.then === "function") {
          throw new Error("transactional() handlers must be synchronous");
        }
      })();
    } catch (err) {
      return next(err);
    } finally {
      afterCommitQueue = null;
    }
    for (const fn of callbacks) {
      try {
        fn();
      } catch (err) {
        logger.error({ err }, "[afterCommit]");
      }
    }
  };
}

// server/src/repositories/users.repo.ts
var PUBLIC_COLUMNS = "id, name, email, role, title, initials";
var usersRepo = {
  find(id2) {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id2);
  },
  /** A user who can sign in (not a directory-only stakeholder), by email. */
  findLoginByEmail(email) {
    return db.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND role IN ('hod', 'lead', 'coordinator', 'viewer')").get(email.toLowerCase());
  },
  findLoginById(id2) {
    return db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('hod', 'lead', 'coordinator', 'viewer')").get(id2);
  },
  emailTaken(email) {
    return Boolean(db.prepare("SELECT 1 FROM users WHERE LOWER(email) = ?").get(email.toLowerCase()));
  },
  findLead(id2) {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND role = 'lead'`).get(id2);
  },
  listPublic() {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY name`).all();
  },
  /** Users who get project notifications (viewers can sign in but only look, so they get none). */
  inboxUserIds() {
    const rows = db.prepare("SELECT id FROM users WHERE role IN ('coordinator', 'lead', 'hod')").all();
    return rows.map((r) => r.id);
  },
  listLeads() {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE role = 'lead' ORDER BY name`).all();
  },
  /** Every user, including directory-only stakeholders, for matching @mentions and directory results. */
  listDirectory() {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users`).all();
  },
  /** Saves a person found in the Microsoft directory; an existing row keeps its role and password. */
  upsertDirectoryUser(user) {
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, title, initials, created_at)
       VALUES (@id, @name, @email, '', @role, @title, @initials, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, email = excluded.email, title = excluded.title, initials = excluded.initials`
    ).run(user);
  },
  insert(row) {
    db.prepare(
      `INSERT INTO users (id, name, email, role, title, initials, password_hash, must_change_password)
       VALUES (@id, @name, @email, @role, @title, @initials, @password_hash, @must_change_password)`
    ).run(row);
  },
  update(id2, columns) {
    updateColumns("users", { id: id2 }, columns);
  }
};

// server/src/services/auth.service.ts
var INVALID_CREDENTIALS = "Invalid email or password. After repeated failed attempts, sign-in is paused for 15 minutes.";
var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_MS = 15 * 60 * 1e3;
var DUMMY_HASH = hashPassword(generateTemporaryPassword());
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    initials: user.initials,
    mustChangePassword: Boolean(user.must_change_password)
  };
}
function authenticate(email, password, ip) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = usersRepo.findLoginByEmail(normalizedEmail);
  const passwordOk = verifyPassword(password, user?.password_hash || DUMMY_HASH);
  const locked = Boolean(user?.locked_until && new Date(user.locked_until).getTime() > Date.now());
  if (!user || locked || !passwordOk) {
    if (user && !locked) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        usersRepo.update(user.id, {
          failed_attempts: 0,
          locked_until: new Date(Date.now() + LOCKOUT_MS).toISOString()
        });
        logger.warn(
          `[Auth] Account ${normalizedEmail} locked for 15 minutes after ${attempts} failed attempts (ip ${ip})`
        );
        writeAudit({ userId: user.id, action: "account_locked", entityType: "user", entityId: user.id, ip });
      } else {
        usersRepo.update(user.id, { failed_attempts: attempts });
      }
    }
    logger.warn(`[Auth] Failed login for ${normalizedEmail} from ${ip}${locked ? " (account locked)" : ""}`);
    writeAudit({
      userId: user?.id ?? null,
      action: "login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
      after: { email: normalizedEmail, locked },
      ip
    });
    throw new HttpError(401, INVALID_CREDENTIALS);
  }
  if (user.failed_attempts || user.locked_until) {
    usersRepo.update(user.id, { failed_attempts: 0, locked_until: null });
  }
  writeAudit({ userId: user.id, action: "login", entityType: "user", entityId: user.id, ip });
  return user;
}
function changePassword(userId, currentPassword, newPassword, ip) {
  const user = usersRepo.find(userId);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) throw badRequest("Current password is incorrect");
  const policyError = checkPasswordPolicy(newPassword);
  if (policyError) throw badRequest(policyError);
  if (newPassword === currentPassword) throw badRequest("New password must be different from the current password");
  usersRepo.update(user.id, { password_hash: hashPassword(newPassword), must_change_password: 0 });
  revokeAllSessions(user.id);
  writeAudit({ userId: user.id, action: "password_changed", entityType: "user", entityId: user.id, ip });
  return usersRepo.find(user.id);
}
function resetPassword(targetId, actor4, ip) {
  const target2 = usersRepo.findLoginById(targetId);
  if (!target2) throw notFound("User");
  const temporaryPassword = generateTemporaryPassword();
  usersRepo.update(target2.id, {
    password_hash: hashPassword(temporaryPassword),
    must_change_password: 1,
    failed_attempts: 0,
    locked_until: null
  });
  revokeAllSessions(target2.id);
  writeAudit({ userId: actor4.id, action: "password_reset", entityType: "user", entityId: target2.id, ip });
  logger.info(`[Auth] ${actor4.email} reset the password for ${target2.email}`);
  return temporaryPassword;
}
function initialsFor(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
  return "PL";
}
function createLead(input) {
  const policyError = checkPasswordPolicy(input.password);
  if (policyError) throw badRequest(policyError);
  const email = input.email.trim().toLowerCase();
  if (usersRepo.emailTaken(email)) throw conflict("A user with this email address already exists");
  const name = input.name.trim();
  const lead = {
    id: `user-lead-${Date.now()}`,
    name,
    email,
    role: "lead",
    title: input.title?.trim() || "Project Lead",
    initials: initialsFor(name)
  };
  usersRepo.insert({ ...lead, password_hash: hashPassword(input.password), must_change_password: 1 });
  return lead;
}

// server/src/routes/auth.ts
var router = Router();
router.post("/login", validate({ body: loginBody }), (req, res) => {
  const user = authenticate(req.body.email, req.body.password, req.ip);
  startSession(res, user.id);
  res.json({ user: toPublicUser(user) });
});
router.post("/refresh", (req, res) => {
  const result = rotateSession(res, req.cookies?.[REFRESH_COOKIE]);
  if (result.status === "raced") {
    return res.json({ retry: true });
  }
  const user = result.status === "rotated" ? usersRepo.find(result.userId) : void 0;
  if (!user) {
    clearSessionCookies(res);
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
  return res.json({ user: toPublicUser(user) });
});
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
router.post("/logout", (req, res) => {
  const userId = revokeSession(req.cookies?.[REFRESH_COOKIE]);
  if (userId) writeAudit({ userId, action: "logout", entityType: "user", entityId: userId, ip: req.ip });
  clearSessionCookies(res);
  res.json({ message: "Logged out successfully" });
});
router.post("/logout-all", requireAuth, (req, res) => {
  revokeAllSessions(req.user.id);
  clearSessionCookies(res);
  writeAudit({ userId: req.user.id, action: "logout_all", entityType: "user", entityId: req.user.id, ip: req.ip });
  res.json({ message: "Signed out of all sessions" });
});
router.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordBody }),
  transactional((req, res) => {
    const user = changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, req.ip);
    startSession(res, user.id);
    res.json({ message: "Password changed successfully", user: toPublicUser(user) });
  })
);
router.post(
  "/users/:id/reset-password",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ params: idParams }),
  transactional((req, res) => {
    const temporaryPassword = resetPassword(req.params.id, req.user, req.ip);
    res.json({
      message: "Temporary password set. Share it securely; the user must change it at next sign-in.",
      temporaryPassword
    });
  })
);
router.get("/users", requireAuth, (_req, res) => {
  res.json({ users: usersRepo.listPublic() });
});
router.get("/leads", requireAuth, (_req, res) => {
  res.json({ leads: usersRepo.listLeads() });
});
router.post(
  "/create-lead",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ body: createLeadBody }),
  audited({ action: "create", entityType: "user", table: "users" }),
  (req, res) => {
    const lead = createLead(req.body);
    res.locals.auditEntityId = lead.id;
    res.status(201).json({ message: "Project Lead created successfully", lead });
  }
);
var auth_default = router;

// server/src/routes/projects.ts
import { Router as Router2 } from "express";

// server/src/services/photos.service.ts
import crypto6 from "node:crypto";
import fs6 from "node:fs";
import path6 from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

// server/src/repositories/photos.repo.ts
var photosRepo = {
  findInProject(projectId5, photoId) {
    return db.prepare("SELECT * FROM photos WHERE id = ? AND project_id = ?").get(photoId, projectId5);
  },
  listForProject(projectId5, page) {
    return db.prepare("SELECT * FROM photos WHERE project_id = ? ORDER BY taken_date DESC, created_at DESC LIMIT ? OFFSET ?").all(projectId5, page.limit, page.offset);
  },
  countForProject(projectId5) {
    return db.prepare("SELECT COUNT(*) AS n FROM photos WHERE project_id = ?").get(projectId5).n;
  },
  countAll() {
    return db.prepare("SELECT COUNT(*) AS n FROM photos").get().n;
  },
  listPortfolio(page) {
    return db.prepare(
      `SELECT
           p.id,
           p.project_id AS projectId,
           p.url,
           p.thumbnail_url AS thumbnailUrl,
           p.caption,
           p.stage,
           p.category,
           p.taken_date AS takenDate,
           p.uploaded_by AS uploadedBy,
           p.role,
           p.file_size AS fileSize,
           p.created_at AS createdAt,
           pr.name AS projectName,
           pr.code AS projectCode,
           pr.location AS projectLocation,
           pr.category AS projectCategory
         FROM photos p
         JOIN projects pr ON p.project_id = pr.id
         ORDER BY p.taken_date DESC, p.created_at DESC
         LIMIT ? OFFSET ?`
    ).all(page.limit, page.offset);
  },
  insert(row) {
    db.prepare(
      `INSERT INTO photos (
         id, project_id, url, thumbnail_url, caption, stage, category, taken_date, uploaded_by, role, file_size, created_at
       ) VALUES (
         @id, @project_id, @url, @thumbnail_url, @caption, @stage, @category, @taken_date, @uploaded_by, @role,
         @file_size, @created_at
       )`
    ).run(row);
  },
  delete(id2) {
    db.prepare("DELETE FROM photos WHERE id = ?").run(id2);
  }
};

// server/src/repositories/notifications.repo.ts
var notificationsRepo = {
  /** Inserts a notification; an existing id is left alone. */
  insert(row) {
    db.prepare(
      `INSERT OR IGNORE INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
       VALUES (@id, @type, @title, @message, @project_id, @link, @recipient_id, @read, COALESCE(@created_at, datetime('now')))`
    ).run({ read: 0, created_at: null, ...row });
  },
  /** Notifications from before per-user inboxes (no recipient). */
  listLegacy() {
    return db.prepare("SELECT * FROM notifications WHERE recipient_id IS NULL").all();
  },
  deleteLegacy() {
    db.prepare("DELETE FROM notifications WHERE recipient_id IS NULL").run();
  },
  listForRecipient(recipientId, page) {
    return db.prepare("SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(recipientId, page.limit, page.offset);
  },
  countForRecipient(recipientId) {
    return db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE recipient_id = ?").get(recipientId).n;
  },
  unreadCount(recipientId) {
    const row = db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND read = 0").get(recipientId);
    return row.count;
  },
  /** Returns false when the notification does not exist or belongs to someone else. */
  markRead(id2, recipientId) {
    return db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND recipient_id = ?").run(id2, recipientId).changes > 0;
  },
  markAllRead(recipientId) {
    db.prepare("UPDATE notifications SET read = 1 WHERE recipient_id = ? AND read = 0").run(recipientId);
  },
  delete(id2, recipientId) {
    return db.prepare("DELETE FROM notifications WHERE id = ? AND recipient_id = ?").run(id2, recipientId).changes > 0;
  }
};

// server/src/utils/notify.ts
function broadcastNotification(type, baseId, title, message, projectId5, link) {
  db.transaction(() => {
    for (const userId of usersRepo.inboxUserIds()) {
      notificationsRepo.insert({
        id: `${baseId}--${userId}`,
        type,
        title,
        message,
        project_id: projectId5,
        link,
        recipient_id: userId
      });
    }
  })();
}
function notifyProjectWatchers(input) {
  const project = db.prepare("SELECT lead_id FROM projects WHERE id = ?").get(input.projectId);
  const rows = db.prepare("SELECT id FROM users WHERE role IN ('hod', 'coordinator') OR (role = 'lead' AND id = ?)").all(project?.lead_id ?? "");
  const skip = /* @__PURE__ */ new Set([input.actorId, ...input.exclude ?? []]);
  const recipients = [...new Set(rows.map((r) => r.id))].filter((id2) => !skip.has(id2));
  db.transaction(() => {
    for (const userId of recipients) {
      notificationsRepo.insert({
        id: `${input.baseId}--${userId}`,
        type: input.type,
        title: input.title,
        message: input.message,
        project_id: input.projectId,
        link: `/project/${input.projectId}`,
        recipient_id: userId
      });
    }
  })();
  return recipients;
}
function fanOutLegacyNotifications() {
  const legacy = notificationsRepo.listLegacy();
  if (legacy.length === 0) return;
  const users2 = usersRepo.inboxUserIds();
  db.transaction(() => {
    for (const n of legacy) {
      for (const userId of users2) {
        notificationsRepo.insert({ ...n, id: `${n.id}--${userId}`, recipient_id: userId });
      }
    }
    notificationsRepo.deleteLegacy();
  })();
  logger.info(`\u2713 Migrated ${legacy.length} global notifications to per-user inboxes.`);
}

// server/src/services/photos.service.ts
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
var FULL_SIZE_PX = 2e3;
var THUMBNAIL_PX = 400;
function parsePhotoMeta(raw, count) {
  let parsed = [];
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: count }, (_, i) => {
    const m = list[i] ?? {};
    const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : void 0;
    return {
      caption: str(m.caption, 300),
      stage: str(m.stage, 120),
      category: str(m.category, 60),
      takenDate: str(m.takenDate, 30)
    };
  });
}
function removeUploadFile(url) {
  if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return;
  const filePath = path6.join(uploadsDir, path6.basename(url));
  try {
    if (fs6.existsSync(filePath)) fs6.unlinkSync(filePath);
  } catch (e) {
    logger.warn({ err: e }, `[Photos] Could not remove ${filePath}`);
  }
}
function removePhotoFiles(photo) {
  removeUploadFile(photo.url);
  removeUploadFile(photo.thumbnail_url);
}
function toPhotoDto(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption,
    stage: row.stage,
    category: row.category,
    takenDate: row.taken_date,
    uploadedBy: row.uploaded_by,
    role: row.role,
    fileSize: row.file_size,
    createdAt: row.created_at
  };
}
async function uploadPhotos(projectId5, files, rawMeta, user) {
  const project = projectsRepo.find(projectId5);
  if (!project) throw notFound("Project");
  if (files.length === 0) throw badRequest('Please attach at least one photograph in the "photos" field.');
  for (const file of files) {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw badRequest(`"${file.originalname}" is not a JPEG, PNG or WebP image.`);
    }
  }
  const meta = parsePhotoMeta(rawMeta, files.length);
  const written = [];
  const discardWritten = () => written.forEach((f) => removeUploadFile(`/uploads/${f}`));
  const prepared = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const name = crypto6.randomUUID();
      const fullName = `${name}.webp`;
      const thumbName = `${name}_thumb.webp`;
      const image = sharp(files[i].buffer, { failOn: "error" }).rotate();
      const full = await image.clone().resize({ width: FULL_SIZE_PX, height: FULL_SIZE_PX, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const thumb = await image.clone().resize({ width: THUMBNAIL_PX, height: THUMBNAIL_PX, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
      fs6.writeFileSync(path6.join(uploadsDir, fullName), full);
      written.push(fullName);
      fs6.writeFileSync(path6.join(uploadsDir, thumbName), thumb);
      written.push(thumbName);
      prepared.push({
        id: `photo-${crypto6.randomUUID()}`,
        url: `/uploads/${fullName}`,
        thumbnailUrl: `/uploads/${thumbName}`,
        size: full.length,
        meta: meta[i]
      });
    }
  } catch (err) {
    discardWritten();
    logger.warn({ err }, "[Photos] Image processing failed");
    throw badRequest("One of the images could not be read. Please check the files and try again.");
  }
  const uploaderName = user.name;
  const uploaderRole = user.title || user.role;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const today = nowIso.split("T")[0];
  try {
    return db.transaction(() => {
      broadcastNotification(
        "system",
        `notif-photo-${crypto6.randomUUID()}`,
        "Site Photograph Updated",
        prepared.length === 1 ? `${uploaderName} uploaded a new site photograph for ${project.name}` : `${uploaderName} uploaded ${prepared.length} site photographs for ${project.name}`,
        projectId5,
        `/project/${projectId5}`
      );
      return prepared.map((p) => {
        const row = {
          id: p.id,
          project_id: projectId5,
          url: p.url,
          thumbnail_url: p.thumbnailUrl,
          caption: p.meta.caption || "Site progress photograph",
          stage: p.meta.stage || null,
          category: p.meta.category || "Progress",
          taken_date: p.meta.takenDate || today,
          uploaded_by: uploaderName,
          role: uploaderRole,
          file_size: p.size,
          created_at: nowIso
        };
        photosRepo.insert(row);
        return toPhotoDto(row);
      });
    })();
  } catch (err) {
    discardWritten();
    throw err;
  }
}
function deletePhoto(projectId5, photoId) {
  const photo = photosRepo.findInProject(projectId5, photoId);
  if (!photo) throw notFound("Photograph");
  photosRepo.delete(photoId);
  return photo;
}

// server/src/repositories/phases.repo.ts
var phasesRepo = {
  exists(id2) {
    return Boolean(db.prepare("SELECT 1 FROM phases WHERE id = ?").get(id2));
  },
  find(id2, projectId5) {
    return db.prepare("SELECT * FROM phases WHERE id = ? AND project_id = ?").get(id2, projectId5);
  },
  listForProject(projectId5) {
    return db.prepare("SELECT * FROM phases WHERE project_id = ? ORDER BY order_index").all(projectId5);
  },
  nextOrderIndex(projectId5) {
    const row = db.prepare("SELECT MAX(order_index) AS m FROM phases WHERE project_id = ?").get(projectId5);
    return (row.m ?? -1) + 1;
  },
  insert(row) {
    db.prepare(
      `INSERT INTO phases (
        id, project_id, name, status, progress, weight, budget, owner, order_index,
        planned_start, planned_finish, actual_finish, work_completed, next_action,
        decision_required, tagged_users, updated_at
      ) VALUES (
        @id, @project_id, @name, @status, @progress, @weight, @budget, @owner, @order_index,
        @planned_start, @planned_finish, @actual_finish, @work_completed, @next_action,
        @decision_required, @tagged_users, @updated_at
      )`
    ).run({ budget: null, weight: null, tagged_users: null, ...row });
  },
  update(id2, projectId5, columns) {
    updateColumns("phases", { id: id2, project_id: projectId5 }, columns);
  },
  delete(id2, projectId5) {
    return db.prepare("DELETE FROM phases WHERE id = ? AND project_id = ?").run(id2, projectId5).changes > 0;
  },
  /** Rewrites order_index as 0..n-1 in the given order. */
  setOrder(ids) {
    const stmt = db.prepare("UPDATE phases SET order_index = ? WHERE id = ?");
    ids.forEach((id2, idx) => stmt.run(idx, id2));
  }
};

// server/src/repositories/milestones.repo.ts
var milestonesRepo = {
  exists(id2) {
    return Boolean(db.prepare("SELECT 1 FROM milestones WHERE id = ?").get(id2));
  },
  find(id2, projectId5) {
    return db.prepare("SELECT * FROM milestones WHERE id = ? AND project_id = ?").get(id2, projectId5);
  },
  insert(row) {
    db.prepare(
      `INSERT INTO milestones (
        id, project_id, title, date, status, stage, owner,
        approval_required, approval_status, completed_date, tagged_users, order_index
      ) VALUES (
        @id, @project_id, @title, @date, @status, @stage, @owner,
        @approval_required, @approval_status, @completed_date, @tagged_users, @order_index
      )`
    ).run(row);
  },
  update(id2, projectId5, columns) {
    updateColumns("milestones", { id: id2, project_id: projectId5 }, columns);
  },
  delete(id2, projectId5) {
    return db.prepare("DELETE FROM milestones WHERE id = ? AND project_id = ?").run(id2, projectId5).changes > 0;
  }
};

// server/src/repositories/issues.repo.ts
var issuesRepo = {
  exists(id2) {
    return Boolean(db.prepare("SELECT 1 FROM issues WHERE id = ?").get(id2));
  },
  find(id2, projectId5) {
    return db.prepare("SELECT * FROM issues WHERE id = ? AND project_id = ?").get(id2, projectId5);
  },
  insert(row) {
    db.prepare(
      `INSERT INTO issues (
        id, project_id, title, detail, severity, owner, category, status,
        stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
        action, resolution, tagged_users, order_index
      ) VALUES (
        @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
        @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
        @action, @resolution, @tagged_users, @order_index
      )`
    ).run(row);
  },
  update(id2, projectId5, columns) {
    updateColumns("issues", { id: id2, project_id: projectId5 }, columns);
  },
  delete(id2, projectId5) {
    return db.prepare("DELETE FROM issues WHERE id = ? AND project_id = ?").run(id2, projectId5).changes > 0;
  }
};

// server/src/utils/status.ts
function calculateProjectStatus(_progress, _phases, currentStatus) {
  return currentStatus || "Yet to start";
}

// server/src/services/project-mapper.ts
function parseTaggedUsers2(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
function parseJson(value) {
  if (!value) return void 0;
  try {
    return JSON.parse(value);
  } catch {
    return void 0;
  }
}
var toPhaseDto = (ph) => ({
  id: ph.id,
  name: ph.name,
  status: ph.status,
  progress: ph.progress,
  owner: ph.owner,
  plannedStart: ph.planned_start,
  plannedFinish: ph.planned_finish,
  actualFinish: ph.actual_finish,
  workCompleted: ph.work_completed,
  nextAction: ph.next_action,
  decisionRequired: ph.decision_required,
  weight: ph.weight ?? null,
  budget: ph.budget != null ? Number(ph.budget) : void 0,
  taggedUsers: parseTaggedUsers2(ph.tagged_users),
  updatedAt: ph.updated_at
});
var toMilestoneDto = (m) => ({
  id: m.id,
  title: m.title,
  date: m.date,
  status: m.status,
  stage: m.stage,
  owner: m.owner,
  approvalRequired: Boolean(m.approval_required),
  approvalStatus: m.approval_status,
  completedDate: m.completed_date,
  taggedUsers: parseTaggedUsers2(m.tagged_users)
});
var toIssueDto = (iss) => ({
  id: iss.id,
  title: iss.title,
  detail: iss.detail,
  severity: iss.severity,
  owner: iss.owner,
  category: iss.category,
  status: iss.status,
  stage: iss.stage,
  dateRaised: iss.date_raised,
  dueDate: iss.due_date,
  issueAriseDate: iss.date_raised,
  targetClosureDate: iss.due_date,
  impactCost: iss.impact_cost,
  impactSchedule: iss.impact_schedule,
  impactScope: iss.impact_scope,
  action: iss.action,
  resolution: iss.resolution,
  taggedUsers: parseTaggedUsers2(iss.tagged_users)
});
var toUpdateDto = (u) => ({
  id: u.id,
  date: u.date,
  author: u.author,
  role: u.role,
  text: u.text,
  stage: u.stage,
  kind: u.kind
});
var toPhotoDto2 = (p) => ({
  id: p.id,
  projectId: p.project_id,
  url: p.url,
  thumbnailUrl: p.thumbnail_url || void 0,
  caption: p.caption,
  stage: p.stage,
  category: p.category,
  takenDate: p.taken_date,
  uploadedBy: p.uploaded_by,
  role: p.role,
  fileSize: p.file_size,
  createdAt: p.created_at
});
function toProjectDto(row, children) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    category: row.category,
    code: row.code,
    health: row.health,
    status: row.status || "Yet to start",
    progress: row.progress,
    targetDate: row.target_date,
    targetLabel: row.target_label,
    aop: row.aop,
    awarded: row.awarded,
    spent: row.spent,
    projectedCost: row.projected_cost ?? 0,
    area: row.area || void 0,
    paxKeys: row.pax_keys || void 0,
    nextMilestone: row.next_milestone,
    nextMilestoneDate: row.next_milestone_date,
    leadId: row.lead_id,
    startDate: row.start_date,
    lastUpdated: row.last_updated,
    templateId: row.template_id,
    specification: parseJson(row.specification_json),
    phases: children.phases.map(toPhaseDto),
    milestones: children.milestones.map(toMilestoneDto),
    issues: children.issues.map(toIssueDto),
    updates: children.updates.map(toUpdateDto),
    photos: children.photos.map(toPhotoDto2)
  };
}

// server/src/services/projects.service.ts
var DEFAULT_STAGES = [
  { name: "Brief & scope", status: "active", owner: "PMO" },
  { name: "Design development", status: "upcoming", owner: "Design" },
  { name: "Procurement", status: "upcoming", owner: "Sourcing" },
  { name: "Execution", status: "upcoming", owner: "Projects" },
  { name: "Handover", status: "upcoming", owner: "Operations" }
];
var slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function getProject(id2) {
  const row = projectsRepo.find(id2);
  if (!row) return null;
  return toProjectDto(row, projectsRepo.childrenFor([id2]).get(id2));
}
function requireProject(id2) {
  const project = getProject(id2);
  if (!project) throw notFound("Project");
  return project;
}
function listProjects() {
  const rows = projectsRepo.listOrdered();
  const children = projectsRepo.childrenFor(rows.map((r) => r.id));
  return rows.map((row) => toProjectDto(row, children.get(row.id)));
}
function createProject(input, user) {
  const id2 = input.id || `${slug(input.location) || "site"}-${slug(input.name) || "project"}-${Date.now()}`;
  if (projectsRepo.exists(id2)) throw conflict("Project with this ID already exists");
  const today = todayLabel();
  const progress = input.progress ?? 0;
  const stages = input.phases && input.phases.length > 0 ? input.phases : DEFAULT_STAGES;
  const spec = input.specification;
  projectsRepo.insert({
    id: id2,
    name: input.name,
    location: input.location,
    category: input.category,
    code: input.code || `${input.location.slice(0, 3).toUpperCase()}-NEW-${(/* @__PURE__ */ new Date()).getFullYear() % 100}`,
    health: input.health || (progress > 0 ? "On track" : "Not started"),
    status: input.status || calculateProjectStatus(progress),
    progress,
    target_date: input.targetDate || "",
    target_label: input.targetLabel || input.targetDate || "",
    aop: input.aop ?? 0,
    awarded: input.awarded ?? 0,
    spent: input.spent ?? 0,
    projected_cost: input.projectedCost ?? input.projected_cost ?? input.aop ?? 0,
    area: input.area || spec?.area || null,
    pax_keys: input.paxKeys || input.pax_keys || spec?.capacity || null,
    next_milestone: input.nextMilestone || "Project brief",
    next_milestone_date: input.nextMilestoneDate || input.startDate || "",
    lead_id: input.leadId || user.id,
    start_date: input.startDate || null,
    last_updated: today,
    specification_json: input.specification ? JSON.stringify(input.specification) : null,
    template_id: input.templateId || null
  });
  stages.forEach((stage, index) => {
    const s = stage;
    phasesRepo.insert({
      id: s.id || `${id2}-phase-${index}`,
      project_id: id2,
      name: s.name,
      status: s.status || "upcoming",
      progress: s.progress ?? 0,
      weight: s.weight ?? null,
      owner: s.owner || "PMO",
      order_index: index,
      planned_start: null,
      planned_finish: null,
      actual_finish: null,
      work_completed: null,
      next_action: null,
      decision_required: null,
      updated_at: null
    });
  });
  (input.milestones ?? []).forEach((m, index) => {
    milestonesRepo.insert({
      id: m.id || `${id2}-milestone-${index}`,
      project_id: id2,
      title: m.title,
      date: m.date,
      status: m.status || "upcoming",
      stage: m.stage || null,
      owner: m.owner || null,
      approval_required: m.approvalRequired ? 1 : 0,
      approval_status: m.approvalStatus || (m.approvalRequired ? "Pending" : "Not required"),
      completed_date: m.completedDate || null,
      tagged_users: null,
      order_index: index
    });
  });
  (input.issues ?? []).forEach((iss, index) => {
    issuesRepo.insert({
      id: iss.id || `${id2}-issue-${index}`,
      project_id: id2,
      title: iss.title,
      detail: iss.detail,
      severity: iss.severity || "Medium",
      owner: iss.owner || user.name,
      category: iss.category || "Other",
      status: iss.status || "Open",
      stage: iss.stage || null,
      date_raised: iss.issueAriseDate || iss.dateRaised || today,
      due_date: iss.targetClosureDate || iss.dueDate || null,
      impact_cost: iss.impactCost || null,
      impact_schedule: iss.impactSchedule || null,
      impact_scope: iss.impactScope || null,
      action: iss.action || null,
      resolution: iss.resolution || null,
      tagged_users: null,
      order_index: index
    });
  });
  broadcastNotification(
    "system",
    `notif-create-${id2}`,
    `New Project Created: ${input.name}`,
    `${input.name} was added to the portfolio by ${user.name}.`,
    id2,
    `/project/${id2}`
  );
  return requireProject(id2);
}
function updateProject(id2, patch, user) {
  const current = projectsRepo.find(id2);
  if (!current) throw notFound("Project");
  if (patch.leadId !== void 0 && patch.leadId !== current.lead_id && user.role !== "coordinator") {
    throw forbidden("Forbidden: Only the coordinator can reassign a project lead");
  }
  const progress = patch.progress != null ? Math.max(0, Math.min(100, patch.progress)) : void 0;
  projectsRepo.update(id2, {
    last_updated: todayLabel(),
    name: patch.name,
    code: patch.code,
    location: patch.location,
    category: patch.category,
    health: patch.health,
    status: patch.status ?? (progress !== void 0 ? calculateProjectStatus(progress, [], current.status) : void 0),
    start_date: patch.startDate,
    progress,
    target_date: patch.targetDate,
    target_label: patch.targetLabel,
    aop: patch.aop,
    awarded: patch.awarded,
    spent: patch.spent,
    projected_cost: patch.projectedCost !== void 0 ? patch.projectedCost : patch.projected_cost,
    area: patch.area,
    pax_keys: patch.paxKeys !== void 0 ? patch.paxKeys : patch.pax_keys,
    next_milestone: patch.nextMilestone,
    next_milestone_date: patch.nextMilestoneDate,
    lead_id: patch.leadId,
    specification_json: patch.specification !== void 0 ? JSON.stringify(patch.specification) : void 0
  });
  for (const stage of patch.phases ?? []) {
    if (stage.id && stage.budget !== void 0) phasesRepo.update(stage.id, id2, { budget: stage.budget });
  }
  return requireProject(id2);
}
function allotProject(id2, leadId, user) {
  const lead = usersRepo.findLead(leadId);
  if (!lead) throw badRequest("Selected lead does not exist or is not a project lead");
  const project = projectsRepo.find(id2);
  if (!project) throw notFound("Project");
  projectsRepo.update(id2, { lead_id: leadId, last_updated: todayLabel() });
  broadcastNotification(
    "system",
    `notif-allot-${id2}-${Date.now()}`,
    `Project Allotted: ${project.name}`,
    `${project.name} has been assigned to ${lead.name} by ${user.name}.`,
    id2,
    `/project/${id2}`
  );
  return requireProject(id2);
}
function deleteProject(id2) {
  const files = db.prepare("SELECT url, thumbnail_url FROM photos WHERE project_id = ?").all(id2);
  if (!projectsRepo.delete(id2)) throw notFound("Project");
  return files;
}

// server/src/routes/projects.ts
var router2 = Router2();
var projectId = (req) => req.params.id;
router2.get("/", requireAuth, (_req, res) => {
  res.json({ projects: listProjects() });
});
router2.get("/:id", requireAuth, validate({ params: projectParams }), (req, res) => {
  res.json({ project: requireProject(req.params.id) });
});
router2.post(
  "/sync",
  requireAuth,
  requireRole(["coordinator"]),
  largeJson,
  validate({ body: syncProjectsBody }),
  audited({
    action: "sync",
    entityType: "portfolio",
    details: (req) => ({ projects: req.body.projects.map((p) => p.id) })
  }),
  transactional((req, res) => {
    const { projects, explicit } = req.body;
    if (projectsRepo.count() === 0 && !explicit) {
      return res.json({
        success: true,
        count: 0,
        message: "Database is empty; automatic sync bypassed to protect clean state."
      });
    }
    const result = restoreDatabaseFromJSON({ projects });
    afterCommit(saveDatabaseSnapshot);
    return res.json({ success: true, count: result.count, message: `Synced ${result.count} projects successfully` });
  })
);
router2.post(
  "/",
  requireAuth,
  requireRole(["coordinator", "lead"]),
  validate({ body: createProjectBody }),
  audited({ action: "create", entityType: "project", table: "projects" }),
  transactional((req, res) => {
    const project = createProject(req.body, req.user);
    res.locals.auditEntityId = project.id;
    afterCommit(saveDatabaseSnapshot);
    res.status(201).json({ project });
  })
);
router2.patch(
  "/:id/allot",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ params: projectParams, body: allotProjectBody }),
  audited({ action: "allot", entityType: "project", table: "projects", id: projectId }),
  transactional((req, res) => {
    const project = allotProject(projectId(req), req.body.leadId, req.user);
    afterCommit(saveDatabaseSnapshot);
    res.json({ project });
  })
);
router2.patch(
  "/:id",
  requireAuth,
  requireProjectAccess(),
  validate({ params: projectParams, body: updateProjectBody }),
  audited({ action: "update", entityType: "project", table: "projects", id: projectId }),
  transactional((req, res) => {
    const project = updateProject(projectId(req), req.body, req.user);
    afterCommit(saveDatabaseSnapshot);
    res.json({ project });
  })
);
router2.delete(
  "/:id",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ params: projectParams }),
  audited({ action: "delete", entityType: "project", table: "projects", id: projectId }),
  transactional((req, res) => {
    const files = deleteProject(projectId(req));
    afterCommit(() => files.forEach(removePhotoFiles));
    afterCommit(saveDatabaseSnapshot);
    res.json({ message: "Project deleted successfully" });
  })
);
var projects_default = router2;

// server/src/routes/phases.ts
import { Router as Router3 } from "express";

// server/src/repositories/updates.repo.ts
var updatesRepo = {
  insert(row) {
    db.prepare(
      `INSERT INTO updates (id, project_id, date, author, role, text, stage, kind)
       VALUES (@id, @project_id, @date, @author, @role, @text, @stage, @kind)`
    ).run(row);
  },
  listForProject(projectId5, page) {
    return db.prepare("SELECT * FROM updates WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?").all(projectId5, page.limit, page.offset);
  },
  countForProject(projectId5) {
    return db.prepare("SELECT COUNT(*) AS n FROM updates WHERE project_id = ?").get(projectId5).n;
  },
  listRecent(page) {
    return db.prepare(
      `SELECT u.*, p.name AS project_name, p.code AS project_code
         FROM updates u JOIN projects p ON u.project_id = p.id
         ORDER BY u.created_at DESC, u.rowid DESC LIMIT ? OFFSET ?`
    ).all(page.limit, page.offset);
  },
  countAll() {
    return db.prepare("SELECT COUNT(*) AS n FROM updates").get().n;
  }
};

// server/src/services/notifications.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// server/src/repositories/settings.repo.ts
var upsertSql = `INSERT INTO system_settings (key, value, updated_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`;
var settingsRepo = {
  get(key) {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
    return row?.value;
  },
  set(key, value) {
    db.prepare(upsertSql).run(key, value);
  },
  /** Writes several settings atomically. */
  setMany(entries) {
    const upsert = db.prepare(upsertSql);
    db.transaction(() => entries.forEach(([key, value]) => upsert.run(key, value)))();
  }
};

// server/src/services/email/settings.ts
var MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
var DEFAULT_SENDER = "notifications@encalm.com";
function getSmtpConfig() {
  const get = settingsRepo.get;
  const host = get("smtp_host") || process.env.SMTP_HOST || "smtp-mail.outlook.com";
  const portStr = get("smtp_port") || process.env.SMTP_PORT || "587";
  const secureStr = get("smtp_secure") || process.env.SMTP_SECURE || "false";
  const user = get("smtp_user") || process.env.SMTP_USER || "";
  const pass = decryptSecret(get("smtp_pass")) || process.env.SMTP_PASS || "";
  const fromName = get("smtp_from_name") || process.env.SMTP_FROM_NAME || "Encalm Project Dashboard";
  return {
    host: host.trim(),
    port: parseInt(portStr, 10) || 587,
    secure: secureStr === "true" || secureStr === "1",
    user: user.trim(),
    pass: pass.trim(),
    fromName: fromName.trim()
  };
}
var isSmtpConfigured = (smtp = getSmtpConfig()) => Boolean(smtp.host && smtp.user && smtp.pass);
function saveSmtpConfig(config) {
  const entries = [];
  if (config.host !== void 0) entries.push(["smtp_host", config.host]);
  if (config.port !== void 0) entries.push(["smtp_port", String(config.port)]);
  if (config.secure !== void 0) entries.push(["smtp_secure", String(config.secure)]);
  if (config.user !== void 0) entries.push(["smtp_user", config.user]);
  if (config.pass !== void 0 && config.pass !== MASK) {
    entries.push(["smtp_pass", config.pass ? encryptSecret(config.pass) : ""]);
  }
  if (config.fromName !== void 0) entries.push(["smtp_from_name", config.fromName]);
  settingsRepo.setMany(entries);
}
var domainOf = (email) => email.split("@")[1]?.trim().toLowerCase() || "";
function getGraphConfig(env2 = process.env) {
  const tenantId = (env2.MS_GRAPH_TENANT_ID || env2.AZURE_TENANT_ID || "").trim();
  const clientId = (env2.MS_GRAPH_CLIENT_ID || env2.AZURE_CLIENT_ID || "").trim();
  const clientSecret = (env2.MS_GRAPH_CLIENT_SECRET || env2.AZURE_CLIENT_SECRET || "").trim();
  const senderEmail = (env2.MS_GRAPH_SENDER_EMAIL || DEFAULT_SENDER).trim();
  const listed = (env2.MS_GRAPH_SEND_AS_DOMAINS || "").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  return {
    tenantId,
    clientId,
    clientSecret,
    senderEmail,
    sendAsDomains: listed.length ? listed : [domainOf(senderEmail)].filter(Boolean)
  };
}
var isGraphConfigured = (cfg = getGraphConfig()) => Boolean(cfg.tenantId && cfg.clientId && cfg.clientSecret && cfg.senderEmail);
function getActiveEmailProvider() {
  if (isGraphConfigured()) return "microsoft_graph";
  if (isSmtpConfigured()) return "smtp";
  return "outbox";
}
function encryptPlaintextSettings() {
  let migrated = 0;
  for (const key of ENCRYPTED_SETTING_KEYS) {
    const value = settingsRepo.get(key);
    if (value && !isEncrypted(value)) {
      settingsRepo.set(key, encryptSecret(value));
      migrated++;
    }
  }
  if (migrated > 0) logger.info(`\u2713 Encrypted ${migrated} stored email secret(s) at rest.`);
}
function applyEmailSettings(input) {
  if (input.smtp) saveSmtpConfig(input.smtp);
}
function describeEmailSettings() {
  const smtp = getSmtpConfig();
  const graph = getGraphConfig();
  return {
    provider: getActiveEmailProvider(),
    graph: { isConfigured: isGraphConfigured(graph), sendAsDomains: graph.sendAsDomains },
    smtp: {
      host: smtp.host || "smtp-mail.outlook.com",
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      user: smtp.user || "",
      pass: smtp.pass ? MASK : "",
      fromName: smtp.fromName || "Encalm Project Dashboard",
      isConfigured: isSmtpConfigured(smtp)
    }
  };
}

// server/src/services/email/queue.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// server/src/repositories/email.repo.ts
var emailRepo = {
  countLogs(projectId5) {
    const row = projectId5 ? db.prepare("SELECT COUNT(*) AS n FROM email_logs WHERE project_id = ?").get(projectId5) : db.prepare("SELECT COUNT(*) AS n FROM email_logs").get();
    return row.n;
  },
  listLogs(projectId5, { limit, offset }) {
    return projectId5 ? db.prepare("SELECT * FROM email_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(projectId5, limit, offset) : db.prepare("SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
  },
  findLogStatus(id2) {
    const row = db.prepare("SELECT status FROM email_logs WHERE id = ?").get(id2);
    return row?.status;
  },
  /** Logs a new email as queued and schedules its first delivery attempt. */
  enqueue(log, maxAttempts, nextAttemptAt) {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO email_logs (
           id, recipient_email, recipient_name, reply_to, from_email, from_name, subject, template_type, project_id,
           status, html_content, created_at
         ) VALUES (
           @id, @recipient_email, @recipient_name, @reply_to, @from_email, @from_name, @subject, @template_type,
           @project_id, 'queued', @html_content, datetime('now')
         )`
      ).run(log);
      db.prepare("INSERT INTO email_queue (log_id, max_attempts, next_attempt_at) VALUES (?, ?, ?)").run(
        log.id,
        maxAttempts,
        nextAttemptAt
      );
    })();
  },
  /** Puts an existing log entry back on the queue. */
  requeue(id2, maxAttempts, nextAttemptAt) {
    db.transaction(() => {
      db.prepare("UPDATE email_logs SET status = 'queued', error = NULL WHERE id = ?").run(id2);
      db.prepare("INSERT OR REPLACE INTO email_queue (log_id, max_attempts, next_attempt_at) VALUES (?, ?, ?)").run(
        id2,
        maxAttempts,
        nextAttemptAt
      );
    })();
  },
  findJob(logId) {
    return db.prepare(
      `SELECT q.attempts, q.max_attempts, l.recipient_email, l.recipient_name, l.reply_to, l.from_email, l.from_name, l.subject,
                l.html_content
         FROM email_queue q JOIN email_logs l ON l.id = q.log_id
         WHERE q.log_id = ?`
    ).get(logId);
  },
  lockJob(logId, until) {
    db.prepare("UPDATE email_queue SET locked_until = ? WHERE log_id = ?").run(until, logId);
  },
  /** Records the final outcome and removes the job. */
  finishJob(logId, status, error) {
    db.transaction(() => {
      db.prepare("UPDATE email_logs SET status = ?, error = ? WHERE id = ?").run(status, error, logId);
      db.prepare("DELETE FROM email_queue WHERE log_id = ?").run(logId);
    })();
  },
  scheduleRetry(logId, attempts, retryAt, error) {
    db.transaction(() => {
      db.prepare(
        "UPDATE email_queue SET attempts = ?, next_attempt_at = ?, locked_until = NULL, last_error = ? WHERE log_id = ?"
      ).run(attempts, retryAt, error, logId);
      db.prepare("UPDATE email_logs SET error = ? WHERE id = ?").run(
        `Attempt ${attempts} failed, retrying: ${error}`,
        logId
      );
    })();
  },
  dueJobIds(nowIso, limit) {
    const rows = db.prepare(
      `SELECT log_id FROM email_queue
         WHERE next_attempt_at <= ? AND (locked_until IS NULL OR locked_until < ?)
         ORDER BY next_attempt_at
         LIMIT ?`
    ).all(nowIso, nowIso, limit);
    return rows.map((r) => r.log_id);
  },
  /** Releases every lock, e.g. after a restart interrupted delivery. */
  unlockAll() {
    db.prepare("UPDATE email_queue SET locked_until = NULL").run();
  }
};

// server/src/services/email/transport.ts
import dns from "node:dns";
import nodemailer from "nodemailer";
async function createSmtpTransporter(smtpCfg) {
  const originalHost = smtpCfg.host;
  let resolvedHost = originalHost;
  try {
    const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(originalHost);
    if (!isIpv4) {
      const addresses = await dns.promises.resolve4(originalHost);
      if (addresses && addresses.length > 0) {
        resolvedHost = addresses[0];
      }
    }
  } catch (err) {
    logger.warn({ err }, `[SMTP DNS] Failed to resolve IPv4 for ${originalHost}, falling back to hostname`);
    resolvedHost = originalHost;
  }
  const isImplicitTls = smtpCfg.secure || smtpCfg.port === 465;
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === "true";
  return nodemailer.createTransport({
    host: resolvedHost,
    port: smtpCfg.port,
    secure: isImplicitTls,
    requireTLS: !isImplicitTls,
    auth: {
      user: smtpCfg.user,
      pass: smtpCfg.pass
    },
    tls: {
      servername: originalHost,
      rejectUnauthorized: !allowSelfSigned,
      minVersion: "TLSv1.2"
    },
    connectionTimeout: 15e3,
    greetingTimeout: 15e3,
    socketTimeout: 2e4
  });
}
var cachedToken = null;
async function acquireGraphAccessToken(cfg) {
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) {
    throw new Error("Microsoft Graph API is not fully configured (missing Tenant ID, Client ID, or Client Secret)");
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 6e4) {
    return cachedToken.accessToken;
  }
  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`;
  const bodyParams = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: bodyParams.toString()
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Azure AD OAuth error (${res.status}): ${errorBody}`);
  }
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1e3
  };
  return cachedToken.accessToken;
}
var EmailNotConfiguredError = class extends Error {
};
var onBehalfName = (sender2) => `${sender2.name} via Encalm Projects`;
function resolveGraphSender(sender2, cfg) {
  const own = sender2?.email.trim().toLowerCase();
  const domain = own?.split("@")[1];
  if (own && domain && (cfg.sendAsDomains ?? []).includes(domain)) return own;
  return cfg.senderEmail;
}
var NO_MAILBOX = /ErrorInvalidUser|MailboxNotEnabledForRESTAPI|ResourceNotFound|ErrorItemNotFound/;
async function graphSend(cfg, mailbox, message) {
  const accessToken = await acquireGraphAccessToken(cfg);
  const system = mailbox.toLowerCase() === cfg.senderEmail.toLowerCase();
  const replyTo = message.replyTo || (system ? message.sender?.email : void 0);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        toRecipients: [{ emailAddress: { address: message.to, name: message.recipientName || message.to } }],
        ...system && message.sender ? { from: { emailAddress: { address: mailbox, name: onBehalfName(message.sender) } } } : {},
        ...replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}
      },
      // The email appears in the sender's own Outlook "Sent Items".
      saveToSentItems: true
    })
  });
  if (res.ok || res.status === 202) return { ok: true };
  const errText = await res.text().catch(() => "");
  return { ok: false, status: res.status, errText };
}
async function deliver(message) {
  const cfg = getGraphConfig();
  if (isGraphConfigured(cfg)) {
    const mailbox = resolveGraphSender(message.sender, cfg);
    let result = await graphSend(cfg, mailbox, message);
    if (!result.ok && mailbox !== cfg.senderEmail && (result.status === 404 || NO_MAILBOX.test(result.errText))) {
      logger.warn(`[Email] ${mailbox} has no usable mailbox; sending through ${cfg.senderEmail} instead`);
      result = await graphSend(cfg, cfg.senderEmail, message);
    }
    if (!result.ok) throw new Error(`Microsoft Graph API failed (${result.status}): ${result.errText}`);
    return;
  }
  const smtpCfg = getSmtpConfig();
  if (!isSmtpConfigured(smtpCfg)) {
    throw new EmailNotConfiguredError("No email provider configured - kept in the in-app outbox");
  }
  const transporter = await createSmtpTransporter(smtpCfg);
  await transporter.sendMail({
    from: {
      name: message.sender ? onBehalfName(message.sender) : smtpCfg.fromName || "",
      address: smtpCfg.user
    },
    to: { name: message.recipientName || "", address: message.to },
    replyTo: message.replyTo || message.sender?.email || void 0,
    subject: message.subject,
    html: message.html
  });
}

// server/src/services/email/queue.ts
var EMAIL_MAX_ATTEMPTS = 5;
var EMAIL_RETRY_BASE_MS = 3e4;
var EMAIL_LOCK_MS = 2 * 6e4;
var workerTimer = null;
var processing = null;
var errorMessage = (err) => err instanceof Error && err.message || "Delivery failed";
function kickWorker() {
  if (workerTimer) setImmediate(() => void processEmailQueue().catch((err) => logger.error({ err }, "[Email Queue]")));
}
function queueEmail(options, maxAttempts = EMAIL_MAX_ATTEMPTS) {
  const id2 = `eml-${randomUUID2()}`;
  emailRepo.enqueue(
    {
      id: id2,
      recipient_email: options.to,
      recipient_name: options.recipientName || null,
      reply_to: options.replyTo || null,
      from_email: options.sender?.email || null,
      from_name: options.sender?.name || null,
      subject: options.subject,
      template_type: options.templateType,
      project_id: options.projectId || null,
      html_content: options.html
    },
    maxAttempts,
    (/* @__PURE__ */ new Date()).toISOString()
  );
  kickWorker();
  return { id: id2, status: "queued" };
}
async function deliverQueuedEmail(logId, now = Date.now()) {
  const job = emailRepo.findJob(logId);
  if (!job) return { id: logId, status: "failed", error: "Not queued" };
  emailRepo.lockJob(logId, new Date(now + EMAIL_LOCK_MS).toISOString());
  try {
    await deliver({
      to: job.recipient_email,
      recipientName: job.recipient_name,
      replyTo: job.reply_to,
      sender: job.from_email ? { email: job.from_email, name: job.from_name || job.from_email } : null,
      subject: job.subject,
      html: job.html_content
    });
    emailRepo.finishJob(logId, "sent", null);
    logger.info(`[Email] Delivered "${job.subject}" to ${job.recipient_email}`);
    return { id: logId, status: "sent" };
  } catch (err) {
    const message = errorMessage(err);
    if (err instanceof EmailNotConfiguredError) {
      emailRepo.finishJob(logId, "outbox", message);
      return { id: logId, status: "outbox", error: message };
    }
    const attempts = job.attempts + 1;
    if (attempts >= job.max_attempts) {
      emailRepo.finishJob(logId, "failed", message);
      logger.warn(
        `[Email] Giving up on "${job.subject}" to ${job.recipient_email} after ${attempts} attempt(s): ${message}`
      );
      return { id: logId, status: "failed", error: message };
    }
    const retryAt = new Date(now + EMAIL_RETRY_BASE_MS * 2 ** (attempts - 1)).toISOString();
    emailRepo.scheduleRetry(logId, attempts, retryAt, message);
    logger.warn(`[Email] Attempt ${attempts} for ${job.recipient_email} failed (${message}); retrying at ${retryAt}`);
    return { id: logId, status: "queued", error: message };
  }
}
function processEmailQueue(now = Date.now()) {
  if (processing) return processing;
  processing = (async () => {
    const due = emailRepo.dueJobIds(new Date(now).toISOString(), 25);
    for (const logId of due) await deliverQueuedEmail(logId, now);
    return due.length;
  })().finally(() => {
    processing = null;
  });
  return processing;
}
function startEmailWorker(intervalMs = 5e3) {
  if (workerTimer) return;
  emailRepo.unlockAll();
  workerTimer = setInterval(
    () => void processEmailQueue().catch((err) => logger.error({ err }, "[Email Queue]")),
    intervalMs
  );
  workerTimer.unref();
  kickWorker();
}
function stopEmailWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}
async function sendEmailNow(options) {
  const { id: id2 } = queueEmail(options, 1);
  return deliverQueuedEmail(id2);
}
function resendEmailLog(id2) {
  const status = emailRepo.findLogStatus(id2);
  if (!status) return { success: false, status: "not_found", error: "Email record not found" };
  if (status === "queued") return { success: true, status: "queued" };
  emailRepo.requeue(id2, EMAIL_MAX_ATTEMPTS, (/* @__PURE__ */ new Date()).toISOString());
  kickWorker();
  return { success: true, status: "queued" };
}

// server/src/services/email/templates.ts
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function baseEmailWrapper(contentHtml, previewText = "Encalm Projects Notification") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(previewText)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f7f5ef;
      color: #1a202c;
    }
    .wrapper {
      max-width: 600px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2ddd3;
      box-shadow: 0 4px 20px rgba(23, 62, 73, 0.06);
    }
    .header {
      background: #173e49;
      padding: 24px 32px;
      border-bottom: 3px solid #d19b35;
    }
    .brand {
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-sub {
      color: #d19b35;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .body-content {
      padding: 32px;
      font-size: 14px;
      line-height: 1.6;
      color: #2d3748;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-gold { background: #fdf3d8; color: #9a711f; border: 1px solid #eadcb1; }
    .badge-teal { background: #edf5f0; color: #2e7c67; border: 1px solid #cbe4d9; }
    .badge-red { background: #fae5e1; color: #b2473d; border: 1px solid #f3c2bc; }
    .card-box {
      background: #faf8f2;
      border: 1px solid #e8e3d5;
      border-radius: 8px;
      padding: 18px;
      margin: 20px 0;
    }
    .btn {
      display: inline-block;
      background: #2e7c67;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 16px;
    }
    .footer {
      background: #faf8f2;
      padding: 20px 32px;
      border-top: 1px solid #e8e3d5;
      font-size: 11px;
      color: #718096;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">ENCALM HOSPITALITY</div>
      <div class="brand-sub">Project Dashboard</div>
    </div>
    <div class="body-content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">This is an automated notification from the <strong>Encalm Project Dashboard</strong>.</p>
      <p style="margin: 0;">Encalm Hospitality Private Limited \u2022 Airport Lounges, Transit Hotels & F&B Operations</p>
    </div>
  </div>
</body>
</html>`;
}
function buildTagNotificationHtml(data) {
  return baseEmailWrapper(
    `
    <div style="margin-bottom: 20px;">
      <p style="font-size: 16px; font-weight: 700; color: #173e49; margin: 0 0 6px 0;">
        Hello ${esc(data.recipientName)},
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #2d3748;">
        <strong>${esc(data.taggedByName)}</strong> from the Project Delivery Team has tagged you on a <strong>${esc(data.entityType)}</strong> in:
      </p>
      <p style="margin: 6px 0 0 0; font-size: 17px; font-weight: 800; color: #173e49;">
        ${esc(data.projectName)} ${data.projectCode ? `<span style="font-size: 12px; font-weight: 600; color: #2e7c67; background: #edf5f0; padding: 2px 7px; border-radius: 4px; margin-left: 6px; border: 1px solid #cbe4d9;">${esc(data.projectCode)}</span>` : ""}
      </p>
    </div>

    <!-- Executive Project Context Grid -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; background: #faf8f3; border: 1px solid #e8e3d5; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
      <tbody>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600; width: 35%;">Facility / Location:</td>
          <td style="padding: 10px 14px; color: #173e49; font-weight: 700;">${esc(data.projectLocation || "Encalm Airport Facility")}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Current Project Stage:</td>
          <td style="padding: 10px 14px; color: #2e7c67; font-weight: 700;">${esc(data.currentStage || "Active Delivery")}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Tagged Item (${esc(data.entityType)}):</td>
          <td style="padding: 10px 14px; color: #173e49; font-weight: 700;">${esc(data.entityTitle)}</td>
        </tr>
        ${data.targetDate || data.entityContext ? `
        <tr>
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Timeline / Target Date:</td>
          <td style="padding: 10px 14px; color: #d19b35; font-weight: 700;">${esc(data.targetDate || data.entityContext)}</td>
        </tr>` : ""}
      </tbody>
    </table>

    <!-- Prominently Highlighted Comment / Action Required Card -->
    ${data.comment ? `
      <div style="background: #fffdf5; border: 2px solid #d19b35; border-radius: 10px; padding: 18px 20px; margin: 22px 0; box-shadow: 0 2px 8px rgba(209, 155, 53, 0.08);">
        <div style="margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #8c671b; text-transform: uppercase; letter-spacing: 0.8px;">
            \u{1F6A8} ACTION REQUIRED / COMMENT FROM ${esc(data.taggedByName.toUpperCase())}:
          </span>
        </div>
        <div style="font-size: 15px; font-weight: 600; color: #173e49; line-height: 1.6; white-space: pre-wrap;">
          "${esc(data.comment).replace(/@([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)?)/g, '<span style="color: #2e7c67; font-weight: 700; background: #edf5f0; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbe4d9;">@$1</span>')}"
        </div>
      </div>
    ` : ""}

    <!-- Zero-Login Reply Banner -->
    <div style="background: #edf5f0; border: 1.5px solid #2e7c67; border-radius: 8px; padding: 16px 18px; margin: 22px 0; text-align: left;">
      <div style="font-size: 13.5px; font-weight: 700; color: #173e49; margin-bottom: 4px;">
        \u2709\uFE0F Zero-Login Required \u2014 Simply Hit "Reply" in Outlook
      </div>
      <div style="font-size: 12.5px; color: #235445; line-height: 1.5;">
        You do not need to create an account or log into the dashboard. When you reply directly to this email in Outlook, your response will be delivered straight to <strong>${esc(data.taggedByName)}</strong>${data.senderEmail ? ` at <a href="mailto:${esc(data.senderEmail)}" style="color: #173e49; font-weight: 700;">${esc(data.senderEmail)}</a>` : ""}.
      </div>
    </div>

    <!-- Optional Dashboard Link -->
    <div style="text-align: center; margin-top: 18px;">
      <a href="${esc(data.dashboardUrl)}" style="color: #718096; font-size: 12px; text-decoration: underline;" target="_blank">
        (Optional) Open Project Workspace in Dashboard \u2192
      </a>
    </div>
  `,
    `Action Required in ${esc(data.projectName)}: ${esc(data.entityTitle)}`
  );
}
function buildCriticalIssueHtml(data) {
  return baseEmailWrapper(
    `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
      <span class="badge badge-red">CRITICAL ISSUE ALERT</span>
      <span class="badge badge-gold">${esc(data.projectName)}</span>
    </div>

    <p style="font-size: 16px; font-weight: 700; color: #b2473d; margin-top: 0;">
      Attention ${esc(data.recipientName)},
    </p>
    <p>
      A high-severity issue requiring immediate leadership oversight has been logged on <strong>${esc(data.projectName)}</strong>.
    </p>

    <div class="card-box" style="border-left: 4px solid #b2473d;">
      <div style="font-size: 15px; font-weight: 700; color: #173e49; margin-bottom: 6px;">
        ${esc(data.issueTitle)}
      </div>
      <div style="font-size: 12px; color: #718096; margin-bottom: 12px;">
        Severity: <strong style="color: #b2473d;">${esc(data.severity)}</strong> &nbsp;\u2022&nbsp; 
        Category: <strong>${esc(data.category || "General")}</strong>
        ${data.raisedBy ? ` &nbsp;\u2022&nbsp; Raised by: <strong>${esc(data.raisedBy)}</strong>` : ""}
      </div>
      <p style="margin: 0; font-size: 13px; color: #2d3748; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2ddd3;">
        ${esc(data.detail)}
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" style="background: #b2473d;" target="_blank">Review Critical Issue \u2192</a>
    </div>
  `,
    `Critical Issue Alert: ${esc(data.projectName)}`
  );
}
function buildMilestoneApprovalHtml(data) {
  return baseEmailWrapper(
    `
    <p style="font-size: 16px; font-weight: 700; color: #173e49; margin-top: 0;">
      Dear ${esc(data.recipientName)},
    </p>
    <p>
      A milestone requiring governance sign-off on <strong>${esc(data.projectName)}</strong> is waiting for review.
    </p>

    <div class="card-box">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #718096; margin-bottom: 6px;">
        Milestone Pending Approval
      </div>
      <div style="font-size: 16px; font-weight: 700; color: #173e49; margin-bottom: 8px;">
        ${esc(data.milestoneTitle)}
      </div>
      <div style="font-size: 12px; color: #4a5568;">
        Target Date: <strong>${esc(data.targetDate)}</strong> 
        ${data.stage ? `&nbsp;\u2022&nbsp; Stage: <strong>${esc(data.stage)}</strong>` : ""}
      </div>
    </div>

    <p>As Project Coordinator, please log in to approve or reject this milestone milestone request.</p>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" target="_blank">Review & Sign Off Milestone \u2192</a>
    </div>
  `,
    `Milestone Approval: ${esc(data.milestoneTitle)}`
  );
}
function buildProjectSummaryHtml(data) {
  return baseEmailWrapper(
    `
    <p style="font-size: 16px; font-weight: 700; color: #173e49; margin-top: 0;">
      Hello ${esc(data.recipientName)},
    </p>
    <p>
      <strong>${esc(data.senderName)}</strong> has shared an executive project status update for <strong>${esc(data.projectName)}</strong>.
    </p>

    <div class="card-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 16px; font-weight: 700; color: #173e49;">${esc(data.projectName)}</span>
        <span class="badge badge-teal">${esc(data.status)}</span>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0;">
        <tr>
          <td style="padding: 6px 0; color: #718096;">Progress:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #2e7c67;">${esc(data.progress)}% Completed</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #718096;">Health:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right;">${esc(data.health)}</td>
        </tr>
      </table>

      ${data.customNote ? `
        <div style="margin-top: 12px; padding: 12px; background: #ffffff; border-radius: 6px; border: 1px solid #e2ddd3;">
          <div style="font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; margin-bottom: 4px;">Executive Note:</div>
          <div style="font-size: 13px; color: #2d3748; white-space: pre-wrap;">${esc(data.customNote)}</div>
        </div>
      ` : ""}
    </div>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" target="_blank">Open Project in Dashboard \u2192</a>
    </div>
  `,
    `Project Update: ${esc(data.projectName)}`
  );
}
function buildTestEmailHtml(recipientName) {
  return baseEmailWrapper(
    `
    <p style="font-size: 16px; font-weight: 700; color: #2e7c67; margin-top: 0;">
      \u2713 SMTP Integration Connected Successfully!
    </p>
    <p>
      Hello <strong>${esc(recipientName)}</strong>,
    </p>
    <p>
      This is a test notification confirming that the Encalm Project Dashboard email service is operational and properly authenticated with your SMTP server.
    </p>

    <div class="card-box" style="border-left: 4px solid #2e7c67;">
      <div style="font-size: 13px; color: #2d3748;">
        <strong>Configuration Status:</strong> Active & Verified<br />
        <strong>Timestamp:</strong> ${(/* @__PURE__ */ new Date()).toUTCString()}
      </div>
    </div>
  `,
    "Encalm Project Dashboard SMTP Test Email"
  );
}

// server/src/services/email/directory.ts
async function searchEncalmDirectory(searchQuery = "") {
  const cfg = getGraphConfig();
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) {
    return [];
  }
  try {
    const accessToken = await acquireGraphAccessToken(cfg);
    const cleanQuery = encodeURIComponent(searchQuery.trim().replace(/['"]/g, ""));
    let url = "https://graph.microsoft.com/v1.0/users?$top=30&$select=id,displayName,mail,userPrincipalName,jobTitle,department";
    if (cleanQuery) {
      url += `&$filter=startswith(displayName,'${cleanQuery}') or startswith(mail,'${cleanQuery}') or startswith(userPrincipalName,'${cleanQuery}')`;
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn(`[Microsoft Graph Directory] Query failed (${res.status}): ${errText}`);
      return [];
    }
    const data = await res.json();
    const localByEmail = new Map(usersRepo.listDirectory().map((u) => [u.email?.toLowerCase(), u]));
    return (data.value || []).filter((u) => u.displayName && (u.mail || u.userPrincipalName)).map((u) => {
      const email = (u.mail || u.userPrincipalName || "").toLowerCase().trim();
      const name = (u.displayName || "").trim();
      const parts = name.split(/\s+/);
      const initials = ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase() || "U";
      const local = localByEmail.get(email);
      const user = {
        id: local ? local.id : `azure-${u.id}`,
        name: local ? local.name : name,
        email,
        // Directory people are only tagged and emailed. App roles are given by a
        // coordinator, never guessed from a job title.
        role: local ? local.role : "stakeholder",
        title: local ? local.title : u.jobTitle || u.department || "Encalm Team",
        department: u.department || void 0,
        initials: local ? local.initials : initials
      };
      try {
        usersRepo.upsertDirectoryUser({ ...user, name });
      } catch (err) {
        logger.warn({ err }, "[Microsoft Graph Directory] Could not save directory user");
      }
      return user;
    });
  } catch (err) {
    logger.error({ err }, "[Microsoft Graph Directory Error]");
    return [];
  }
}

// server/src/services/notifications.ts
function dispatchTagNotifications(params) {
  const {
    taggedUserIds,
    taggedBy,
    entityType,
    entityTitle,
    entityContext,
    comment,
    projectId: projectId5,
    projectName: projectName2,
    origin = "http://localhost:5173",
    sender: sender2
  } = params;
  const dashboardUrl = `${origin}/project/${projectId5}`;
  const notifType = entityType === "Issue" ? "tagged_issue" : "tagged_task";
  for (const userId of taggedUserIds) {
    if (!userId) continue;
    const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(userId);
    if (!user) continue;
    const recipientName = user.name || userId;
    const recipientEmail = user.email;
    const messageBody = comment ? `${taggedBy} tagged you on ${entityType.toLowerCase()} "${entityTitle}" in ${projectName2}: "${comment}"` : `${taggedBy} tagged you on ${entityType.toLowerCase()} "${entityTitle}" in ${projectName2}`;
    db.prepare(
      `
      INSERT INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `
    ).run(
      `notif-tag-${randomUUID3()}`,
      notifType,
      `Tagged on ${entityType}: ${entityTitle}`,
      messageBody,
      projectId5,
      `/project/${projectId5}`,
      userId
    );
    if (recipientEmail) {
      const html = buildTagNotificationHtml({
        recipientName,
        taggedByName: taggedBy,
        senderEmail: sender2?.email,
        entityType,
        entityTitle,
        entityContext,
        comment,
        projectName: projectName2,
        dashboardUrl
      });
      queueEmail({
        to: recipientEmail,
        recipientName,
        sender: sender2,
        replyTo: sender2?.email,
        subject: `Tagged on ${entityType}: ${entityTitle} (${projectName2})`,
        html,
        templateType: "tag_notification",
        projectId: projectId5
      });
    }
  }
}
function dispatchCriticalIssueAlert(params) {
  const {
    issueTitle,
    severity: severity2,
    category,
    detail,
    raisedBy,
    projectId: projectId5,
    projectName: projectName2,
    origin = "http://localhost:5173",
    sender: sender2
  } = params;
  const dashboardUrl = `${origin}/project/${projectId5}`;
  const leaders = db.prepare("SELECT id, name, email, role FROM users WHERE role IN ('hod', 'coordinator')").all();
  for (const leader of leaders) {
    if (!leader.email) continue;
    const html = buildCriticalIssueHtml({
      recipientName: leader.name,
      issueTitle,
      severity: severity2,
      category,
      detail,
      raisedBy,
      projectName: projectName2,
      dashboardUrl
    });
    queueEmail({
      to: leader.email,
      recipientName: leader.name,
      sender: sender2,
      replyTo: sender2?.email,
      subject: `\u{1F6A8} CRITICAL ISSUE: ${issueTitle} (${projectName2})`,
      html,
      templateType: "critical_issue",
      projectId: projectId5
    });
  }
}
function dispatchMilestoneApprovalAlert(params) {
  const {
    milestoneTitle,
    targetDate,
    stage,
    projectId: projectId5,
    projectName: projectName2,
    origin = "http://localhost:5173",
    sender: sender2
  } = params;
  const dashboardUrl = `${origin}/project/${projectId5}`;
  const coordinators = db.prepare("SELECT id, name, email FROM users WHERE role = 'coordinator'").all();
  for (const coord of coordinators) {
    if (!coord.email) continue;
    const html = buildMilestoneApprovalHtml({
      recipientName: coord.name,
      milestoneTitle,
      targetDate,
      stage,
      projectName: projectName2,
      dashboardUrl
    });
    queueEmail({
      to: coord.email,
      recipientName: coord.name,
      sender: sender2,
      replyTo: sender2?.email,
      subject: `Milestone Approval Required: ${milestoneTitle} (${projectName2})`,
      html,
      templateType: "milestone_approval",
      projectId: projectId5
    });
  }
}

// server/src/services/progress.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function weightedProgress(phases) {
  if (phases.length === 0) return 0;
  const durations = phases.map((p) => {
    if (!p.planned_start || !p.planned_finish) return null;
    const start = new Date(p.planned_start).getTime();
    const finish = new Date(p.planned_finish).getTime();
    return !isNaN(start) && !isNaN(finish) && finish >= start ? Math.max(1, Math.round((finish - start) / DAY_MS)) : null;
  });
  const hasExplicit = phases.some((p) => typeof p.weight === "number" && p.weight > 0);
  const weights = phases.map((p, i) => {
    if (typeof p.weight === "number" && p.weight > 0) return p.weight;
    if (!hasExplicit && durations[i] !== null) return durations[i];
    return 1;
  });
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const weighted = phases.reduce(
    (sum, p, i) => sum + weights[i] / total * Math.max(0, Math.min(100, Number(p.progress) || 0)),
    0
  );
  return Math.max(0, Math.min(100, Math.round(weighted)));
}
function recomputeProjectProgress(projectId5) {
  const progress = weightedProgress(phasesRepo.listForProject(projectId5));
  projectsRepo.update(projectId5, { progress, last_updated: todayLabel() });
  return progress;
}

// server/src/services/project-items.service.ts
var STAGE_LABEL = {
  upcoming: "Not started",
  active: "In progress",
  blocked: "Blocked",
  complete: "Complete"
};
function shownStageState(status, progress) {
  if (status === "blocked") return "blocked";
  if (progress >= 100) return "complete";
  if (progress > 0) return "active";
  return status === "active" ? "active" : "upcoming";
}
var nextOrder = (table, projectId5) => (db.prepare(`SELECT MAX(order_index) AS m FROM ${table} WHERE project_id = ?`).get(projectId5).m ?? -1) + 1;
function projectName(projectId5) {
  const project = projectsRepo.find(projectId5);
  if (!project) throw notFound("Project");
  return project.name;
}
function newlyTagged(stored, next) {
  if (!next) return [];
  const before = parseTaggedUsers2(stored);
  return next.filter((id2) => !before.includes(id2));
}
function addStage(projectId5, input, actor4) {
  const name = projectName(projectId5);
  const id2 = input.id || `${projectId5}-phase-${Date.now()}`;
  if (phasesRepo.exists(id2)) throw conflict("Stage with this id already exists");
  const tagged = input.taggedUsers ?? [];
  phasesRepo.insert({
    id: id2,
    project_id: projectId5,
    name: input.name || "New stage",
    status: input.status || "upcoming",
    progress: input.progress ?? 0,
    weight: input.weight ?? null,
    budget: input.budget ?? null,
    owner: input.owner || "PMO",
    order_index: phasesRepo.nextOrderIndex(projectId5),
    planned_start: input.plannedStart || null,
    planned_finish: input.plannedFinish || null,
    actual_finish: input.actualFinish || null,
    work_completed: input.workCompleted || null,
    next_action: input.nextAction || null,
    decision_required: input.decisionRequired || null,
    tagged_users: JSON.stringify(tagged),
    updated_at: todayLabel()
  });
  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Stage",
      entityTitle: input.name || "Stage",
      entityContext: input.nextAction || input.workCompleted || void 0,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  recomputeProjectProgress(projectId5);
  return id2;
}
function updateStage(projectId5, stageId2, patch, actor4) {
  const stage = phasesRepo.find(stageId2, projectId5);
  if (!stage) throw notFound("Stage");
  const name = projectName(projectId5);
  const tagged = newlyTagged(stage.tagged_users, patch.taggedUsers);
  phasesRepo.update(stageId2, projectId5, {
    updated_at: todayLabel(),
    name: patch.name,
    status: patch.status,
    progress: patch.progress ?? void 0,
    weight: patch.weight,
    budget: patch.budget,
    owner: patch.owner,
    planned_start: patch.plannedStart,
    planned_finish: patch.plannedFinish,
    actual_finish: patch.actualFinish,
    work_completed: patch.workCompleted,
    next_action: patch.nextAction,
    decision_required: patch.decisionRequired,
    tagged_users: patch.taggedUsers !== void 0 ? JSON.stringify(patch.taggedUsers) : void 0
  });
  const oldProgress = Number(stage.progress) || 0;
  const newProgress = patch.progress ?? oldProgress;
  const before = shownStageState(stage.status, oldProgress);
  const after = shownStageState(patch.status ?? stage.status, newProgress);
  if (newProgress !== oldProgress || before !== after) {
    const stageName = patch.name || stage.name;
    const changes = [
      newProgress !== oldProgress ? `${oldProgress}% \u2192 ${newProgress}%` : "",
      before !== after ? `${STAGE_LABEL[before]} \u2192 ${STAGE_LABEL[after]}` : ""
    ].filter(Boolean);
    const type = after === "complete" && before !== "complete" ? "stage_complete" : after === "blocked" && before !== "blocked" ? "stage_blocked" : "stage_update";
    const title = type === "stage_complete" ? `Stage complete: ${stageName}` : type === "stage_blocked" ? `Stage blocked: ${stageName}` : `Stage updated: ${stageName}`;
    notifyProjectWatchers({
      type,
      baseId: `notif-stage-${stageId2}-${Date.now()}`,
      title,
      message: `${actor4.user.name} updated ${stageName} on ${name}: ${changes.join(", ")}.`,
      projectId: projectId5,
      actorId: actor4.user.id
    });
  }
  if (patch.decisionRequired) {
    broadcastNotification(
      "system",
      `notif-dec-${stageId2}-${Date.now()}`,
      `Decision Needed: ${stage.name}`,
      `${actor4.user.name} requested a decision on stage "${stage.name}": ${patch.decisionRequired}`,
      projectId5,
      `/project/${projectId5}`
    );
  }
  if (patch.notify && tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Stage",
      entityTitle: patch.name || stage.name,
      entityContext: patch.nextAction || patch.workCompleted || stage.work_completed || void 0,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  recomputeProjectProgress(projectId5);
}
function removeStage(projectId5, stageId2) {
  if (!phasesRepo.find(stageId2, projectId5)) throw notFound("Stage");
  const stages = phasesRepo.listForProject(projectId5);
  if (stages.length <= 1) throw badRequest("A project must retain at least one stage");
  phasesRepo.delete(stageId2, projectId5);
  phasesRepo.setOrder(stages.filter((s) => s.id !== stageId2).map((s) => s.id));
  recomputeProjectProgress(projectId5);
}
function moveStage(projectId5, index, direction) {
  projectName(projectId5);
  const ids = phasesRepo.listForProject(projectId5).map((s) => s.id);
  const target2 = index + direction;
  if (index < 0 || index >= ids.length || target2 < 0 || target2 >= ids.length) throw badRequest("Invalid move target");
  [ids[index], ids[target2]] = [ids[target2], ids[index]];
  phasesRepo.setOrder(ids);
  recomputeProjectProgress(projectId5);
}
function addMilestone(projectId5, input, actor4) {
  const name = projectName(projectId5);
  const id2 = input.id || `${projectId5}-milestone-${Date.now()}`;
  if (milestonesRepo.exists(id2)) throw conflict("Milestone with this id already exists");
  const tagged = input.taggedUsers ?? [];
  milestonesRepo.insert({
    id: id2,
    project_id: projectId5,
    title: input.title,
    date: input.date,
    status: input.status || "upcoming",
    stage: input.stage || null,
    owner: input.owner || "Project Lead",
    approval_required: input.approvalRequired ? 1 : 0,
    approval_status: input.approvalStatus || (input.approvalRequired ? "Pending" : "Not required"),
    completed_date: input.completedDate || null,
    tagged_users: JSON.stringify(tagged),
    order_index: nextOrder("milestones", projectId5)
  });
  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Milestone",
      entityTitle: input.title,
      entityContext: `Target date: ${input.date}${input.stage ? ` \u2022 Stage: ${input.stage}` : ""}`,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  if (input.approvalRequired) {
    broadcastNotification(
      "approval_required",
      `notif-appr-${id2}`,
      `Approval Requested: ${input.title}`,
      `${name} requires milestone approval from Coordinator.`,
      projectId5,
      `/project/${projectId5}`
    );
    dispatchMilestoneApprovalAlert({
      milestoneTitle: input.title,
      targetDate: input.date,
      stage: input.stage ?? void 0,
      requestedBy: actor4.user.name,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  return id2;
}
function updateMilestone(projectId5, milestoneId, patch, actor4) {
  const milestone = milestonesRepo.find(milestoneId, projectId5);
  if (!milestone) throw notFound("Milestone");
  if (patch.approvalStatus !== void 0 && actor4.user.role !== "coordinator") {
    throw forbidden("Only Project Coordinators can approve or reject milestones");
  }
  const name = projectName(projectId5);
  const tagged = newlyTagged(milestone.tagged_users, patch.taggedUsers);
  milestonesRepo.update(milestoneId, projectId5, {
    title: patch.title,
    date: patch.date,
    status: patch.status,
    stage: patch.stage,
    owner: patch.owner,
    approval_required: patch.approvalRequired !== void 0 ? patch.approvalRequired ? 1 : 0 : void 0,
    approval_status: patch.approvalStatus,
    completed_date: patch.completedDate,
    tagged_users: patch.taggedUsers !== void 0 ? JSON.stringify(patch.taggedUsers) : void 0
  });
  if (patch.notify && tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Milestone",
      entityTitle: patch.title || milestone.title,
      entityContext: `Target date: ${patch.date || milestone.date}`,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
}
function removeMilestone(projectId5, milestoneId) {
  if (!milestonesRepo.delete(milestoneId, projectId5)) throw notFound("Milestone");
}
function addIssue(projectId5, input, actor4) {
  const name = projectName(projectId5);
  const id2 = input.id || `${projectId5}-issue-${Date.now()}`;
  if (issuesRepo.exists(id2)) throw conflict("Issue with this id already exists");
  const tagged = input.taggedUsers ?? [];
  issuesRepo.insert({
    id: id2,
    project_id: projectId5,
    title: input.title,
    detail: input.detail,
    severity: input.severity || "Medium",
    owner: input.owner || "Project Lead",
    category: input.category || "Other",
    status: input.status || "Open",
    stage: input.stage || null,
    date_raised: input.issueAriseDate || input.dateRaised || todayLabel(),
    due_date: input.targetClosureDate || input.dueDate || null,
    impact_cost: input.impactCost || null,
    impact_schedule: input.impactSchedule || null,
    impact_scope: input.impactScope || null,
    action: input.action || null,
    resolution: input.resolution || null,
    tagged_users: JSON.stringify(tagged),
    order_index: nextOrder("issues", projectId5)
  });
  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Issue",
      entityTitle: input.title,
      entityContext: input.detail,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  if (input.severity === "High") {
    broadcastNotification(
      "high_issue",
      `notif-iss-${id2}`,
      `Critical Issue: ${input.title}`,
      `High priority issue logged on ${name}: ${input.detail}`,
      projectId5,
      `/project/${projectId5}`
    );
    dispatchCriticalIssueAlert({
      issueTitle: input.title,
      severity: "High",
      category: input.category ?? void 0,
      detail: input.detail,
      raisedBy: actor4.user.name,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  return id2;
}
function updateIssue(projectId5, issueId, patch, actor4) {
  const issue = issuesRepo.find(issueId, projectId5);
  if (!issue) throw notFound("Issue");
  const name = projectName(projectId5);
  const tagged = newlyTagged(issue.tagged_users, patch.taggedUsers);
  issuesRepo.update(issueId, projectId5, {
    title: patch.title,
    detail: patch.detail,
    severity: patch.severity,
    owner: patch.owner,
    category: patch.category,
    status: patch.status,
    stage: patch.stage,
    due_date: patch.dueDate !== void 0 ? patch.dueDate : patch.targetClosureDate,
    date_raised: patch.dateRaised !== void 0 ? patch.dateRaised : patch.issueAriseDate,
    impact_cost: patch.impactCost,
    impact_schedule: patch.impactSchedule,
    impact_scope: patch.impactScope,
    action: patch.action,
    resolution: patch.resolution,
    tagged_users: patch.taggedUsers !== void 0 ? JSON.stringify(patch.taggedUsers) : void 0
  });
  if (patch.notify && tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Issue",
      entityTitle: patch.title || issue.title,
      entityContext: patch.detail || issue.detail,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  if (patch.severity === "High" && issue.severity !== "High") {
    dispatchCriticalIssueAlert({
      issueTitle: patch.title || issue.title,
      severity: "High",
      category: patch.category || issue.category || void 0,
      detail: patch.detail || issue.detail,
      raisedBy: actor4.user.name,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
}
function removeIssue(projectId5, issueId) {
  if (!issuesRepo.delete(issueId, projectId5)) throw notFound("Issue");
}
function addUpdate(projectId5, input, actor4) {
  const name = projectName(projectId5);
  const id2 = `${projectId5}-update-${Date.now()}`;
  const today = todayLabel();
  updatesRepo.insert({
    id: id2,
    project_id: projectId5,
    date: input.date || today,
    // Always the signed-in user: the client cannot post under someone else's name.
    author: actor4.user.name,
    role: actor4.user.title || "Project Lead",
    text: input.text,
    stage: input.stage || null,
    kind: input.kind || "General"
  });
  projectsRepo.update(projectId5, { last_updated: today });
  const tagged = [...new Set(input.taggedUsers ?? [])];
  const kind = input.kind || "General";
  const text2 = input.text.length > 160 ? `${input.text.slice(0, 157)}...` : input.text;
  notifyProjectWatchers({
    type: "stage_update",
    baseId: `notif-update-${id2}`,
    title: `${kind} update: ${name}`,
    message: `${actor4.user.name}${input.stage ? ` on ${input.stage}` : ""}: ${text2}`,
    projectId: projectId5,
    actorId: actor4.user.id,
    exclude: tagged
  });
  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor4.user.name,
      entityType: "Update",
      entityTitle: `${input.kind || "General"} update${input.stage ? `: ${input.stage}` : ""}`,
      comment: input.text,
      projectId: projectId5,
      projectName: name,
      origin: actor4.origin,
      sender: { email: actor4.user.email, name: actor4.user.name }
    });
  }
  return id2;
}

// server/src/routes/phases.ts
var router3 = Router3({ mergeParams: true });
var projectId2 = (req) => req.params.id;
var stageId = (req) => req.params.phaseId;
var actor = (req) => ({ user: req.user, origin: publicBaseUrl(req) });
function respond(req, res, status = 200) {
  afterCommit(saveDatabaseSnapshot);
  res.status(status).json({ project: requireProject(projectId2(req)) });
}
var stagesAccess = [requireAuth, requireProjectAccess()];
router3.post(
  "/",
  ...stagesAccess,
  validate({ params: projectParams, body: createPhaseBody }),
  audited({ action: "create", entityType: "stage", table: "phases" }),
  transactional((req, res) => {
    res.locals.auditEntityId = addStage(projectId2(req), req.body, actor(req));
    respond(req, res, 201);
  })
);
router3.patch(
  "/:phaseId",
  ...stagesAccess,
  validate({ params: phaseParams, body: updatePhaseBody }),
  audited({ action: "update", entityType: "stage", table: "phases", id: stageId }),
  transactional((req, res) => {
    updateStage(projectId2(req), stageId(req), req.body, actor(req));
    respond(req, res);
  })
);
router3.delete(
  "/:phaseId",
  ...stagesAccess,
  validate({ params: phaseParams }),
  audited({ action: "delete", entityType: "stage", table: "phases", id: stageId }),
  transactional((req, res) => {
    removeStage(projectId2(req), stageId(req));
    respond(req, res);
  })
);
router3.post(
  "/move",
  ...stagesAccess,
  validate({ params: projectParams, body: movePhaseBody }),
  audited({ action: "move", entityType: "stage", details: (req) => req.body }),
  transactional((req, res) => {
    moveStage(projectId2(req), req.body.phaseIndex, req.body.direction);
    respond(req, res);
  })
);
var phases_default = router3;

// server/src/routes/milestones.ts
import { Router as Router4 } from "express";
var router4 = Router4({ mergeParams: true });
var projectId3 = (req) => req.params.id;
var itemId = (req) => req.params.milestoneId;
var actor2 = (req) => ({ user: req.user, origin: publicBaseUrl(req) });
function respond2(req, res, status = 200) {
  afterCommit(saveDatabaseSnapshot);
  res.status(status).json({ project: requireProject(projectId3(req)) });
}
router4.post(
  "/",
  requireAuth,
  requireProjectAccess(),
  validate({ params: projectParams, body: createMilestoneBody }),
  audited({ action: "create", entityType: "milestone", table: "milestones" }),
  transactional((req, res) => {
    res.locals.auditEntityId = addMilestone(projectId3(req), req.body, actor2(req));
    respond2(req, res, 201);
  })
);
router4.patch(
  "/:milestoneId",
  requireAuth,
  requireProjectAccess(),
  validate({ params: milestoneParams, body: updateMilestoneBody }),
  audited({ action: "update", entityType: "milestone", table: "milestones", id: itemId }),
  transactional((req, res) => {
    updateMilestone(projectId3(req), itemId(req), req.body, actor2(req));
    respond2(req, res);
  })
);
router4.delete(
  "/:milestoneId",
  requireAuth,
  requireProjectAccess(),
  validate({ params: milestoneParams }),
  audited({ action: "delete", entityType: "milestone", table: "milestones", id: itemId }),
  transactional((req, res) => {
    removeMilestone(projectId3(req), itemId(req));
    respond2(req, res);
  })
);
var milestones_default = router4;

// server/src/routes/issues.ts
import { Router as Router5 } from "express";
var router5 = Router5({ mergeParams: true });
var projectId4 = (req) => req.params.id;
var itemId2 = (req) => req.params.issueId;
var actor3 = (req) => ({ user: req.user, origin: publicBaseUrl(req) });
function respond3(req, res, status = 200) {
  afterCommit(saveDatabaseSnapshot);
  res.status(status).json({ project: requireProject(projectId4(req)) });
}
router5.post(
  "/",
  requireAuth,
  requireProjectAccess(),
  validate({ params: projectParams, body: createIssueBody }),
  audited({ action: "create", entityType: "issue", table: "issues" }),
  transactional((req, res) => {
    res.locals.auditEntityId = addIssue(projectId4(req), req.body, actor3(req));
    respond3(req, res, 201);
  })
);
router5.patch(
  "/:issueId",
  requireAuth,
  requireProjectAccess(),
  validate({ params: issueParams, body: updateIssueBody }),
  audited({ action: "update", entityType: "issue", table: "issues", id: itemId2 }),
  transactional((req, res) => {
    updateIssue(projectId4(req), itemId2(req), req.body, actor3(req));
    respond3(req, res);
  })
);
router5.delete(
  "/:issueId",
  requireAuth,
  requireProjectAccess(),
  validate({ params: issueParams }),
  audited({ action: "delete", entityType: "issue", table: "issues", id: itemId2 }),
  transactional((req, res) => {
    removeIssue(projectId4(req), itemId2(req));
    respond3(req, res);
  })
);
var issues_default = router5;

// server/src/routes/updates.ts
import { Router as Router6 } from "express";

// server/src/utils/paging.ts
function pageFrom(query, defaultLimit, maxLimit = 200) {
  const limit = Number(query.limit ?? defaultLimit);
  const offset = Number(query.offset ?? 0);
  return {
    limit: Math.min(Math.max(Number.isFinite(limit) ? limit : defaultLimit, 1), maxLimit),
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0
  };
}

// server/src/routes/updates.ts
var projectUpdatesRouter = Router6({ mergeParams: true });
var globalUpdatesRouter = Router6();
globalUpdatesRouter.get("/", requireAuth, validate({ query: pageQuery }), (req, res) => {
  const page = pageFrom(req.query, 100);
  const updates = updatesRepo.listRecent(page).map((r) => ({
    id: r.id,
    date: r.date,
    author: r.author,
    role: r.role,
    text: r.text,
    stage: r.stage,
    kind: r.kind,
    project: { id: r.project_id, name: r.project_name, code: r.project_code }
  }));
  res.json({ updates, total: updatesRepo.countAll(), ...page });
});
projectUpdatesRouter.get("/", requireAuth, validate({ params: projectParams, query: pageQuery }), (req, res) => {
  const id2 = req.params.id;
  if (!projectsRepo.exists(id2)) throw notFound("Project");
  const page = pageFrom(req.query, 100);
  res.json({ updates: updatesRepo.listForProject(id2, page), total: updatesRepo.countForProject(id2), ...page });
});
projectUpdatesRouter.post(
  "/",
  requireAuth,
  requireProjectAccess(),
  validate({ params: projectParams, body: createUpdateBody }),
  audited({ action: "create", entityType: "update", table: "updates" }),
  transactional((req, res) => {
    const id2 = req.params.id;
    res.locals.auditEntityId = addUpdate(id2, req.body, { user: req.user, origin: publicBaseUrl(req) });
    afterCommit(saveDatabaseSnapshot);
    res.status(201).json({ project: requireProject(id2) });
  })
);

// server/src/routes/notifications.ts
import { Router as Router7 } from "express";
var router6 = Router7();
router6.use(requireAuth);
router6.get("/", validate({ query: pageQuery }), (req, res) => {
  const userId = req.user.id;
  const page = pageFrom(req.query, 50);
  res.json({
    notifications: notificationsRepo.listForRecipient(userId, page).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      projectId: n.project_id,
      link: n.link,
      read: Boolean(n.read),
      createdAt: n.created_at
    })),
    unreadCount: notificationsRepo.unreadCount(userId),
    total: notificationsRepo.countForRecipient(userId),
    ...page
  });
});
router6.patch("/:id/read", validate({ params: idParams }), (req, res) => {
  if (!notificationsRepo.markRead(req.params.id, req.user.id)) {
    return res.status(404).json({ error: "Notification not found" });
  }
  return res.json({ success: true });
});
router6.post("/read-all", (req, res) => {
  notificationsRepo.markAllRead(req.user.id);
  res.json({ success: true });
});
router6.delete("/:id", validate({ params: idParams }), (req, res) => {
  if (!notificationsRepo.delete(req.params.id, req.user.id)) {
    return res.status(404).json({ error: "Notification not found" });
  }
  return res.json({ success: true });
});
var notifications_default = router6;

// server/src/routes/system.ts
import { Router as Router8 } from "express";

// server/src/repositories/system.repo.ts
var COUNTED_TABLES = ["projects", "users", "phases", "milestones", "issues", "updates"];
var systemRepo = {
  /** True when the database answers a trivial query. */
  ping() {
    const row = db.prepare("SELECT 1 AS alive").get();
    return row?.alive === 1;
  },
  rowCounts() {
    return Object.fromEntries(
      COUNTED_TABLES.map((table) => [
        table,
        db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count
      ])
    );
  },
  recentNotifications(limit) {
    return db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?").all(limit);
  }
};

// server/src/utils/scheduled-backup.ts
import fs7 from "node:fs";
import path7 from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import Database2 from "better-sqlite3";
function backupConfig(env2 = process.env) {
  const time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(env2.BACKUP_TIME ?? "") ? env2.BACKUP_TIME : "02:15";
  return {
    enabled: env2.BACKUP_ENABLED ? env2.BACKUP_ENABLED !== "false" : env2.NODE_ENV === "production",
    dir: env2.BACKUP_DIR || path7.join(dataDir, "backups"),
    retentionDays: Math.max(1, Number(env2.BACKUP_RETENTION_DAYS) || 30),
    time
  };
}
var KEEP_AT_LEAST = 7;
var NAME = /^encalm-(\d{8}T\d{6}Z)\.db\.gz$/;
var DAY_MS2 = 24 * 60 * 60 * 1e3;
var last = null;
var running = null;
var timer = null;
var stampOf = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
var fromStamp = (s) => /* @__PURE__ */ new Date(
  `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
);
function listBackups(dir) {
  if (!fs7.existsSync(dir)) return [];
  return fs7.readdirSync(dir).map((name) => ({ name, match: NAME.exec(name) })).filter((f) => Boolean(f.match)).map(({ name, match }) => ({
    name,
    size: fs7.statSync(path7.join(dir, name)).size,
    createdAt: fromStamp(match[1]).toISOString()
  })).sort((a, b) => b.name.localeCompare(a.name));
}
function mirrorUploads(from, to) {
  if (!fs7.existsSync(from)) return 0;
  let copied = 0;
  for (const entry of fs7.readdirSync(from, { withFileTypes: true })) {
    const src = path7.join(from, entry.name);
    const dest = path7.join(to, entry.name);
    if (entry.isDirectory()) {
      copied += mirrorUploads(src, dest);
    } else if (entry.isFile() && !fs7.existsSync(dest)) {
      fs7.mkdirSync(to, { recursive: true });
      fs7.copyFileSync(src, `${dest}.part`);
      fs7.renameSync(`${dest}.part`, dest);
      copied++;
    }
  }
  return copied;
}
function pruneBackups(dir, retentionDays, now = Date.now()) {
  const removed = [];
  for (const file of listBackups(dir).slice(KEEP_AT_LEAST)) {
    if (now - new Date(file.createdAt).getTime() > retentionDays * DAY_MS2) {
      fs7.rmSync(path7.join(dir, file.name), { force: true });
      removed.push(file.name);
    }
  }
  return removed;
}
function verifyCopy(file) {
  const copy = new Database2(file, { fileMustExist: true });
  try {
    copy.pragma("journal_mode = DELETE");
    const integrity = copy.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error(`Backup failed its integrity check: ${String(integrity)}`);
    return copy.prepare("SELECT COUNT(*) AS n FROM projects").get().n;
  } finally {
    copy.close();
  }
}
async function makeBackup(cfg, now) {
  fs7.mkdirSync(cfg.dir, { recursive: true });
  const name = `encalm-${stampOf(now)}.db.gz`;
  const final = path7.join(cfg.dir, name);
  const tmp = path7.join(cfg.dir, `.tmp-${stampOf(now)}.db`);
  const lock = path7.join(cfg.dir, ".backup.lock");
  try {
    if (Date.now() - fs7.statSync(lock).mtimeMs > 60 * 60 * 1e3) fs7.rmSync(lock, { force: true });
  } catch {
  }
  let fd;
  try {
    fd = fs7.openSync(lock, "wx");
  } catch {
    throw new Error("Another backup is already running");
  }
  try {
    if (fs7.existsSync(final)) throw new Error(`A backup named ${name} already exists; try again in a second`);
    await db.backup(tmp);
    const projects = verifyCopy(tmp);
    await pipeline(fs7.createReadStream(tmp), zlib.createGzip({ level: 9 }), fs7.createWriteStream(`${final}.part`));
    fs7.renameSync(`${final}.part`, final);
    const photosCopied = mirrorUploads(uploadsDir, path7.join(cfg.dir, "uploads"));
    pruneBackups(cfg.dir, cfg.retentionDays, now.getTime());
    return { ok: true, file: name, size: fs7.statSync(final).size, projects, photosCopied, at: now.toISOString() };
  } finally {
    for (const leftover of [tmp, `${tmp}-wal`, `${tmp}-shm`, `${tmp}-journal`, `${final}.part`]) {
      fs7.rmSync(leftover, { force: true });
    }
    fs7.closeSync(fd);
    fs7.rmSync(lock, { force: true });
  }
}
function runBackup(cfg = backupConfig(), now = /* @__PURE__ */ new Date()) {
  if (running) return running;
  running = makeBackup(cfg, now).then((result) => {
    logger.info(
      { file: result.ok ? result.file : void 0, projects: result.ok ? result.projects : void 0 },
      "[Backup] Database backed up"
    );
    return result;
  }).catch((err) => {
    const error = err instanceof Error && err.message || "Backup failed";
    logger.error({ err }, "[Backup] Backup failed");
    captureError(err, { area: "backup" });
    return { ok: false, error, at: now.toISOString() };
  }).then((result) => {
    last = result;
    return result;
  }).finally(() => {
    running = null;
  });
  return running;
}
function backupStatus(cfg = backupConfig()) {
  const files = listBackups(cfg.dir);
  return {
    enabled: cfg.enabled,
    time: cfg.time,
    retentionDays: cfg.retentionDays,
    lastRun: last,
    newest: files[0] ?? null,
    count: files.length,
    backups: files.slice(0, 10)
  };
}
function msUntil(time, now = /* @__PURE__ */ new Date()) {
  const [h, m] = time.split(":").map(Number);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
function backupIsDue(cfg, now = Date.now()) {
  const newest = listBackups(cfg.dir)[0];
  return !newest || now - new Date(newest.createdAt).getTime() > DAY_MS2;
}
function startBackupScheduler(cfg = backupConfig(), catchUpDelayMs = 5 * 60 * 1e3) {
  if (!cfg.enabled || timer) return;
  const schedule = (delay) => {
    timer = setTimeout(() => {
      void runBackup(cfg).finally(() => {
        if (timer) schedule(msUntil(cfg.time));
      });
    }, delay);
    timer.unref();
  };
  schedule(backupIsDue(cfg) ? catchUpDelayMs : msUntil(cfg.time));
  logger.info({ dir: cfg.dir, time: cfg.time }, "[Backup] Daily backups scheduled");
}
function stopBackupScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
}

// server/src/routes/system.ts
var router7 = Router8();
router7.get("/export", requireAuth, requireRole(["coordinator", "lead"]), (_req, res) => {
  const projects = exportPortfolioProjects();
  res.json({
    version: 1,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    projectCount: projects.length,
    projects,
    notifications: systemRepo.recentNotifications(100)
  });
});
router7.post(
  "/import",
  requireAuth,
  requireRole(["coordinator"]),
  largeJson,
  validate({ body: importBody }),
  audited({
    action: "import",
    entityType: "portfolio",
    details: (req) => ({ projects: req.body.projects.map((p) => p.id) })
  }),
  (req, res) => {
    const result = restoreDatabaseFromJSON(req.body);
    res.json({
      message: `Database restored successfully. Restored ${result.count} projects.`,
      count: result.count
    });
  }
);
function resetAllowed(_req, res, next) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SYSTEM_RESET !== "true") {
    res.status(403).json({
      error: "Destructive system resets are disabled in production mode. Set ALLOW_SYSTEM_RESET=true in server environment to override."
    });
    return;
  }
  next();
}
function wipeRoute(path10, action, message) {
  router7.post(
    path10,
    requireAuth,
    requireRole(["coordinator"]),
    resetAllowed,
    audited({ action, entityType: "portfolio" }),
    (_req, res) => {
      clearAllProjectData();
      saveDatabaseSnapshot();
      res.json({ message });
    }
  );
}
wipeRoute("/reset", "reset", "Database wiped clean. Ready for fresh project data entry.");
wipeRoute("/clear", "clear", "All project data cleared successfully.");
var parseJson2 = (v) => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
router7.get("/audit", requireAuth, requireRole(["coordinator"]), validate({ query: auditQuery }), (req, res) => {
  const q = req.query;
  const filter = { userId: q.userId, entityType: q.entityType, entityId: q.entityId, action: q.action };
  const { limit, offset } = pageFrom(q, 50);
  res.json({
    total: auditRepo.count(filter),
    limit,
    offset,
    entries: auditRepo.list(filter, limit, offset).map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name ?? null,
      userEmail: r.user_email ?? null,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      before: parseJson2(r.before_json),
      after: parseJson2(r.after_json),
      ip: r.ip,
      createdAt: r.created_at
    }))
  });
});
router7.get("/backups", requireAuth, requireRole(["coordinator"]), (_req, res) => {
  res.json(backupStatus());
});
var lastManualBackup = 0;
router7.post(
  "/backups",
  requireAuth,
  requireRole(["coordinator"]),
  (_req, res, next) => {
    if (Date.now() - lastManualBackup < 6e4) {
      res.status(429).json({ error: "A backup was just made. Try again in a minute." });
      return;
    }
    lastManualBackup = Date.now();
    next();
  },
  audited({ action: "backup", entityType: "database" }),
  async (_req, res) => {
    const result = await runBackup();
    res.locals.auditAfter = result;
    res.status(result.ok ? 200 : 500).json({ result, ...result.ok ? {} : { error: result.error }, ...backupStatus() });
  }
);
router7.get("/ready", (_req, res) => {
  let ready = false;
  try {
    ready = systemRepo.ping();
  } catch {
    ready = false;
  }
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});
router7.get("/health", requireAuth, requireRole(["coordinator"]), (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "healthy",
    database: "connected (SQLite WAL)",
    counts: systemRepo.rowCounts(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
    },
    environment: process.env.NODE_ENV || "development",
    pid: process.pid,
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var system_default = router7;

// server/src/routes/email.ts
import { Router as Router9 } from "express";

// server/src/services/email-dispatch.service.ts
import { randomUUID as randomUUID4 } from "node:crypto";
function sendProjectUpdate(projectId5, recipients, customNote, { user, origin }) {
  const project = getProject(projectId5);
  if (!project) throw notFound("Project");
  const targets = recipients.map(
    (r) => typeof r === "string" ? { email: r.trim(), name: r.split("@")[0] } : { email: r.email.trim(), name: r.name || r.email }
  );
  if (targets.length === 0) throw badRequest("No valid recipient email addresses provided.");
  const dashboardUrl = `${origin}/project/${projectId5}`;
  return db.transaction(
    () => targets.map((rc) => ({
      recipient: rc.email,
      ...queueEmail({
        to: rc.email,
        recipientName: rc.name,
        sender: { email: user.email, name: user.name },
        replyTo: user.email,
        subject: `Project Update: ${project.name} (${project.progress}% Complete)`,
        html: buildProjectSummaryHtml({
          recipientName: rc.name,
          projectName: project.name,
          senderName: user.name,
          progress: project.progress,
          health: project.health,
          status: project.status,
          customNote,
          dashboardUrl
        }),
        templateType: "project_summary",
        projectId: projectId5
      })
    }))
  )();
}
async function findPerson(userId) {
  const local = usersRepo.find(userId);
  if (local) return { id: local.id, name: local.name, email: local.email };
  if (!userId.startsWith("azure-")) return void 0;
  const match = (await searchEncalmDirectory()).find((u) => u.id === userId);
  return match && { id: match.id, name: match.name, email: match.email };
}
async function tagAndComment(request, { user, origin }) {
  const { projectId: projectId5, entityType = "Stage", entityTitle, entityContext, comment } = request;
  const userIds = new Set((request.taggedUserIds ?? []).filter(Boolean));
  const project = getProject(projectId5);
  if (!project) throw notFound("Project");
  if (userIds.size === 0) throw badRequest("At least one user must be tagged or @mentioned");
  const currentStage = project.phases.find((p) => p.status === "In Progress")?.name || project.status || "Active Delivery";
  const targetDate = project.targetDate || entityContext;
  const dashboardUrl = `${origin}/project/${projectId5}`;
  const itemTitle = entityTitle || "item";
  const notifTitle = `Tagged on ${entityType}: ${entityTitle || "Project Item"}`;
  const notifMessage = comment ? `${user.name} tagged you on ${entityType.toLowerCase()} "${itemTitle}" in ${project.name}: "${comment}"` : `${user.name} tagged you on ${entityType.toLowerCase()} "${itemTitle}" in ${project.name}`;
  const people = [];
  const unknown = [];
  const seenEmails = /* @__PURE__ */ new Set();
  for (const userId of userIds) {
    const person = await findPerson(userId);
    if (!person) {
      unknown.push(userId);
      continue;
    }
    const key = person.email?.trim().toLowerCase();
    if (key && seenEmails.has(key)) continue;
    if (key) seenEmails.add(key);
    people.push({ userId: person.id, person });
  }
  if (unknown.length) throw badRequest(`Unknown people tagged: ${unknown.join(", ")}`);
  return db.transaction(() => {
    const results = people.map(({ userId, person }) => {
      const recipientName = person.name || userId;
      notificationsRepo.insert({
        id: `notif-tag-${randomUUID4()}`,
        type: "tagged_task",
        title: notifTitle,
        message: notifMessage,
        project_id: projectId5,
        link: `/project/${projectId5}`,
        recipient_id: userId
      });
      if (!person.email) {
        return {
          userId,
          userName: recipientName,
          email: "no-email-found",
          status: "skipped",
          error: "User has no registered email"
        };
      }
      const queued = queueEmail({
        to: person.email,
        recipientName,
        sender: { email: user.email, name: user.name },
        replyTo: user.email,
        subject: `[Encalm - ${project.code || "ACTION"}] Action Required: ${entityTitle || project.name}`,
        html: buildTagNotificationHtml({
          recipientName,
          taggedByName: user.name,
          senderEmail: user.email,
          entityType,
          entityTitle: entityTitle || `${entityType} in ${project.name}`,
          entityContext,
          comment,
          projectName: project.name,
          projectCode: project.code,
          projectLocation: project.location,
          currentStage,
          targetDate,
          dashboardUrl
        }),
        templateType: "tag_notification",
        projectId: projectId5
      });
      return { userId, userName: recipientName, email: person.email, ...queued };
    });
    if (comment?.trim()) {
      updatesRepo.insert({
        id: `upd-${randomUUID4()}`,
        project_id: projectId5,
        date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        author: user.name,
        role: user.title || "Team Member",
        stage: entityTitle || entityType,
        kind: "Progress",
        text: `[Tagged ${results.map((r) => r.userName).join(", ")}]: ${comment.trim()}`
      });
    }
    return results;
  })();
}

// server/src/routes/email.ts
var router8 = Router9();
function redactEmailSettings(req) {
  const { smtp } = req.body ?? {};
  return { smtp: smtp ? { ...smtp, pass: smtp.pass ? "[redacted]" : void 0 } : void 0 };
}
var sender = (req) => ({ user: req.user, origin: publicBaseUrl(req) });
var providerLabel = (provider) => provider === "microsoft_graph" ? "Microsoft 365" : provider === "smtp" ? "SMTP" : "Outbox";
router8.get(
  "/directory",
  requireAuth,
  requireRole(["coordinator", "hod", "lead"]),
  validate({ query: directoryQuery }),
  async (req, res) => {
    const query = (req.query.q || "").trim();
    res.json({ users: await searchEncalmDirectory(query) });
  }
);
router8.get("/logs", requireAuth, requireRole(["coordinator"]), validate({ query: emailLogsQuery }), (req, res) => {
  const projectId5 = req.query.projectId;
  const page = pageFrom(req.query, 50, 100);
  res.json({
    total: emailRepo.countLogs(projectId5),
    ...page,
    logs: emailRepo.listLogs(projectId5, page).map((l) => ({
      id: l.id,
      recipientEmail: l.recipient_email,
      recipientName: l.recipient_name,
      subject: l.subject,
      templateType: l.template_type,
      projectId: l.project_id,
      status: l.status,
      htmlContent: l.html_content,
      error: l.error,
      createdAt: l.created_at
    }))
  });
});
router8.get("/settings", requireAuth, requireRole(["coordinator"]), (_req, res) => {
  res.json({ settings: describeEmailSettings() });
});
router8.post(
  "/settings",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ body: emailSettingsBody }),
  audited({ action: "update", entityType: "email_settings", details: redactEmailSettings }),
  (req, res) => {
    applyEmailSettings(req.body);
    res.json({ message: "Email settings saved successfully", settings: describeEmailSettings() });
  }
);
router8.post(
  "/test",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ body: emailTestBody }),
  audited({ action: "send_test", entityType: "email" }),
  async (req, res) => {
    const me = req.user;
    const provider = getActiveEmailProvider();
    const result = await sendEmailNow({
      to: me.email,
      recipientName: me.name,
      sender: { email: me.email, name: me.name },
      subject: `Encalm Projects - ${providerLabel(provider)} Delivery Test`,
      html: buildTestEmailHtml(me.name),
      templateType: "test_email"
    });
    res.json({
      success: result.status === "sent",
      result,
      message: result.status === "sent" ? `Test email sent via ${providerLabel(provider)} to ${me.email}` : result.status === "outbox" ? "No email provider configured: the test email is waiting in the Outbox" : `Failed to deliver email: ${result.error}`
    });
  }
);
router8.post(
  "/resend/:id",
  requireAuth,
  requireRole(["coordinator"]),
  validate({ params: idParams }),
  audited({ action: "resend", entityType: "email", id: (req) => req.params.id }),
  (req, res) => {
    res.json(resendEmailLog(req.params.id));
  }
);
router8.post(
  "/send-project-update",
  requireAuth,
  requireTagAccess(),
  validate({ body: sendProjectUpdateBody }),
  audited({
    action: "send_project_update",
    entityType: "email",
    id: (req) => req.body.projectId,
    details: (req) => ({ recipients: req.body.recipients })
  }),
  (req, res) => {
    const { projectId: projectId5, recipients, customNote } = req.body;
    const results = sendProjectUpdate(projectId5, recipients, customNote, sender(req));
    res.json({
      success: true,
      message: `Queued project summary for ${results.length} recipient(s)`,
      results
    });
  }
);
router8.post(
  "/tag-and-comment",
  requireAuth,
  requireTagAccess(),
  validate({ body: tagAndCommentBody }),
  audited({ action: "tag", entityType: "email", id: (req) => req.body.projectId, details: (req) => req.body }),
  async (req, res) => {
    const recipients = await tagAndComment(req.body, sender(req));
    res.json({
      success: true,
      message: `Queued notification email for ${recipients.filter((r) => r.status !== "skipped").length} recipient(s)`,
      delivery: getActiveEmailProvider(),
      recipients
    });
  }
);
var email_default = router8;

// server/src/routes/photos.ts
import { Router as Router10 } from "express";
import multer from "multer";
var projectPhotosRouter = Router10({ mergeParams: true });
var globalPhotosRouter = Router10();
var MAX_PHOTO_BYTES = 10 * 1024 * 1024;
var MAX_PHOTOS_PER_UPLOAD = 20;
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS_PER_UPLOAD, fields: 10, fieldSize: 256 * 1024 }
});
function receivePhotos(req, res, next) {
  upload.array("photos", MAX_PHOTOS_PER_UPLOAD)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE" ? `Each photograph must be ${MAX_PHOTO_BYTES / 1024 / 1024} MB or smaller.` : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? `Upload at most ${MAX_PHOTOS_PER_UPLOAD} photographs at a time, in the "photos" field.` : err.message;
      return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: message });
    }
    next(err);
  });
}
async function handlePhotoUpload(req, res) {
  const projectId5 = req.params.id;
  const files = req.files ?? [];
  const photos = await uploadPhotos(projectId5, files, req.body?.meta, req.user);
  res.locals.auditEntityId = photos.map((p) => p.id).join(",");
  res.locals.auditAfter = photos;
  saveDatabaseSnapshot();
  res.status(201).json({
    message: `Successfully uploaded ${photos.length} site photograph${photos.length > 1 ? "s" : ""}`,
    photos,
    photo: photos[0],
    project: getProject(projectId5)
  });
}
var photoUploadAudit = audited({ action: "create", entityType: "photo" });
for (const path10 of ["/", "/batch"]) {
  projectPhotosRouter.post(
    path10,
    requireAuth,
    requireProjectAccess(),
    validate({ params: projectParams }),
    photoUploadAudit,
    receivePhotos,
    handlePhotoUpload
  );
}
projectPhotosRouter.delete(
  "/:photoId",
  requireAuth,
  requireProjectAccess(),
  validate({ params: photoParams }),
  audited({ action: "delete", entityType: "photo", table: "photos", id: (req) => req.params.photoId }),
  transactional((req, res) => {
    const projectId5 = req.params.id;
    const photo = deletePhoto(projectId5, req.params.photoId);
    afterCommit(() => {
      removePhotoFiles(photo);
      saveDatabaseSnapshot();
    });
    res.json({ message: "Photograph deleted successfully", project: getProject(projectId5) });
  })
);
projectPhotosRouter.get("/", requireAuth, validate({ params: projectParams, query: pageQuery }), (req, res) => {
  const id2 = req.params.id;
  const page = pageFrom(req.query, 100);
  res.json({ photos: photosRepo.listForProject(id2, page), total: photosRepo.countForProject(id2), ...page });
});
globalPhotosRouter.get("/", requireAuth, validate({ query: pageQuery }), (req, res) => {
  const page = pageFrom(req.query, 100);
  res.json({ photos: photosRepo.listPortfolio(page), total: photosRepo.countAll(), ...page });
});

// server/src/app.ts
var isProduction2 = process.env.NODE_ENV === "production";
function createApp() {
  const app2 = express2();
  app2.set("trust proxy", 1);
  app2.use(
    pinoHttp({
      logger,
      genReqId: requestId,
      // Health probes run every minute; logging each one is noise.
      autoLogging: { ignore: (req) => req.url === "/api/system/ready" },
      customLogLevel: (_req, res, err) => err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      // Method and path only: query strings can carry search terms and ids we don't need in logs.
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          path: req.url.split("?")[0]
        }),
        res: (res) => ({ statusCode: res.statusCode })
      }
    })
  );
  const sentryOrigin = dsnOrigin(clientDsn());
  app2.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", ...sentryOrigin ? [sentryOrigin] : []],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"]
        }
      },
      strictTransportSecurity: { maxAge: 31536e3, includeSubDomains: true },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-origin" }
    })
  );
  app2.use(compression());
  const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
  const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  app2.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, false);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (!isProduction2 && isLocalhost(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true
    })
  );
  app2.use("/api", (req, _res, next) => {
    const override = (req.get("X-Encalm-Method") || req.get("X-HTTP-Method-Override"))?.toUpperCase();
    if (req.method === "POST" && override && ["PATCH", "PUT", "DELETE"].includes(override)) req.method = override;
    next();
  });
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: envInt("API_RATE_LIMIT", 600),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: envInt("LOGIN_RATE_LIMIT", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts from this network. Please try again in 15 minutes." }
  });
  const emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: envInt("EMAIL_RATE_LIMIT", 100),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Email dispatch rate limit reached. Please try again shortly." }
  });
  app2.use("/api", apiLimiter);
  app2.use("/api/auth/login", authLimiter);
  app2.use("/api/email/test", emailLimiter);
  app2.use("/api/email/send-project-update", emailLimiter);
  app2.use("/api/email/tag-and-comment", emailLimiter);
  const jsonParser = express2.json({ limit: "1mb" });
  app2.use((req, res, next) => LARGE_JSON_PATHS.has(req.path) ? next() : jsonParser(req, res, next));
  app2.use(express2.urlencoded({ extended: true, limit: "1mb" }));
  app2.use(cookieParser());
  app2.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const hasSession = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
    const isSessionStart = req.path === "/auth/login" || req.path === "/auth/refresh";
    if ((hasSession || isSessionStart) && req.get("X-Requested-With") !== "XMLHttpRequest") {
      return res.status(403).json({ error: "Forbidden: missing CSRF header" });
    }
    next();
  });
  app2.use(
    "/uploads",
    requireAuth,
    express2.static(uploadsDir, {
      dotfiles: "deny",
      index: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
    })
  );
  app2.get("/api/client-config", (_req, res) => {
    res.json({ sentryDsn: clientDsn() || null, environment: sentryEnvironment(), release: appRelease() ?? null });
  });
  app2.use("/api", (req, res, next) => {
    const revalidate = req.method === "GET" && !req.path.startsWith("/auth/");
    res.setHeader("Cache-Control", revalidate ? "private, no-cache" : "no-store");
    next();
  });
  app2.use("/api/auth", auth_default);
  app2.use("/api/projects", projects_default);
  app2.use("/api/projects/:id/phases", phases_default);
  app2.use("/api/projects/:id/milestones", milestones_default);
  app2.use("/api/projects/:id/issues", issues_default);
  app2.use("/api/projects/:id/updates", projectUpdatesRouter);
  app2.use("/api/projects/:id/photos", projectPhotosRouter);
  app2.use("/api/updates", globalUpdatesRouter);
  app2.use("/api/photos", globalPhotosRouter);
  app2.use("/api/notifications", notifications_default);
  app2.use("/api/email", email_default);
  app2.use("/api/system", system_default);
  app2.all("/api/{*splat}", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });
  app2.all("/uploads/{*splat}", (req, res) => {
    res.status(404).json({ error: `Upload asset not found: ${req.originalUrl}` });
  });
  const distPath = clientDistDir;
  if (isInside(path8.resolve(dataDir), path8.resolve(distPath))) {
    throw new Error(`DATA_DIR (${dataDir}) is inside the public web folder ${distPath}; move it outside`);
  }
  if (fs8.existsSync(distPath)) {
    const assetsPath = path8.join(distPath, "assets");
    if (fs8.existsSync(assetsPath)) {
      app2.use("/assets", express2.static(assetsPath, { maxAge: "1y", immutable: true }));
    }
    app2.use(
      express2.static(distPath, {
        maxAge: "1h",
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
        }
      })
    );
    app2.get("/{*splat}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path8.join(distPath, "index.html"));
    });
  } else {
    app2.get("/", (_req, res) => {
      res.redirect("http://localhost:5173");
    });
  }
  app2.use((err, req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    const status = err?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      return res.status(status).json({ error: err.message });
    }
    req.log.error({ err }, "Unhandled error");
    captureError(err, { requestId: req.id, method: req.method, path: req.path });
    res.status(500).json({
      error: "Internal Server Error",
      message: isProduction2 ? "An unexpected error occurred." : err?.message
    });
  });
  return app2;
}
function isInside(child, parent, platform = process.platform) {
  const pathApi = platform === "win32" ? path8.win32 : path8.posix;
  const fold = (p) => platform === "win32" ? p.toLowerCase() : p;
  const rel = pathApi.relative(fold(parent), fold(child));
  return rel === "" || !rel.startsWith("..") && !pathApi.isAbsolute(rel);
}

// server/src/listen.ts
function listenTarget(env2 = process.env) {
  const rawPort = env2.PORT?.trim();
  if (rawPort && !/^\d+$/.test(rawPort)) return { pipe: rawPort };
  const isProduction3 = env2.NODE_ENV === "production";
  const port = Number(
    env2.API_PORT || env2.BACKEND_PORT || (isProduction3 && rawPort && rawPort !== "5173" ? rawPort : 5e3)
  );
  return { port, host: env2.HOST || "0.0.0.0" };
}

// server/src/utils/app-lock.ts
import fs9 from "node:fs";
import path9 from "node:path";
var lockPath = (dataDir2) => path9.join(dataDir2, ".app.lock");
function writeAppLock(dataDir2) {
  fs9.writeFileSync(lockPath(dataDir2), String(process.pid));
}
function releaseAppLock(dataDir2) {
  try {
    if (fs9.readFileSync(lockPath(dataDir2), "utf8").trim() === String(process.pid)) fs9.rmSync(lockPath(dataDir2));
  } catch {
  }
}

// server/src/index.ts
assertProductionConfig();
var target = listenTarget();
var app = createApp();
var server = null;
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
    writeAppLock(dataDir);
    startBackupScheduler();
    const onListening = () => logger.info({ ...target, release: appRelease() }, "Encalm Project Dashboard listening");
    server = "pipe" in target ? app.listen(target.pipe, onListening) : app.listen(target.port, target.host, onListening);
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    captureError(err);
    await flushSentry();
    process.exit(1);
  }
}
var shuttingDown = false;
function gracefulShutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  stopEmailWorker();
  stopBackupScheduler();
  const exit = (code) => void flushSentry().finally(() => process.exit(code));
  if (server) {
    server.close(() => {
      try {
        db.pragma("wal_checkpoint(TRUNCATE)");
        saveDatabaseSnapshot();
        db.close();
        releaseAppLock(dataDir);
        logger.info("Database closed; shutdown complete");
      } catch (err) {
        logger.error({ err }, "Error closing the database during shutdown");
      }
      exit(exitCode);
    });
    setTimeout(() => {
      logger.error("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, 1e4).unref();
  } else {
    exit(exitCode);
  }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  captureError(reason);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  captureError(err);
  gracefulShutdown("uncaughtException", 1);
});
void startServer();
//# sourceMappingURL=index.js.map
