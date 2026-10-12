import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { db, uploadsDir } from '../db/database.js';
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { broadcastNotification } from '../utils/notify.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { afterCommit, transactional } from '../utils/tx.js';
import { fetchFullProject } from './projects.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { audited } from '../utils/audit.js';

export const projectPhotosRouter = Router({ mergeParams: true });
export const globalPhotosRouter = Router();

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_UPLOAD = 20;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FULL_SIZE_PX = 2000;
const THUMBNAIL_PX = 400;

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

type PhotoMeta = { caption?: string; stage?: string; category?: string; takenDate?: string };

function parseMeta(raw: unknown, count: number): PhotoMeta[] {
  let parsed: unknown = [];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: count }, (_, i) => {
    const m = (list[i] ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
    return {
      caption: str(m.caption, 300),
      stage: str(m.stage, 120),
      category: str(m.category, 60),
      takenDate: str(m.takenDate, 30),
    };
  });
}

function removeUploadFile(url: string | null | undefined) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const filePath = path.join(uploadsDir, path.basename(url));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn(`[Photos] Could not remove ${filePath}:`, e);
  }
}

/** Deletes the stored image and thumbnail for a photo row. */
export function removePhotoFiles(photo: { url?: string | null; thumbnail_url?: string | null }) {
  removeUploadFile(photo.url);
  removeUploadFile(photo.thumbnail_url);
}

/**
 * Upload one or more site photographs as multipart/form-data:
 *   photos: image files (JPEG, PNG or WebP; up to 20, 10 MB each)
 *   meta:   optional JSON array of { caption, stage, category, takenDate },
 *           one entry per file in the same order
 *
 * The real file type is checked from the bytes, then every image is re-encoded
 * to WebP (max 2000 px) plus a 400 px thumbnail. Re-encoding drops EXIF and
 * other metadata (including GPS). Files get random UUID names.
 */
async function handlePhotoUpload(req: AuthenticatedRequest, res: Response) {
  const projectId = req.params.id as string;
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId) as { id: string; name: string } | undefined;
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'Please attach at least one photograph in the "photos" field.' });
  }

  // Check every file before writing anything, so a bad file rejects the batch.
  for (const file of files) {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      return res.status(400).json({
        error: `"${file.originalname}" is not a JPEG, PNG or WebP image.`,
      });
    }
  }

  const meta = parseMeta(req.body?.meta, files.length);
  const written: string[] = [];
  const prepared: Array<{ id: string; url: string; thumbnailUrl: string; size: number; meta: PhotoMeta }> = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const name = crypto.randomUUID();
      const fullName = `${name}.webp`;
      const thumbName = `${name}_thumb.webp`;

      // rotate() applies the EXIF orientation before the metadata is dropped.
      const image = sharp(files[i].buffer, { failOn: 'error' }).rotate();
      const full = await image
        .clone()
        .resize({ width: FULL_SIZE_PX, height: FULL_SIZE_PX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      const thumb = await image
        .clone()
        .resize({ width: THUMBNAIL_PX, height: THUMBNAIL_PX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      fs.writeFileSync(path.join(uploadsDir, fullName), full);
      written.push(fullName);
      fs.writeFileSync(path.join(uploadsDir, thumbName), thumb);
      written.push(thumbName);

      prepared.push({
        id: `photo-${crypto.randomUUID()}`,
        url: `/uploads/${fullName}`,
        thumbnailUrl: `/uploads/${thumbName}`,
        size: full.length,
        meta: meta[i],
      });
    }
  } catch (err) {
    for (const f of written) removeUploadFile(`/uploads/${f}`);
    console.warn('[Photos] Image processing failed:', err);
    return res.status(400).json({ error: 'One of the images could not be read. Please check the files and try again.' });
  }

  const uploaderName = req.user!.name;
  const uploaderRole = req.user!.title || req.user!.role;
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  const insert = db.prepare(`
    INSERT INTO photos (
      id, project_id, url, thumbnail_url, caption, stage, category, taken_date, uploaded_by, role, file_size, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let createdPhotos: any[];
  try {
    createdPhotos = db.transaction(() => {
      broadcastNotification(
        'system',
        `notif-photo-${crypto.randomUUID()}`,
        'Site Photograph Updated',
        prepared.length === 1
          ? `${uploaderName} uploaded a new site photograph for ${project.name}`
          : `${uploaderName} uploaded ${prepared.length} site photographs for ${project.name}`,
        projectId,
        `/project/${projectId}`,
      );
      return prepared.map((p) => {
        const caption = p.meta.caption || 'Site progress photograph';
        const category = p.meta.category || 'Progress';
        const takenDate = p.meta.takenDate || today;
        insert.run(p.id, projectId, p.url, p.thumbnailUrl, caption, p.meta.stage || null, category, takenDate, uploaderName, uploaderRole, p.size, nowIso);
        return {
          id: p.id,
          projectId,
          url: p.url,
          thumbnailUrl: p.thumbnailUrl,
          caption,
          stage: p.meta.stage || null,
          category,
          takenDate,
          uploadedBy: uploaderName,
          role: uploaderRole,
          fileSize: p.size,
          createdAt: nowIso,
        };
      });
    })();
  } catch (err) {
    for (const f of written) removeUploadFile(`/uploads/${f}`);
    throw err;
  }


  res.locals.auditEntityId = createdPhotos.map((p) => p.id).join(',');
  res.locals.auditAfter = createdPhotos;
  saveDatabaseSnapshot();

  return res.status(201).json({
    message: `Successfully uploaded ${createdPhotos.length} site photograph${createdPhotos.length > 1 ? 's' : ''}`,
    photos: createdPhotos,
    photo: createdPhotos[0],
    project: fetchFullProject(projectId),
  });
}

const photoUploadAudit = audited({ action: 'create', entityType: 'photo' });

projectPhotosRouter.post('/', requireAuth, requireProjectAccess(), validate({ params: S.projectParams }), photoUploadAudit, receivePhotos, handlePhotoUpload);
projectPhotosRouter.post('/batch', requireAuth, requireProjectAccess(), validate({ params: S.projectParams }), photoUploadAudit, receivePhotos, handlePhotoUpload);

/**
 * Delete a specific site photograph
 */
projectPhotosRouter.delete('/:photoId', requireAuth, requireProjectAccess(), validate({ params: S.photoParams }), audited({ action: 'delete', entityType: 'photo', table: 'photos', id: (req) => req.params.photoId as string }), transactional((req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const photoId = req.params.photoId as string;

  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND project_id = ?').get(photoId, projectId) as any;
  if (!photo) {
    return res.status(404).json({ error: 'Photograph not found' });
  }

  db.prepare('DELETE FROM photos WHERE id = ?').run(photoId);
  afterCommit(() => {
    removePhotoFiles(photo);
    saveDatabaseSnapshot();
  });

  return res.json({ message: 'Photograph deleted successfully', project: fetchFullProject(projectId) });
}));

/**
 * Get all photos for a project
 */
projectPhotosRouter.get('/', requireAuth, validate({ params: S.projectParams }), (req, res) => {
  const projectId = req.params.id as string;
  const rows = db.prepare('SELECT * FROM photos WHERE project_id = ? ORDER BY taken_date DESC, created_at DESC').all(projectId);
  res.json({ photos: rows });
});

/**
 * Global portfolio photographs endpoint
 */
globalPhotosRouter.get('/', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        p.id,
        p.project_id as projectId,
        p.url,
        p.thumbnail_url as thumbnailUrl,
        p.caption,
        p.stage,
        p.category,
        p.taken_date as takenDate,
        p.uploaded_by as uploadedBy,
        p.role,
        p.file_size as fileSize,
        p.created_at as createdAt,
        pr.name as projectName,
        pr.code as projectCode,
        pr.location as projectLocation,
        pr.category as projectCategory
      FROM photos p
      JOIN projects pr ON p.project_id = pr.id
      ORDER BY p.taken_date DESC, p.created_at DESC
    `).all();

    res.json({ photos: rows });
  } catch (err: any) {
    console.error('[Global Photos Error]', err);
    res.status(500).json({ error: 'Failed to fetch portfolio photographs', message: err.message });
  }
});
