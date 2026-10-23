import { beforeAll, describe, expect, it } from 'vitest';
import { makeApp, loginAs, insertProject, testUsers } from './helpers.js';
import { db } from '../src/db/database.js';

// HODs, Coordinators and the project's lead are told when a stage moves or an
// update is posted; the person who made the change is not.
const app = makeApp();
const P = '/api/projects/proj-sn';
const STAGE = 'proj-sn-phase-0';
let lead: any;
let coord: any;

beforeAll(async () => {
  insertProject('proj-sn', 'u-lead-a');
  lead = await loginAs(app, 'leadA');
  coord = await loginAs(app, 'coordinator');
});

const latest = (type?: string) =>
  db
    .prepare(
      `SELECT recipient_id, type, title, message FROM notifications
       WHERE project_id = 'proj-sn' ${type ? 'AND type = ?' : ''} ORDER BY created_at DESC, id DESC`,
    )
    .all(...(type ? [type] : [])) as { recipient_id: string; type: string; title: string; message: string }[];
const clear = () => db.prepare("DELETE FROM notifications WHERE project_id = 'proj-sn'").run();
const recipients = (rows: { recipient_id: string }[]) => [...new Set(rows.map((r) => r.recipient_id))].sort();

describe('stage change notifications', () => {
  it('a progress change notifies every HOD and Coordinator, but not the lead who made it', async () => {
    clear();
    await lead.patch(`${P}/phases/${STAGE}`).send({ progress: 40 }).expect(200);
    const rows = latest('stage_update');
    expect(recipients(rows)).toEqual([testUsers.coordinator.id, testUsers.hod.id].sort());
    expect(rows[0].title).toBe('Stage updated: Brief & scope');
    expect(rows[0].message).toBe(`${testUsers.leadA.name} updated Brief & scope on Project proj-sn: 0% → 40%.`);
  });

  it('a change by a Coordinator also notifies the project lead', async () => {
    clear();
    await coord.patch(`${P}/phases/${STAGE}`).send({ progress: 60 }).expect(200);
    expect(recipients(latest('stage_update'))).toEqual([testUsers.hod.id, testUsers.leadA.id].sort());
  });

  it('reaching 100% is flagged as Stage complete', async () => {
    clear();
    await lead.patch(`${P}/phases/${STAGE}`).send({ progress: 100, status: 'complete' }).expect(200);
    const rows = latest('stage_complete');
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Stage complete: Brief & scope');
    expect(rows[0].message).toContain('60% → 100%, In progress → Complete');
  });

  it('becoming blocked is flagged as Stage blocked', async () => {
    clear();
    await lead.patch(`${P}/phases/${STAGE}`).send({ status: 'blocked', progress: 70 }).expect(200);
    expect(latest('stage_blocked')[0].title).toBe('Stage blocked: Brief & scope');
  });

  it('saving without a progress or status change sends nothing', async () => {
    clear();
    await lead.patch(`${P}/phases/${STAGE}`).send({ workCompleted: 'Walls up', nextAction: 'Ceiling' }).expect(200);
    expect(latest()).toEqual([]);
  });

  it('viewers and other leads are never notified', async () => {
    db.prepare(
      "INSERT OR IGNORE INTO users (id, name, email, password_hash, role, title, initials) VALUES ('u-viewer-sn', 'Vee', 'vee@test.local', 'x', 'viewer', 'Viewer', 'VV')",
    ).run();
    clear();
    await lead.patch(`${P}/phases/${STAGE}`).send({ status: 'active', progress: 80 }).expect(200);
    const ids = recipients(latest());
    expect(ids).toEqual([testUsers.coordinator.id, testUsers.hod.id].sort());
    expect(ids).not.toContain('u-viewer-sn');
    expect(ids).not.toContain(testUsers.leadB.id);
  });
});

describe('update notifications', () => {
  it('a posted update notifies HODs, Coordinators and the lead, except the author and tagged people', async () => {
    clear();
    await coord
      .post(`${P}/updates`)
      .send({ kind: 'Progress', stage: 'Brief & scope', text: 'Ceiling framing done', taggedUsers: [testUsers.hod.id] })
      .expect(201);
    const rows = latest('stage_update');
    expect(recipients(rows)).toEqual([testUsers.leadA.id]);
    expect(rows[0].title).toBe('Progress update: Project proj-sn');
    expect(rows[0].message).toBe(`${testUsers.coordinator.name} on Brief & scope: Ceiling framing done`);
    // The tagged HOD gets their own "Tagged on" notification instead.
    expect(latest().some((r) => r.recipient_id === testUsers.hod.id && r.type !== 'stage_update')).toBe(true);
  });
});
