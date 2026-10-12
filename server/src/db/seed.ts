import { db, initDatabase } from './database.js';
import { users as seedUsers } from '../../../src/data/users.js';
import { generateTemporaryPassword, hashPassword, verifyPassword } from '../utils/passwords.js';
import { logger } from '../logger.js';

// The shared password every account used to be seeded with. Detection only:
// accounts that still have it are forced to change it at next sign-in.
const LEGACY_DEFAULT_PASSWORD = 'encalm';

/**
 * Ensures the default user accounts exist so authentication and RBAC work.
 *
 * A newly created account gets a random temporary password, printed once to the
 * console, and must change it at first sign-in. Existing accounts never have
 * their password overwritten; any still using the old shared default password
 * are flagged so they must change it at next sign-in.
 */
export function ensureUsersSeeded() {
  initDatabase();

  const findUser = db.prepare('SELECT id FROM users WHERE id = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, title, initials, must_change_password)
    VALUES (@id, @name, @email, @password_hash, @role, @title, @initials, 1)
  `);
  const updateProfile = db.prepare('UPDATE users SET email = ?, name = ?, title = ?, initials = ? WHERE id = ?');
  const flagMustChange = db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?');

  const created: { email: string; password: string }[] = [];

  const tx = db.transaction(() => {
    for (const u of seedUsers) {
      const email = u.email || `${u.id.replace('user-', '')}@encalm.com`;
      const existing = findUser.get(u.id);
      if (existing) {
        updateProfile.run(email, u.name, u.title, u.initials, u.id);
        continue;
      }
      const password = generateTemporaryPassword();
      insertUser.run({
        id: u.id,
        name: u.name,
        email,
        password_hash: hashPassword(password),
        role: u.role,
        title: u.title,
        initials: u.initials,
      });
      created.push({ email, password });
    }
  });

  tx();

  // One-off: any account (seeded, CLI- or UI-created) still on the legacy shared
  // password must change it at next sign-in. The password itself is left untouched.
  const checkDone = db.prepare("SELECT 1 FROM system_settings WHERE key = 'legacy_password_check_done'").get();
  if (!checkDone) {
    const candidates = db
      .prepare(
        "SELECT id, password_hash FROM users WHERE must_change_password = 0 AND COALESCE(password_hash, '') != ''",
      )
      .all() as { id: string; password_hash: string }[];
    let flagged = 0;
    for (const c of candidates) {
      if (verifyPassword(LEGACY_DEFAULT_PASSWORD, c.password_hash)) {
        flagMustChange.run(c.id);
        flagged++;
      }
    }
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('legacy_password_check_done', '1')").run();
    if (flagged > 0)
      logger.info(`✓ ${flagged} account(s) still on the old default password must change it at next sign-in.`);
  }

  if (created.length > 0) {
    // Printed straight to the console, not the structured log: shown once to the operator.
    console.log('================================================================');
    console.log(' New user accounts created. Temporary passwords (shown ONCE):');
    for (const c of created) console.log(`   ${c.email}  ${c.password}`);
    console.log(' Each user must change their password at first sign-in.');
    console.log('================================================================');
  }
  logger.info('✓ User accounts synchronized for authentication.');
}

/** Clears all project records, stages, milestones, issues, updates, and notifications for a clean slate. */
export function clearAllProjectData() {
  initDatabase();
  ensureUsersSeeded();

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM updates').run();
    db.prepare('DELETE FROM issues').run();
    db.prepare('DELETE FROM milestones').run();
    db.prepare('DELETE FROM phases').run();
    db.prepare('DELETE FROM projects').run();
  });

  tx();
  logger.info('✓ All project data removed. Database is now empty and ready for fresh input.');
}

/** Default entry point: ensures authentic users exist, does not force demo data. */
export function seedDatabase(force = false) {
  ensureUsersSeeded();
  if (force) {
    clearAllProjectData();
  }
}
