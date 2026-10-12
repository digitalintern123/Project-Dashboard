import express from 'express';
import cors from 'cors';
import { db, initDatabase } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import authRouter from '../routes/auth.js';
import projectsRouter from '../routes/projects.js';
import phasesRouter from '../routes/phases.js';
import milestonesRouter from '../routes/milestones.js';
import issuesRouter from '../routes/issues.js';
import { projectUpdatesRouter, globalUpdatesRouter } from '../routes/updates.js';
import notificationsRouter from '../routes/notifications.js';
import systemRouter from '../routes/system.js';
import emailRouter from '../routes/email.js';
import { projectPhotosRouter, globalPhotosRouter } from '../routes/photos.js';

interface TestResult {
  name: string;
  category: string;
  method: string;
  endpoint: string;
  status: number;
  expectedStatus: number;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  ENCALM PROJECT DASHBOARD - FULL SYSTEM & API AUDIT RUNNER   ');
  console.log('===============================================================\n');

  // 1. Initialize Database
  console.log('Step 1: Checking Database & Schema Initialization...');
  initDatabase();
  seedDatabase(false);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  console.log(`✓ SQLite connected. Tables found (${tables.length}): ${tables.map(t => t.name).join(', ')}`);

  const projectCount = db.prepare('SELECT count(*) as cnt FROM projects').get() as { cnt: number };
  console.log(`✓ Authentic Facilities in DB: ${projectCount.cnt}`);

  // 2. Set up ephemeral Express instance for deterministic testing
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:id/phases', phasesRouter);
  app.use('/api/projects/:id/milestones', milestonesRouter);
  app.use('/api/projects/:id/issues', issuesRouter);
  app.use('/api/projects/:id/updates', projectUpdatesRouter);
  app.use('/api/projects/:id/photos', projectPhotosRouter);
  app.use('/api/updates', globalUpdatesRouter);
  app.use('/api/photos', globalPhotosRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/email', emailRouter);
  app.use('/api/system', systemRouter);

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 5001;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`✓ Test API server listening on ${baseUrl}\n`);

  let authToken = '';

  async function testApi(
    name: string,
    category: string,
    method: string,
    path: string,
    body?: any,
    expectedStatus: number = 200,
    validator?: (data: any) => boolean | string
  ) {
    const start = Date.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const durationMs = Date.now() - start;
      const json = await res.json().catch(() => null);

      let customCheckPass = true;
      let checkDetail = '';
      if (validator && json) {
        const valRes = validator(json);
        if (typeof valRes === 'string') {
          customCheckPass = false;
          checkDetail = valRes;
        } else if (valRes === false) {
          customCheckPass = false;
          checkDetail = 'Validation assertion failed';
        }
      }

      const passed = res.status === expectedStatus && customCheckPass;
      results.push({
        name,
        category,
        method,
        endpoint: path,
        status: res.status,
        expectedStatus,
        passed,
        durationMs,
        details: checkDetail || (json?.error ? String(json.error) : undefined),
      });

      const icon = passed ? '✓' : '✗';
      console.log(` ${icon} [${category}] ${method} ${path} -> ${res.status} (${durationMs}ms)`);
      if (!passed && checkDetail) {
        console.log(`   └─ Error: ${checkDetail}`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      results.push({
        name,
        category,
        method,
        endpoint: path,
        status: 0,
        expectedStatus,
        passed: false,
        durationMs,
        details: err.message,
      });
      console.log(` ✗ [${category}] ${method} ${path} -> FAILED (${err.message})`);
    }
  }

  console.log('Step 2: Executing API Route Tests...\n');

  // --- System APIs ---
  await testApi('System Health Check (Liveness)', 'System', 'GET', '/api/system/health', undefined, 200, (d) => {
    return d.status === 'healthy' && d.counts?.projects >= 68;
  });

  await testApi('System Ready Probe (Readiness)', 'System', 'GET', '/api/system/ready', undefined, 200, (d) => {
    return d.status === 'ready';
  });

  // --- Auth APIs ---
  const liveEmail = process.env.LIVE_TEST_EMAIL || 'chinmay.saxena@encalm.com';
  const livePassword = process.env.LIVE_TEST_PASSWORD;
  if (!livePassword) {
    console.error('Set LIVE_TEST_PASSWORD (and optionally LIVE_TEST_EMAIL) to run the live API checks.');
    process.exit(1);
  }
  await testApi('Login with Lead Account', 'Auth', 'POST', '/api/auth/login', {
    email: liveEmail,
    password: livePassword,
  }, 200, (d) => {
    if (d.token) {
      authToken = d.token;
    }
    return Boolean(d.token && d.user?.email === liveEmail);
  });

  await testApi('List System Users', 'Auth', 'GET', '/api/auth/users', undefined, 200, (d) => {
    return Array.isArray(d.users) && d.users.length >= 3;
  });

  // --- Projects APIs ---
  let sampleProjectId = 'delhi-1st-class-lounge-inl-07-07a-xenia';
  await testApi('List All Projects', 'Projects', 'GET', '/api/projects', undefined, 200, (d) => {
    if (!Array.isArray(d.projects) || d.projects.length < 68) {
      return `Expected at least 68 projects, found ${d.projects?.length}`;
    }
    sampleProjectId = d.projects[0].id;
    return true;
  });

  await testApi('Get Single Project Detail', 'Projects', 'GET', `/api/projects/${sampleProjectId}`, undefined, 200, (d) => {
    return Boolean(d.project && d.project.id === sampleProjectId && Array.isArray(d.project.phases));
  });

  // --- Phases (Stages) APIs ---
  let createdPhaseId: string | undefined;
  await testApi('Add Project Phase/Stage', 'Phases', 'POST', `/api/projects/${sampleProjectId}/phases`, {
    name: 'Diagnostic Test Phase',
    owner: 'Quality Assurance',
    status: 'upcoming',
    progress: 0,
  }, 201, (d) => {
    const phase = d.project?.phases?.find((p: any) => p.name === 'Diagnostic Test Phase');
    if (phase) createdPhaseId = phase.id;
    return Boolean(phase);
  });
  if (createdPhaseId) {
    await testApi('Clean up Test Phase', 'Phases', 'DELETE', `/api/projects/${sampleProjectId}/phases/${createdPhaseId}`, undefined, 200);
  }

  // --- Milestones APIs ---
  let createdMilestoneId: string | undefined;
  await testApi('Add Milestone', 'Milestones', 'POST', `/api/projects/${sampleProjectId}/milestones`, {
    title: 'Diagnostic Test Milestone',
    date: '2026-12-31',
    status: 'upcoming',
    stage: 'Planning',
    owner: 'QA Lead',
    approvalRequired: false,
    approvalStatus: 'Not required',
  }, 201, (d) => {
    const ms = d.project?.milestones?.find((m: any) => m.title === 'Diagnostic Test Milestone');
    if (ms) createdMilestoneId = ms.id;
    return Boolean(ms);
  });
  if (createdMilestoneId) {
    await testApi('Clean up Test Milestone', 'Milestones', 'DELETE', `/api/projects/${sampleProjectId}/milestones/${createdMilestoneId}`, undefined, 200);
  }

  // --- Issues APIs ---
  let createdIssueId: string | undefined;
  await testApi('Add Issue', 'Issues', 'POST', `/api/projects/${sampleProjectId}/issues`, {
    title: 'Diagnostic Test Issue',
    category: 'Operational',
    severity: 'Low',
    stage: 'Planning',
    detail: 'Verification of issue creation pipeline.',
  }, 201, (d) => {
    const iss = d.project?.issues?.find((i: any) => i.title === 'Diagnostic Test Issue');
    if (iss) createdIssueId = iss.id;
    return Boolean(iss);
  });
  if (createdIssueId) {
    await testApi('Clean up Test Issue', 'Issues', 'DELETE', `/api/projects/${sampleProjectId}/issues/${createdIssueId}`, undefined, 200);
  }

  // --- Updates APIs ---
  await testApi('List Global Updates Feed', 'Updates', 'GET', '/api/updates', undefined, 200, (d) => {
    return Array.isArray(d.updates);
  });

  await testApi('List Project Updates', 'Updates', 'GET', `/api/projects/${sampleProjectId}/updates`, undefined, 200, (d) => {
    return Array.isArray(d.updates);
  });

  await testApi('Post Project Update Note', 'Updates', 'POST', `/api/projects/${sampleProjectId}/updates`, {
    author: 'Audit Runner',
    role: 'Quality Assurance',
    text: 'Automated test update note verification.',
    kind: 'Progress',
    stage: 'Planning',
  }, 201, (d) => {
    return Boolean(d.project && Array.isArray(d.project.updates));
  });

  // --- Photos APIs ---
  await testApi('List Global Photo Gallery', 'Photos', 'GET', '/api/photos', undefined, 200, (d) => {
    return Array.isArray(d.photos);
  });

  await testApi('List Project Photos', 'Photos', 'GET', `/api/projects/${sampleProjectId}/photos`, undefined, 200, (d) => {
    return Array.isArray(d.photos);
  });

  // --- Notifications APIs ---
  await testApi('List Notifications', 'Notifications', 'GET', '/api/notifications', undefined, 200, (d) => {
    return Array.isArray(d.notifications);
  });

  // --- Email & Tagging APIs (SMTP & Microsoft Graph API) ---
  await testApi('Get Email Settings', 'Email', 'GET', '/api/email/settings', undefined, 200, (d) => {
    return d.settings && (d.settings.provider === 'smtp' || d.settings.provider === 'microsoft_graph') && typeof d.settings.isConfigured === 'boolean';
  });

  await testApi('Save Outlook SMTP Settings', 'Email', 'POST', '/api/email/settings', {
    provider: 'smtp',
    smtp: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      user: 'notifications@outlook.com',
      pass: 'test-app-password-16ch',
      fromName: 'Encalm Audit',
    },
  }, 200, (d) => {
    return d.settings?.provider === 'smtp' && d.settings?.smtp?.isConfigured === true && d.settings?.smtp?.host === 'smtp-mail.outlook.com';
  });

  await testApi('Save Microsoft Graph Settings', 'Email', 'POST', '/api/email/settings', {
    provider: 'microsoft_graph',
    tenantId: 'test-azure-tenant-id-84a7e930',
    clientId: 'test-azure-client-id-3df2a510',
    clientSecret: 'test-secret-value-12345',
    senderEmail: 'notifications@encalm.com',
    saveToSentItems: true,
  }, 200, (d) => {
    return d.settings?.provider === 'microsoft_graph' && d.settings?.isConfigured === true;
  });

  await testApi('Get Email Logs / Outbox', 'Email', 'GET', '/api/email/logs', undefined, 200, (d) => {
    return Array.isArray(d.logs);
  });

  await testApi('Tag Member, Comment & Send Mail', 'Email', 'POST', '/api/email/tag-and-comment', {
    projectId: sampleProjectId,
    entityType: 'Stage',
    entityId: 'stage-1',
    entityTitle: 'Stage 1: Concept & Planning',
    entityContext: 'Final drawings ready for approval.',
    taggedUserIds: ['user-ruchika-chauhan'],
    comment: 'Audit comment: Please verify and sign off the drawings.',
    authorName: 'Audit System',
  }, 200, (d) => {
    return d.success === true && Array.isArray(d.recipients) && d.recipients.length > 0;
  });

  // Close test server
  server.close();

  // Print scorecard summary
  console.log('\n===============================================================');
  console.log('                    AUDIT SCORECARD SUMMARY                    ');
  console.log('===============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Endpoints Tested : ${total}`);
  console.log(`Passed                 : ${passed} / ${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Failed                 : ${failed}`);
  console.log('---------------------------------------------------------------');

  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${String(idx + 1).padStart(2, ' ')}. [${mark}] [${r.category}] ${r.method.padEnd(4, ' ')} ${r.endpoint} (${r.durationMs}ms)`);
  });
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
