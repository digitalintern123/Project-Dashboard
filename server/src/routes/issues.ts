import { Router } from 'express';
import { requireAuth, requireProjectAccess, type AuthenticatedRequest } from '../middleware/auth.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';
import { audited } from '../utils/audit.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { requireProject } from '../services/projects.service.js';
import { addIssue, removeIssue, updateIssue, type Actor } from '../services/project-items.service.js';

const router = Router({ mergeParams: true });
const projectId = (req: AuthenticatedRequest) => req.params.id as string;
const itemId = (req: AuthenticatedRequest) => req.params.issueId as string;
const actor = (req: AuthenticatedRequest): Actor => ({ user: req.user!, origin: publicBaseUrl(req) });

function respond(req: AuthenticatedRequest, res: import('express').Response, status = 200) {
  afterCommit(saveDatabaseSnapshot);
  res.status(status).json({ project: requireProject(projectId(req)) });
}

router.post(
  '/',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.projectParams, body: S.createIssueBody }),
  audited({ action: 'create', entityType: 'issue', table: 'issues' }),
  transactional((req: AuthenticatedRequest, res) => {
    res.locals.auditEntityId = addIssue(projectId(req), req.body, actor(req));
    respond(req, res, 201);
  }),
);

router.patch(
  '/:issueId',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.issueParams, body: S.updateIssueBody }),
  audited({ action: 'update', entityType: 'issue', table: 'issues', id: itemId }),
  transactional((req: AuthenticatedRequest, res) => {
    updateIssue(projectId(req), itemId(req), req.body, actor(req));
    respond(req, res);
  }),
);

router.delete(
  '/:issueId',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.issueParams }),
  audited({ action: 'delete', entityType: 'issue', table: 'issues', id: itemId }),
  transactional((req: AuthenticatedRequest, res) => {
    removeIssue(projectId(req), itemId(req));
    respond(req, res);
  }),
);

export default router;
