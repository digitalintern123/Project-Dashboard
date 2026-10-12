import { Router } from 'express';
import { requireAuth, requireProjectAccess, type AuthenticatedRequest } from '../middleware/auth.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { validate } from '../validation/validate.js';
import { pageFrom } from '../utils/paging.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';
import { audited } from '../utils/audit.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { requireProject } from '../services/projects.service.js';
import { addUpdate } from '../services/project-items.service.js';
import { updatesRepo } from '../repositories/updates.repo.js';
import { projectsRepo } from '../repositories/projects.repo.js';
import { notFound } from '../utils/http-error.js';

export const projectUpdatesRouter = Router({ mergeParams: true });
export const globalUpdatesRouter = Router();

// Latest updates across the portfolio
globalUpdatesRouter.get('/', requireAuth, validate({ query: S.pageQuery }), (req, res) => {
  const page = pageFrom(req.query, 100);
  const updates = updatesRepo.listRecent(page).map((r) => ({
    id: r.id,
    date: r.date,
    author: r.author,
    role: r.role,
    text: r.text,
    stage: r.stage,
    kind: r.kind,
    project: { id: r.project_id, name: r.project_name, code: r.project_code },
  }));
  res.json({ updates, total: updatesRepo.countAll(), ...page });
});

projectUpdatesRouter.get('/', requireAuth, validate({ params: S.projectParams, query: S.pageQuery }), (req, res) => {
  const id = req.params.id as string;
  if (!projectsRepo.exists(id)) throw notFound('Project');
  const page = pageFrom(req.query, 100);
  res.json({ updates: updatesRepo.listForProject(id, page), total: updatesRepo.countForProject(id), ...page });
});

projectUpdatesRouter.post(
  '/',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.projectParams, body: S.createUpdateBody }),
  audited({ action: 'create', entityType: 'update', table: 'updates' }),
  transactional((req: AuthenticatedRequest, res) => {
    const id = req.params.id as string;
    res.locals.auditEntityId = addUpdate(id, req.body, { user: req.user!, origin: publicBaseUrl(req) });
    afterCommit(saveDatabaseSnapshot);
    res.status(201).json({ project: requireProject(id) });
  }),
);
