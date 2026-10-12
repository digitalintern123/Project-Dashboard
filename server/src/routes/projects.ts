import { Router } from 'express';
import { requireAuth, requireRole, requireProjectAccess, type AuthenticatedRequest } from '../middleware/auth.js';
import { removePhotoFiles } from '../services/photos.service.js';
import { saveDatabaseSnapshot, restoreDatabaseFromJSON } from '../utils/backup.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { largeJson } from '../validation/large-json.js';
import { audited } from '../utils/audit.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { projectsRepo } from '../repositories/projects.repo.js';
import {
  allotProject,
  createProject,
  deleteProject,
  listProjects,
  requireProject,
  updateProject,
} from '../services/projects.service.js';

const router = Router();
const projectId = (req: AuthenticatedRequest) => req.params.id as string;

router.get('/', requireAuth, (_req, res) => {
  res.json({ projects: listProjects() });
});

router.get('/:id', requireAuth, validate({ params: S.projectParams }), (req, res) => {
  res.json({ project: requireProject(req.params.id as string) });
});

// Bulk upsert of full project records (coordinator tooling).
router.post(
  '/sync',
  requireAuth,
  requireRole(['coordinator']),
  largeJson,
  validate({ body: S.syncProjectsBody }),
  audited({
    action: 'sync',
    entityType: 'portfolio',
    details: (req) => ({ projects: (req.body.projects as { id: string }[]).map((p) => p.id) }),
  }),
  transactional((req: AuthenticatedRequest, res) => {
    const { projects, explicit } = req.body as { projects: { id: string }[]; explicit?: boolean };
    // Never let a stale browser cache resurrect projects into a deliberately emptied database.
    if (projectsRepo.count() === 0 && !explicit) {
      return res.json({
        success: true,
        count: 0,
        message: 'Database is empty; automatic sync bypassed to protect clean state.',
      });
    }
    const result = restoreDatabaseFromJSON({ projects });
    afterCommit(saveDatabaseSnapshot);
    return res.json({ success: true, count: result.count, message: `Synced ${result.count} projects successfully` });
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(['coordinator', 'lead']),
  validate({ body: S.createProjectBody }),
  audited({ action: 'create', entityType: 'project', table: 'projects' }),
  transactional((req: AuthenticatedRequest, res) => {
    const project = createProject(req.body, req.user!);
    res.locals.auditEntityId = project.id;
    afterCommit(saveDatabaseSnapshot);
    res.status(201).json({ project });
  }),
);

router.patch(
  '/:id/allot',
  requireAuth,
  requireRole(['coordinator']),
  validate({ params: S.projectParams, body: S.allotProjectBody }),
  audited({ action: 'allot', entityType: 'project', table: 'projects', id: projectId }),
  transactional((req: AuthenticatedRequest, res) => {
    const project = allotProject(projectId(req), req.body.leadId, req.user!);
    afterCommit(saveDatabaseSnapshot);
    res.json({ project });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.projectParams, body: S.updateProjectBody }),
  audited({ action: 'update', entityType: 'project', table: 'projects', id: projectId }),
  transactional((req: AuthenticatedRequest, res) => {
    const project = updateProject(projectId(req), req.body, req.user!);
    afterCommit(saveDatabaseSnapshot);
    res.json({ project });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['coordinator']),
  validate({ params: S.projectParams }),
  audited({ action: 'delete', entityType: 'project', table: 'projects', id: projectId }),
  transactional((req: AuthenticatedRequest, res) => {
    const files = deleteProject(projectId(req));
    // Files go only once the rows are gone for good.
    afterCommit(() => files.forEach(removePhotoFiles));
    afterCommit(saveDatabaseSnapshot);
    res.json({ message: 'Project deleted successfully' });
  }),
);

export default router;
