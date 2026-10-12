import { Router } from 'express';
import { db } from '../db/database.js';
import { clearAllProjectData } from '../db/seed.js';
import { getFullProjectRecord, restoreDatabaseFromJSON, saveDatabaseSnapshot } from '../utils/backup.js';
import { restoreAllPdfDataToDatabase } from '../scripts/restore-all-pdfs.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

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
router.post('/import', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
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
router.post('/reset', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
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
router.post('/clear', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
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
router.post('/restore-all-pdfs', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
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
