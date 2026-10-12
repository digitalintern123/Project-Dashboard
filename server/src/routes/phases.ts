import { Router } from 'express';
import { requireAuth, requireProjectAccess, type AuthenticatedRequest } from '../middleware/auth.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';
import { audited } from '../utils/audit.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { requireProject } from '../services/projects.service.js';
import { addStage, moveStage, removeStage, updateStage, type Actor } from '../services/project-items.service.js';

const router = Router({ mergeParams: true });
const projectId = (req: AuthenticatedRequest) => req.params.id as string;
const stageId = (req: AuthenticatedRequest) => req.params.phaseId as string;
const actor = (req: AuthenticatedRequest): Actor => ({ user: req.user!, origin: publicBaseUrl(req) });

/** Responds with the updated project once the change commits. */
function respond(req: AuthenticatedRequest, res: import('express').Response, status = 200) {
  afterCommit(saveDatabaseSnapshot);
  res.status(status).json({ project: requireProject(projectId(req)) });
}

const stagesAccess = [requireAuth, requireProjectAccess()];

router.post(
  '/',
  ...stagesAccess,
  validate({ params: S.projectParams, body: S.createPhaseBody }),
  audited({ action: 'create', entityType: 'stage', table: 'phases' }),
  transactional((req: AuthenticatedRequest, res) => {
    res.locals.auditEntityId = addStage(projectId(req), req.body, actor(req));
    respond(req, res, 201);
  }),
);

router.patch(
  '/:phaseId',
  ...stagesAccess,
  validate({ params: S.phaseParams, body: S.updatePhaseBody }),
  audited({ action: 'update', entityType: 'stage', table: 'phases', id: stageId }),
  transactional((req: AuthenticatedRequest, res) => {
    updateStage(projectId(req), stageId(req), req.body, actor(req));
    respond(req, res);
  }),
);

router.delete(
  '/:phaseId',
  ...stagesAccess,
  validate({ params: S.phaseParams }),
  audited({ action: 'delete', entityType: 'stage', table: 'phases', id: stageId }),
  transactional((req: AuthenticatedRequest, res) => {
    removeStage(projectId(req), stageId(req));
    respond(req, res);
  }),
);

router.post(
  '/move',
  ...stagesAccess,
  validate({ params: S.projectParams, body: S.movePhaseBody }),
  audited({ action: 'move', entityType: 'stage', details: (req) => req.body }),
  transactional((req: AuthenticatedRequest, res) => {
    moveStage(projectId(req), req.body.phaseIndex, req.body.direction);
    respond(req, res);
  }),
);

export default router;
