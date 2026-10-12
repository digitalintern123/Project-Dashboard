import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { fetchFullProject } from './projects.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';

export const projectUpdatesRouter = Router({ mergeParams: true });
export const globalUpdatesRouter = Router();

// GET all updates across the portfolio
globalUpdatesRouter.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, p.name as project_name, p.code as project_code, p.id as project_id
    FROM updates u
    JOIN projects p ON u.project_id = p.id
    ORDER BY u.created_at DESC
    LIMIT 100
  `).all() as any[];

  const updates = rows.map((r) => ({
    id: r.id,
    date: r.date,
    author: r.author,
    role: r.role,
    text: r.text,
    stage: r.stage,
    kind: r.kind,
    project: {
      id: r.project_id,
      name: r.project_name,
      code: r.project_code,
    },
  }));

  return res.json({ updates });
});

// GET updates for a specific project
projectUpdatesRouter.get('/', requireAuth, (req: any, res) => {
  const projectId = req.params.id as string;
  const rows = db.prepare(`
    SELECT * FROM updates
    WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as any[];

  return res.json({ updates: rows });
});

// POST add update to project
projectUpdatesRouter.post('/', requireAuth, requireProjectAccess(), (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const project = fetchFullProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const body = req.body;
  const updateId = `${projectId}-update-${Date.now()}`;
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  db.prepare(`
    INSERT INTO updates (id, project_id, date, author, role, text, stage, kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    updateId,
    projectId,
    body.date || todayFormatted,
    body.author || req.user?.name || 'Project Lead',
    body.role || req.user?.title || 'Project Lead',
    body.text,
    body.stage || null,
    body.kind || 'General'
  );

  // Update project last_updated
  db.prepare('UPDATE projects SET last_updated = ? WHERE id = ?').run(todayFormatted, projectId);

  saveDatabaseSnapshot();

  const updatedProject = fetchFullProject(projectId);
  return res.status(201).json({ project: updatedProject });
});
