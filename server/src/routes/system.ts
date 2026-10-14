import { Router, type NextFunction, type Request, type Response } from 'express';
import { clearAllProjectData } from '../db/seed.js';
import { exportPortfolioProjects, restoreDatabaseFromJSON, saveDatabaseSnapshot } from '../utils/backup.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../validation/validate.js';
import { pageFrom } from '../utils/paging.js';
import * as S from '../validation/schemas.js';
import { largeJson } from '../validation/large-json.js';
import { audited } from '../utils/audit.js';
import { auditRepo, type AuditFilter } from '../repositories/audit.repo.js';
import { systemRepo } from '../repositories/system.repo.js';
import { backupStatus, runBackup } from '../utils/scheduled-backup.js';

const router = Router();

// Full portfolio as JSON
router.get('/export', requireAuth, requireRole(['coordinator', 'lead']), (_req, res) => {
  const projects = exportPortfolioProjects();
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    projectCount: projects.length,
    projects,
    notifications: systemRepo.recentNotifications(100),
  });
});

// Replace the portfolio from an export
router.post(
  '/import',
  requireAuth,
  requireRole(['coordinator']),
  largeJson,
  validate({ body: S.importBody }),
  audited({
    action: 'import',
    entityType: 'portfolio',
    details: (req) => ({ projects: (req.body.projects as { id: string }[]).map((p) => p.id) }),
  }),
  (req, res) => {
    const result = restoreDatabaseFromJSON(req.body);
    res.json({
      message: `Database restored successfully. Restored ${result.count} projects.`,
      count: result.count,
    });
  },
);

/** Wiping the portfolio is disabled in production unless ALLOW_SYSTEM_RESET=true. */
function resetAllowed(_req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SYSTEM_RESET !== 'true') {
    res.status(403).json({
      error:
        'Destructive system resets are disabled in production mode. Set ALLOW_SYSTEM_RESET=true in server environment to override.',
    });
    return;
  }
  next();
}

function wipeRoute(path: string, action: string, message: string) {
  router.post(
    path,
    requireAuth,
    requireRole(['coordinator']),
    resetAllowed,
    audited({ action, entityType: 'portfolio' }),
    (_req, res) => {
      clearAllProjectData();
      saveDatabaseSnapshot();
      res.json({ message });
    },
  );
}
wipeRoute('/reset', 'reset', 'Database wiped clean. Ready for fresh project data entry.');
wipeRoute('/clear', 'clear', 'All project data cleared successfully.');

const parseJson = (v: string | null): unknown => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

// Audit log, newest first, paginated
router.get('/audit', requireAuth, requireRole(['coordinator']), validate({ query: S.auditQuery }), (req, res) => {
  const q = req.query as AuditFilter & { limit?: string; offset?: string };
  const filter: AuditFilter = { userId: q.userId, entityType: q.entityType, entityId: q.entityId, action: q.action };
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
      before: parseJson(r.before_json),
      after: parseJson(r.after_json),
      ip: r.ip,
      createdAt: r.created_at,
    })),
  });
});

// Server-side backups: status, newest first (coordinator only)
router.get('/backups', requireAuth, requireRole(['coordinator']), (_req, res) => {
  res.json(backupStatus());
});

// "Back up now": at most one a minute
let lastManualBackup = 0;
router.post(
  '/backups',
  requireAuth,
  requireRole(['coordinator']),
  (_req, res, next) => {
    if (Date.now() - lastManualBackup < 60_000) {
      res.status(429).json({ error: 'A backup was just made. Try again in a minute.' });
      return;
    }
    lastManualBackup = Date.now();
    next();
  },
  audited({ action: 'backup', entityType: 'database' }),
  async (_req, res) => {
    const result = await runBackup();
    res.locals.auditAfter = result;
    res
      .status(result.ok ? 200 : 500)
      .json({ result, ...(result.ok ? {} : { error: result.error }), ...backupStatus() });
  },
);

// Readiness probe: the database answers
router.get('/ready', (_req, res) => {
  let ready = false;
  try {
    ready = systemRepo.ping();
  } catch {
    ready = false;
  }
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
});

// Detailed health and row counts for coordinators
router.get('/health', requireAuth, requireRole(['coordinator']), (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'healthy',
    database: 'connected (SQLite WAL)',
    counts: systemRepo.rowCounts(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    serverTime: new Date().toISOString(),
  });
});

export default router;
