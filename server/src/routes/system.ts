import { Router } from 'express';
import { db } from '../db/database.js';
import { clearAllProjectData } from '../db/seed.js';
import { getFullProjectRecord, restoreDatabaseFromJSON, saveDatabaseSnapshot } from '../utils/backup.js';
import { restoreAllPdfDataToDatabase } from '../scripts/restore-all-pdfs.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { largeJson } from '../validation/large-json.js';
import { audited } from '../utils/audit.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

// GET export database as JSON (Coordinator or Lead required)
router.get('/export', requireAuth, requireRole(['coordinator', 'lead']), (req: AuthenticatedRequest, res) => {
  try {
    const rows = db.prepare('SELECT id FROM projects ORDER BY name ASC').all() as { id: string }[];
    const projects = rows.map((r) => getFullProjectRecord(r.id)).filter(Boolean);
    const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100').all();

    return res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      projectCount: projects.length,
      projects,
      notifications,
    });
  } catch (err: any) {
    console.error('Export database failed:', err);
    return res.status(500).json({ error: 'Failed to export database', details: err.message });
  }
});

// POST import database from JSON (Coordinator only)
router.post('/import', requireAuth, requireRole(['coordinator']), largeJson, validate({ body: S.importBody }), audited({ action: 'import', entityType: 'portfolio', details: (req) => ({ projects: (req.body.projects as { id: string }[]).map((p) => p.id) }) }), (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ error: 'Missing import payload' });
    }
    const result = restoreDatabaseFromJSON(body);
    return res.json({
      message: `Database restored successfully. Restored ${result.count} projects.`,
      count: result.count,
    });
  } catch (err: any) {
    console.error('Import database failed:', err);
    return res.status(500).json({ error: 'Failed to import database', details: err.message });
  }
});

// Helper to check production wipe safeguards
function assertResetAllowed(res: any): boolean {
  if (isProduction && process.env.ALLOW_SYSTEM_RESET !== 'true') {
    res.status(403).json({
      error: 'Destructive system resets are disabled in production mode. Set ALLOW_SYSTEM_RESET=true in server environment to override.',
    });
    return false;
  }
  return true;
}

// POST reset/clear database (Coordinator only)
router.post('/reset', requireAuth, requireRole(['coordinator']), audited({ action: 'reset', entityType: 'portfolio' }), (req: AuthenticatedRequest, res) => {
  if (!assertResetAllowed(res)) return;
  try {
    clearAllProjectData();
    saveDatabaseSnapshot();
    return res.json({ message: 'Database wiped clean. Ready for fresh project data entry.' });
  } catch (err: any) {
    console.error('Reset database failed:', err);
    return res.status(500).json({ error: 'Failed to reset database', details: err.message });
  }
});

// POST clear database explicitly (Coordinator only)
router.post('/clear', requireAuth, requireRole(['coordinator']), audited({ action: 'clear', entityType: 'portfolio' }), (req: AuthenticatedRequest, res) => {
  if (!assertResetAllowed(res)) return;
  try {
    clearAllProjectData();
    saveDatabaseSnapshot();
    return res.json({ message: 'All project data cleared successfully.' });
  } catch (err: any) {
    console.error('Clear database failed:', err);
    return res.status(500).json({ error: 'Failed to clear database', details: err.message });
  }
});

// POST restore all 3 PDF master data (Coordinator only)
router.post('/restore-all-pdfs', requireAuth, requireRole(['coordinator']), audited({ action: 'restore_pdfs', entityType: 'portfolio' }), (req: AuthenticatedRequest, res) => {
  if (!assertResetAllowed(res)) return;
  try {
    const summary = restoreAllPdfDataToDatabase();
    return res.json({
      message: 'All 3 PDF datasets (Vizag Hotel & Suites, Mopa Goa Hotel, Master Project Area Sheet) restored successfully.',
      ...summary,
    });
  } catch (err: any) {
    console.error('Restore all PDFs failed:', err);
    return res.status(500).json({ error: 'Failed to restore PDF data', details: err.message });
  }
});

// GET audit log (Coordinator only), newest first, paginated
router.get('/audit', requireAuth, requireRole(['coordinator']), validate({ query: S.auditQuery }), (req, res) => {
  const q = req.query as { limit?: string; offset?: string; userId?: string; entityType?: string; entityId?: string; action?: string };
  const limit = Math.min(Number(q.limit ?? 50), 200);
  const offset = Number(q.offset ?? 0);

  const where: string[] = [];
  const params: string[] = [];
  if (q.userId) { where.push('a.user_id = ?'); params.push(q.userId); }
  if (q.entityType) { where.push('a.entity_type = ?'); params.push(q.entityType); }
  if (q.entityId) { where.push('a.entity_id = ?'); params.push(q.entityId); }
  if (q.action) { where.push('a.action = ?'); params.push(q.action); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as count FROM audit_log a ${whereSql}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`
    SELECT a.*, u.name AS user_name, u.email AS user_email
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    ${whereSql}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  const parse = (v: string | null) => {
    if (v == null) return null;
    try { return JSON.parse(v); } catch { return v; }
  };

  return res.json({
    total,
    limit,
    offset,
    entries: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name ?? null,
      userEmail: r.user_email ?? null,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      before: parse(r.before_json),
      after: parse(r.after_json),
      ip: r.ip,
      createdAt: r.created_at,
    })),
  });
});

// GET readiness probe (verifies database responsiveness)
router.get('/ready', (req, res) => {
  try {
    const ping = db.prepare('SELECT 1 as alive').get() as { alive: number };
    if (ping?.alive === 1) {
      return res.status(200).json({ status: 'ready' });
    }
    return res.status(503).json({ status: 'not_ready' });
  } catch (err: any) {
    return res.status(503).json({ status: 'not_ready' });
  }
});

// GET system health and statistics (Liveness probe)
router.get('/health', requireAuth, requireRole(['coordinator']), (req, res) => {
  try {
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const phaseCount = db.prepare('SELECT COUNT(*) as count FROM phases').get() as { count: number };
    const milestoneCount = db.prepare('SELECT COUNT(*) as count FROM milestones').get() as { count: number };
    const issueCount = db.prepare('SELECT COUNT(*) as count FROM issues').get() as { count: number };
    const updateCount = db.prepare('SELECT COUNT(*) as count FROM updates').get() as { count: number };

    const mem = process.memoryUsage();

    return res.json({
      status: 'healthy',
      database: 'connected (SQLite WAL)',
      counts: {
        projects: projectCount.count,
        users: userCount.count,
        phases: phaseCount.count,
        milestones: milestoneCount.count,
        issues: issueCount.count,
        updates: updateCount.count,
      },
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

export default router;
