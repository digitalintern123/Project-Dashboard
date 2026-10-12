import bcrypt from 'bcryptjs';
import request from 'supertest';
import { db, initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';

export const TEST_PASSWORD = 'Test-password-123';

export const testUsers = {
  coordinator: { id: 'u-coord', name: 'Cora Ordinator', email: 'coord@test.local', role: 'coordinator' },
  leadA: { id: 'u-lead-a', name: 'Lee Alpha', email: 'lead.a@test.local', role: 'lead' },
  leadB: { id: 'u-lead-b', name: 'Lee Beta', email: 'lead.b@test.local', role: 'lead' },
  hod: { id: 'u-hod', name: 'Hal Od', email: 'hod@test.local', role: 'hod' },
} as const;

export type TestUserKey = keyof typeof testUsers;

let prepared = false;

export function setupTestDb() {
  if (prepared) return;
  prepared = true;
  initDatabase();
  const hash = bcrypt.hashSync(TEST_PASSWORD, 4);
  const insert = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, password_hash, role, title, initials)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const u of Object.values(testUsers)) {
    insert.run(u.id, u.name, u.email, hash, u.role, u.role, u.name.slice(0, 2).toUpperCase());
  }
}

export function makeApp() {
  setupTestDb();
  return createApp();
}

export function insertProject(id: string, leadId: string | null) {
  db.prepare(
    `
    INSERT OR REPLACE INTO projects (
      id, name, location, category, code, health, status, progress,
      target_date, target_label, next_milestone, next_milestone_date, lead_id
    ) VALUES (?, ?, 'Delhi', 'Lounge', ?, 'On track', 'In Design', 10, '2027-01-01', 'Jan 2027', 'Brief', '2026-12-01', ?)
  `,
  ).run(id, `Project ${id}`, id.toUpperCase(), leadId ?? '');
  db.prepare(
    `
    INSERT OR REPLACE INTO phases (id, project_id, name, status, progress, owner, order_index)
    VALUES (?, ?, 'Brief & scope', 'active', 0, 'PMO', 0)
  `,
  ).run(`${id}-phase-0`, id);
}

/** Returns a supertest agent with a cookie session for the given test user. */
export async function loginAs(app: ReturnType<typeof createApp>, key: TestUserKey) {
  const agent = request.agent(app);
  agent.set('X-Requested-With', 'XMLHttpRequest');
  const res = await agent.post('/api/auth/login').send({ email: testUsers[key].email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Login as ${key} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

/** Bare request helper that sends the CSRF header, for unauthenticated calls. */
export function anon(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  agent.set('X-Requested-With', 'XMLHttpRequest');
  return agent;
}
