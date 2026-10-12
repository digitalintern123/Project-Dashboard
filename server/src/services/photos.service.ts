import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { db, uploadsDir } from '../db/database.js';
import type { UserPayload } from '../middleware/auth.js';
import { photosRepo } from '../repositories/photos.repo.js';
import { projectsRepo } from '../repositories/projects.repo.js';
import type { PhotoRow } from '../repositories/rows.js';
import { broadcastNotification } from '../utils/notify.js';
import { badRequest, notFound } from '../utils/http-error.js';
import { logger } from '../logger.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FULL_SIZE_PX = 2000;
const THUMBNAIL_PX = 400;

export type PhotoMeta = { caption?: string; stage?: string; category?: string; takenDate?: string };
export type UploadedImage = { originalname: string; buffer: Buffer };

export type PhotoDto = {
  id: string;
  projectId: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  stage: string | null;
  category: string | null;
  takenDate: string | null;
  uploadedBy: string;
  role: string | null;
  fileSize: number | null;
  createdAt: string;
};

/** Reads the optional `meta` form field: a JSON array with one entry per file. */
export function parsePhotoMeta(raw: unknown, count: number): PhotoMeta[] {
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
    logger.warn({ err: e }, `[Photos] Could not remove ${filePath}`);
  }
}

/** Deletes the stored image and thumbnail for a photo row. */
export function removePhotoFiles(photo: { url?: string | null; thumbnail_url?: string | null }) {
  removeUploadFile(photo.url);
  removeUploadFile(photo.thumbnail_url);
}

function toPhotoDto(row: PhotoRow): PhotoDto {
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption,
    stage: row.stage,
    category: row.category,
    takenDate: row.taken_date,
    uploadedBy: row.uploaded_by,
    role: row.role,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

/**
 * Stores site photographs for a project.
 *
 * The real file type is checked from the bytes, then every image is re-encoded
 * to WebP (max 2000 px) plus a 400 px thumbnail. Re-encoding drops EXIF and
 * other metadata (including GPS). Files get random UUID names. If anything
 * fails, files already written are removed and no rows are inserted.
 */
export async function uploadPhotos(
  projectId: string,
  files: UploadedImage[],
  rawMeta: unknown,
  user: UserPayload,
): Promise<PhotoDto[]> {
  const project = projectsRepo.find(projectId);
  if (!project) throw notFound('Project');
  if (files.length === 0) throw badRequest('Please attach at least one photograph in the "photos" field.');

  // Check every file before writing anything, so a bad file rejects the batch.
  for (const file of files) {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw badRequest(`"${file.originalname}" is not a JPEG, PNG or WebP image.`);
    }
  }

  const meta = parsePhotoMeta(rawMeta, files.length);
  const written: string[] = [];
  const discardWritten = () => written.forEach((f) => removeUploadFile(`/uploads/${f}`));
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
    discardWritten();
    logger.warn({ err }, '[Photos] Image processing failed');
    throw badRequest('One of the images could not be read. Please check the files and try again.');
  }

  const uploaderName = user.name;
  const uploaderRole = user.title || user.role;
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  try {
    return db.transaction(() => {
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
        const row: PhotoRow = {
          id: p.id,
          project_id: projectId,
          url: p.url,
          thumbnail_url: p.thumbnailUrl,
          caption: p.meta.caption || 'Site progress photograph',
          stage: p.meta.stage || null,
          category: p.meta.category || 'Progress',
          taken_date: p.meta.takenDate || today,
          uploaded_by: uploaderName,
          role: uploaderRole,
          file_size: p.size,
          created_at: nowIso,
        };
        photosRepo.insert(row);
        return toPhotoDto(row);
      });
    })();
  } catch (err) {
    discardWritten();
    throw err;
  }
}

/** Deletes the row; returns it so the caller can remove the files after commit. */
export function deletePhoto(projectId: string, photoId: string): PhotoRow {
  const photo = photosRepo.findInProject(projectId, photoId);
  if (!photo) throw notFound('Photograph');
  photosRepo.delete(photoId);
  return photo;
}
