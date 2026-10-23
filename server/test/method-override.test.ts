import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, loginAs, insertProject } from './helpers.js';
import { db } from '../src/db/database.js';

// Plesk's web application firewall refuses PATCH and DELETE (and the standard
// X-HTTP-Method-Override header), so the web app sends them as POST with
// X-Encalm-Method.
const app = makeApp();
const P = '/api/projects/proj-mo';
let lead: any;
let hod: any;

beforeAll(async () => {
  insertProject('proj-mo', 'u-lead-a');
  lead = await loginAs(app, 'leadA');
  hod = await loginAs(app, 'hod');
});

const stageProgress = () =>
  (db.prepare("SELECT progress FROM phases WHERE id = 'proj-mo-phase-0'").get() as { progress: number }).progress;

describe('X-Encalm-Method', () => {
  it('saves a stage update sent as POST with PATCH in the header, and audits it', async () => {
    const res = await lead.post(`${P}/phases/proj-mo-phase-0`).set('X-Encalm-Method', 'PATCH').send({ progress: 67 });
    expect(res.status).toBe(200);
    expect(res.body.project.phases[0].progress).toBe(67);
    expect(stageProgress()).toBe(67);
    expect(
      db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'update' AND entity_id = 'proj-mo-phase-0'").get(),
    ).toEqual({ c: 1 });
  });

  it('runs a DELETE sent as POST', async () => {
    await lead.post(`${P}/phases`).send({ id: 'proj-mo-extra', name: 'Extra' });
    const res = await lead.post(`${P}/phases/proj-mo-extra`).set('x-encalm-method', 'delete');
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT 1 FROM phases WHERE id = 'proj-mo-extra'").get()).toBeUndefined();
  });

  it('keeps every permission check: a HOD is still refused', async () => {
    const res = await hod.post(`${P}/phases/proj-mo-phase-0`).set('X-Encalm-Method', 'PATCH').send({ progress: 1 });
    expect(res.status).toBe(403);
    expect(stageProgress()).toBe(67);
  });

  it('keeps the CSRF check: a session request without the custom header is refused', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'lead.a@test.local', password: 'Test-password-123' });
    const res = await agent.post(`${P}/phases/proj-mo-phase-0`).set('X-Encalm-Method', 'PATCH').send({ progress: 2 });
    expect(res.status).toBe(403);
    expect(stageProgress()).toBe(67);
  });

  it('ignores the header on GET and for other methods', async () => {
    const get = await lead.get(P).set('X-Encalm-Method', 'DELETE');
    expect(get.status).toBe(200);
    expect(db.prepare("SELECT 1 FROM projects WHERE id = 'proj-mo'").get()).toBeTruthy();
    const other = await lead.post(`${P}/phases/proj-mo-phase-0`).set('X-Encalm-Method', 'TRACE').send({});
    expect(other.status).toBe(404);
  });

  it('still accepts the standard X-HTTP-Method-Override header', async () => {
    const res = await lead
      .post(`${P}/phases/proj-mo-phase-0`)
      .set('X-HTTP-Method-Override', 'PATCH')
      .send({ progress: 70 });
    expect(res.status).toBe(200);
    expect(stageProgress()).toBe(70);
  });
});
