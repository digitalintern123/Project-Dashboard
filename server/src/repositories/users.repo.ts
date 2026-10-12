import { db } from '../db/database.js';
import type { UserRow } from './rows.js';
import { updateColumns } from './sql.js';

export type PublicUserRow = Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'title' | 'initials'>;

const PUBLIC_COLUMNS = 'id, name, email, role, title, initials';

export const usersRepo = {
  find(id: string): UserRow | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  },
  /** A user who can sign in (not a directory-only stakeholder), by email. */
  findLoginByEmail(email: string): UserRow | undefined {
    return db
      .prepare("SELECT * FROM users WHERE LOWER(email) = ? AND role IN ('hod', 'lead', 'coordinator')")
      .get(email.toLowerCase()) as UserRow | undefined;
  },
  findLoginById(id: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('hod', 'lead', 'coordinator')").get(id) as
      UserRow | undefined;
  },
  emailTaken(email: string): boolean {
    return Boolean(db.prepare('SELECT 1 FROM users WHERE LOWER(email) = ?').get(email.toLowerCase()));
  },
  findLead(id: string): PublicUserRow | undefined {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND role = 'lead'`).get(id) as
      PublicUserRow | undefined;
  },
  listPublic(): PublicUserRow[] {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY name`).all() as PublicUserRow[];
  },
  listLeads(): PublicUserRow[] {
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE role = 'lead' ORDER BY name`).all() as PublicUserRow[];
  },
  insert(
    row: Pick<
      UserRow,
      'id' | 'name' | 'email' | 'role' | 'title' | 'initials' | 'password_hash' | 'must_change_password'
    >,
  ): void {
    db.prepare(
      `INSERT INTO users (id, name, email, role, title, initials, password_hash, must_change_password)
       VALUES (@id, @name, @email, @role, @title, @initials, @password_hash, @must_change_password)`,
    ).run(row);
  },
  update(id: string, columns: Partial<Record<keyof UserRow, string | number | null | undefined>>): void {
    updateColumns('users', { id }, columns);
  },
};
