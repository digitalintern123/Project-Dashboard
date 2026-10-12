import { Router, type NextFunction, type Response } from 'express';
import multer from 'multer';
import { requireAuth, requireProjectAccess, type AuthenticatedRequest } from '../middleware/auth.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { validate } from '../validation/validate.js';
import { pageFrom } from '../utils/paging.js';
import * as S from '../validation/schemas.js';
import { audited } from '../utils/audit.js';
import { photosRepo } from '../repositories/photos.repo.js';
import { getProject } from '../services/projects.service.js';
import { deletePhoto, removePhotoFiles, uploadPhotos } from '../services/photos.service.js';

export const projectPhotosRouter = Router({ mergeParams: true });
export const globalPhotosRouter = Router();

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_UPLOAD = 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS_PER_UPLOAD, fields: 10, fieldSize: 256 * 1024 },
});

/** Turns multer limit errors into 4xx responses instead of 500s. */
function receivePhotos(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  upload.array('photos', MAX_PHOTOS_PER_UPLOAD)(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Each photograph must be ${MAX_PHOTO_BYTES / 1024 / 1024} MB or smaller.`
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Upload at most ${MAX_PHOTOS_PER_UPLOAD} photographs at a time, in the "photos" field.`
            : err.message;
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
    }
    next(err);
  });
}

/**
 * Upload one or more site photographs as multipart/form-data:
 *   photos: image files (JPEG, PNG or WebP; up to 20, 10 MB each)
 *   meta:   optional JSON array of { caption, stage, category, takenDate },
 *           one entry per file in the same order
 */
async function handlePhotoUpload(req: AuthenticatedRequest, res: Response) {
  const projectId = req.params.id as string;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const photos = await uploadPhotos(projectId, files, req.body?.meta, req.user!);

  res.locals.auditEntityId = photos.map((p) => p.id).join(',');
  res.locals.auditAfter = photos;
  saveDatabaseSnapshot();

  res.status(201).json({
    message: `Successfully uploaded ${photos.length} site photograph${photos.length > 1 ? 's' : ''}`,
    photos,
    photo: photos[0],
    project: getProject(projectId),
  });
}

const photoUploadAudit = audited({ action: 'create', entityType: 'photo' });

for (const path of ['/', '/batch']) {
  projectPhotosRouter.post(
    path,
    requireAuth,
    requireProjectAccess(),
    validate({ params: S.projectParams }),
    photoUploadAudit,
    receivePhotos,
    handlePhotoUpload,
  );
}

projectPhotosRouter.delete(
  '/:photoId',
  requireAuth,
  requireProjectAccess(),
  validate({ params: S.photoParams }),
  audited({ action: 'delete', entityType: 'photo', table: 'photos', id: (req) => req.params.photoId as string }),
  transactional((req: AuthenticatedRequest, res) => {
    const projectId = req.params.id as string;
    const photo = deletePhoto(projectId, req.params.photoId as string);
    afterCommit(() => {
      removePhotoFiles(photo);
      saveDatabaseSnapshot();
    });
    res.json({ message: 'Photograph deleted successfully', project: getProject(projectId) });
  }),
);

projectPhotosRouter.get('/', requireAuth, validate({ params: S.projectParams, query: S.pageQuery }), (req, res) => {
  const id = req.params.id as string;
  const page = pageFrom(req.query, 100);
  res.json({ photos: photosRepo.listForProject(id, page), total: photosRepo.countForProject(id), ...page });
});

// Every photograph across the portfolio, with its project's name and code.
globalPhotosRouter.get('/', requireAuth, validate({ query: S.pageQuery }), (req, res) => {
  const page = pageFrom(req.query, 100);
  res.json({ photos: photosRepo.listPortfolio(page), total: photosRepo.countAll(), ...page });
});
