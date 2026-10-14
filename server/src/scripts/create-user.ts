import '../env.js';
import { db, initDatabase } from '../db/database.js';
import { checkPasswordPolicy, hashPassword } from '../utils/passwords.js';

// CLI script to create or update users with role and password
// Usage:
//   npm run create-user -- "Name" "email@encalm.com" "password" "role" "title"
// Example:
//   npm run create-user -- "Amit Sharma" "amit@encalm.com" "Temp-pass-2026" "lead" "Senior Project Lead"

const args = process.argv.slice(2);

if (args.length < 3) {
  console.log(`
=====================================================
  Encalm Project Dashboard — User & Password Tool
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

const name = args[0].trim();
const email = args[1].trim().toLowerCase();
const password = args[2].trim();
const roleInput = (args[3] || 'lead').trim().toLowerCase();
const ROLES = ['coordinator', 'lead', 'hod', 'viewer'] as const;
// Never guess a role: a typo must not quietly create an account that can edit.
if (!(ROLES as readonly string[]).includes(roleInput)) {
  console.error(`❌ Unknown role "${roleInput}". Use one of: ${ROLES.join(', ')}.`);
  process.exit(1);
}
const role = roleInput as (typeof ROLES)[number];

const defaultTitles: Record<string, string> = {
  hod: 'Project HOD',
  coordinator: 'Project Coordinator',
  lead: 'Project Lead',
  viewer: 'Viewer',
};
const title = (args[4] && args[4].trim()) || defaultTitles[role] || 'Project Lead';

// Calculate initials
const parts = name.split(/\s+/).filter(Boolean);
let initials = 'PL';
if (parts.length >= 2) {
  initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
} else if (parts.length === 1 && parts[0].length >= 2) {
  initials = parts[0].substring(0, 2).toUpperCase();
}

const id = `user-${role}-${Date.now()}`;
const policyError = checkPasswordPolicy(password);
if (policyError) {
  console.error(`❌ ${policyError}`);
  process.exit(1);
}
const passwordHash = hashPassword(password);

initDatabase();

try {
  // Check if user exists
  const existing = db.prepare('SELECT id, email, role FROM users WHERE LOWER(email) = ?').get(email) as
    { id: string; email: string; role: string } | undefined;

  if (existing) {
    db.prepare(
      `
      UPDATE users
      SET name = ?, role = ?, title = ?, initials = ?, password_hash = ?, must_change_password = 1
      WHERE LOWER(email) = ?
    `,
    ).run(name, role, title, initials, passwordHash, email);

    console.log(`\n✅ User "${email}" updated successfully!`);
    console.log(`   Name:     ${name}`);
    console.log(`   Role:     ${role}`);
    console.log(`   Title:    ${title}`);
    console.log(`   Password: (updated)\n`);
  } else {
    db.prepare(
      `
      INSERT INTO users (id, name, email, role, title, initials, password_hash, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `,
    ).run(id, name, email, role, title, initials, passwordHash);

    console.log(`\n✅ User "${email}" created successfully!`);
    console.log(`   ID:       ${id}`);
    console.log(`   Name:     ${name}`);
    console.log(`   Role:     ${role}`);
    console.log(`   Title:    ${title}`);
    console.log(`   Initials: ${initials}\n`);
  }
} catch (err) {
  console.error('❌ Failed to create/update user:', err instanceof Error ? err.message : err);
  process.exit(1);
}
