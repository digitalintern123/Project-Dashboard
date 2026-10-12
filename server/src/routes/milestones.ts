import { Router } from 'express';
import { requireAuth, requireProjectAccess, type AuthenticatedRequest } from '../middleware/auth.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';
import { audited } from '../utils/audit.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { requireProject } from '../services/projects.service.js';
import { addMilestone, removeMilestone, updateMilestone, type Actor } from '../services/project-items.service.js';

const router = Router({ mergeParams: true });
const projectId = (req: AuthenticatedRequest) => req.params.id as string;
const itemId = (req: AuthenticatedRequest) => req.params.milestoneId as string;
const actor = (req: AuthenticatedRequest): Actor => ({ user: req.user!, origin: publicBaseUrl(req) });

function respond(req: AuthenticatedRequest, res: import('express').Response, status = 200) {
  afterCommit(saveDatabaseSnapshot);
  res.status(status).json({ project: requireProject(projectId(req)) });
}

router.post(
  '/',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.projectParams, body: S.createMilestoneBody }),
  audited({ action: 'create', entityType: 'milestone', table: 'milestones' }),
  transactional((req: AuthenticatedRequest, res) => {
    res.locals.auditEntityId = addMilestone(projectId(req), req.body, actor(req));
    respond(req, res, 201);
  }),
);

router.patch(
  '/:milestoneId',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.milestoneParams, body: S.updateMilestoneBody }),
  audited({ action: 'update', entityType: 'milestone', table: 'milestones', id: itemId }),
  transactional((req: AuthenticatedRequest, res) => {
    updateMilestone(projectId(req), itemId(req), req.body, actor(req));
    respond(req, res);
  }),
);

router.delete(
  '/:milestoneId',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.milestoneParams }),
  audited({ action: 'delete', entityType: 'milestone', table: 'milestones', id: itemId }),
  transactional((req: AuthenticatedRequest, res) => {
    removeMilestone(projectId(req), itemId(req));
    respond(req, res);
  }),
);

export default router;
