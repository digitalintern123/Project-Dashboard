// server/src/env.ts
import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env", quiet: true });

// server/src/scripts/restore-backup.ts
import path4 from "node:path";

// server/src/utils/restore-backup.ts
import fs2 from "node:fs";
import path2 from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import Database from "better-sqlite3";

// server/src/utils/app-lock.ts
import fs from "node:fs";
import path from "node:path";
var lockPath = (dataDir2) => path.join(dataDir2, ".app.lock");
function isAppRunning(dataDir2) {
  let pid;
  try {
    pid = Number(fs.readFileSync(lockPath(dataDir2), "utf8").trim());
  } catch {
    return false;
  }
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

// server/src/utils/restore-backup.ts
async function restoreBackup(backupFile, { dataDir: dataDir2, dbPath: dbPath2, now = /* @__PURE__ */ new Date() }) {
  if (!fs2.existsSync(backupFile)) throw new Error(`Backup not found: ${backupFile}`);
  if (isAppRunning(dataDir2)) {
    throw new Error("The app is running. Stop it first (Plesk: Disable Node.js), then run the restore again.");
  }
  const tmp = `${dbPath2}.restore-tmp`;
  fs2.rmSync(tmp, { force: true });
  try {
    if (backupFile.endsWith(".gz")) {
      await pipeline(fs2.createReadStream(backupFile), zlib.createGunzip(), fs2.createWriteStream(tmp));
    } else {
      fs2.copyFileSync(backupFile, tmp);
    }
    const copy = new Database(tmp, { readonly: true, fileMustExist: true });
    let projects;
    try {
      const integrity = copy.pragma("integrity_check", { simple: true });
      if (integrity !== "ok") throw new Error(`The backup failed its integrity check: ${String(integrity)}`);
      projects = copy.prepare("SELECT COUNT(*) AS n FROM projects").get().n;
    } finally {
      copy.close();
    }
    const suffix = `.before-restore-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
    const movedAside = [];
    for (const file2 of [dbPath2, `${dbPath2}-wal`, `${dbPath2}-shm`]) {
      if (fs2.existsSync(file2)) {
        fs2.renameSync(file2, `${file2}${suffix}`);
        movedAside.push(path2.basename(`${file2}${suffix}`));
      }
    }
    fs2.renameSync(tmp, dbPath2);
    return { restoredFrom: path2.basename(backupFile), movedAside, projects };
  } finally {
    for (const leftover of [tmp, `${tmp}-wal`, `${tmp}-shm`]) fs2.rmSync(leftover, { force: true });
  }
}

// server/src/paths.ts
import fs3 from "node:fs";
import path3 from "node:path";
import { fileURLToPath } from "node:url";
function findProjectRoot(start) {
  let dir = start;
  for (; ; ) {
    if (fs3.existsSync(path3.join(dir, "package.json"))) return dir;
    const parent = path3.dirname(dir);
    if (parent === dir) throw new Error(`Could not find the project root above ${start}`);
    dir = parent;
  }
}
var here = path3.dirname(fileURLToPath(import.meta.url));
var projectRoot = findProjectRoot(here);
var defaultDataDir = path3.join(projectRoot, "server", "data");
var clientDistDir = path3.join(projectRoot, "dist");
var migrationsDir = fs3.existsSync(path3.join(here, "migrations")) ? path3.join(here, "migrations") : path3.join(projectRoot, "server", "src", "db", "migrations");

// server/src/scripts/restore-backup.ts
var file = process.argv[2];
if (!file) {
  console.error("Usage: node server/dist/restore-backup.js <backup file (.db.gz)>");
  process.exit(2);
}
var dataDir = process.env.DATA_DIR || defaultDataDir;
var dbPath = process.env.DATABASE_PATH || path4.join(dataDir, "encalm.db");
try {
  const result = await restoreBackup(path4.resolve(file), { dataDir, dbPath });
  console.log(`Restored ${result.restoredFrom} (${result.projects} projects) into ${dbPath}.`);
  if (result.movedAside.length) console.log(`The previous database was kept as: ${result.movedAside.join(", ")}`);
  console.log("Start the app again (Plesk: Enable Node.js, then Restart App).");
} catch (err) {
  console.error(`Restore failed: ${err.message}`);
  process.exitCode = 1;
}
//# sourceMappingURL=restore-backup.js.map
