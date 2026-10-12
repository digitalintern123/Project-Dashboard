import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, uploadsDir } from '../db/database.js';
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { broadcastNotification } from '../utils/notify.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { fetchFullProject } from './projects.js';

export const projectPhotosRouter = Router({ mergeParams: true });
export const globalPhotosRouter = Router();

const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function getExtension(fileName?: string, dataUri?: string): string {
  if (dataUri) {
    const match = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    if (match && match[1]) {
      const mime = match[1].toLowerCase();
      if (mime === 'jpeg' || mime === 'jpg') return 'jpg';
      if (mime === 'png') return 'png';
      if (mime === 'webp') return 'webp';
      if (mime === 'gif') return 'gif';
    }
  }
  if (fileName) {
    const ext = path.extname(fileName).replace('.', '').toLowerCase();
    if (ext && ALLOWED_IMAGE_EXTENSIONS.has(ext)) return ext;
  }
  return 'jpg';
}

function processSinglePhoto(projectId: string, photoInput: any, user: any) {
  const { fileData, fileName, url, caption, stage, category, takenDate } = photoInput;
  if (!fileData && !url) {
    throw new Error('Please provide either an image file or an image URL.');
  }

  let finalUrl = '';
  let fileSize = 0;

  if (fileData) {
    const ext = getExtension(fileName, fileData);
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported image format '.${ext}'. Only JPG, PNG, WEBP, and GIF images are permitted.`);
    }

    const cleanBase64 = fileData.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    fileSize = buffer.length;

    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safeExt = ext === 'jpeg' ? 'jpg' : ext;
    const safeProjectId = (projectId || 'project').replace(/[^a-zA-Z0-9-_]/g, '');
    const newFileName = `${safeProjectId}_${Date.now()}_${randomSuffix}.${safeExt}`;
    const destinationPath = path.join(uploadsDir, newFileName);

    fs.writeFileSync(destinationPath, buffer);
    finalUrl = `/uploads/${newFileName}`;
  } else if (url) {
    finalUrl = url.trim();
  }

  const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const uploaderName = user?.name || 'Project Team';
  const uploaderRole = user?.title || user?.role || 'Lead';
  const nowIso = new Date().toISOString();
  const effectiveTakenDate = takenDate || nowIso.split('T')[0];
  const effectiveCategory = category || 'Progress';
  const effectiveCaption = (caption || 'Site progress photograph').trim();

  db.prepare(`
    INSERT INTO photos (
      id, project_id, url, caption, stage, category, taken_date, uploaded_by, role, file_size, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    photoId,
    projectId,
    finalUrl,
    effectiveCaption,
    stage || null,
    effectiveCategory,
    effectiveTakenDate,
    uploaderName,
    uploaderRole,
    fileSize || null,
    nowIso
  );

  return {
    id: photoId,
    projectId,
    url: finalUrl,
    caption: effectiveCaption,
    stage: stage || null,
    category: effectiveCategory,
    takenDate: effectiveTakenDate,
    uploadedBy: uploaderName,
    role: uploaderRole,
    fileSize,
    createdAt: nowIso,
  };
}

/**
 * Upload one or multiple site photographs for a project.
 * Supports:
 * 1. Single photo: { fileData, fileName, url, caption, stage, category, takenDate }
 * 2. Batch photos: { photos: [{ fileData, fileName, url, caption, stage, category, takenDate }] }
 */
async function handlePhotoUpload(req: AuthenticatedRequest, res: any) {
  try {
    const projectId = req.params.id as string;
    const project = db.prepare('SELECT id, name, code FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) {
      return res.status(404).json({ error: `Project not found with id: ${projectId}` });
    }

    // Role check: HOD cannot upload
    if (req.user && req.user.role === 'hod') {
      return res.status(403).json({ error: 'Project HOD has view-only permissions.' });
    }

    const itemsToProcess: any[] = [];
    if (Array.isArray(req.body.photos) && req.body.photos.length > 0) {
      itemsToProcess.push(...req.body.photos);
    } else if (req.body.fileData || req.body.url) {
      itemsToProcess.push(req.body);
    } else {
      return res.status(400).json({ error: 'Please provide at least one image file or URL to upload.' });
    }

    const createdPhotos: any[] = [];
    for (const item of itemsToProcess) {
      const created = processSinglePhoto(projectId, item, req.user);
      createdPhotos.push(created);
    }

    // Create system notification
    const uploaderName = req.user?.name || 'Project Team';
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const notifMessage = createdPhotos.length === 1
      ? `${uploaderName} uploaded a new site photograph for ${project.name}`
      : `${uploaderName} uploaded ${createdPhotos.length} site photographs for ${project.name}`;

    broadcastNotification(
      'system',
      notifId,
      'Site Photograph Updated',
      notifMessage,
      projectId,
      `/project/${projectId}`
    );

    // Save snapshot
    saveDatabaseSnapshot();

    const fullProject = fetchFullProject(projectId);

    res.status(201).json({
      message: `Successfully uploaded ${createdPhotos.length} site photograph${createdPhotos.length > 1 ? 's' : ''}`,
      photos: createdPhotos,
      photo: createdPhotos[0],
      project: fullProject,
    });
  } catch (err: any) {
    console.error('[Upload Photo Error]', err);
    res.status(500).json({ error: 'Failed to upload photographs', message: err.message });
  }
}

// Base64 photo uploads need a larger body than the global 1 MB limit.
const photoJson = express.json({ limit: '50mb' });
projectPhotosRouter.post('/', requireAuth, requireProjectAccess(), photoJson, handlePhotoUpload);
projectPhotosRouter.post('/batch', requireAuth, requireProjectAccess(), photoJson, handlePhotoUpload);

/**
 * Delete a specific site photograph
 */
projectPhotosRouter.delete('/:photoId', requireAuth, requireProjectAccess(), async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.params.id as string;
    const photoId = req.params.photoId as string;

    if (req.user && req.user.role === 'hod') {
      return res.status(403).json({ error: 'Project HOD has view-only permissions.' });
    }

    const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND project_id = ?').get(photoId, projectId) as any;
    if (!photo) {
      return res.status(404).json({ error: 'Photograph not found' });
    }

    // Delete disk file if stored locally
    if (photo.url && typeof photo.url === 'string' && photo.url.startsWith('/uploads/')) {
      const fileName = path.basename(photo.url);
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[Photo Delete] Deleted file: ${filePath}`);
        } catch (e) {
          console.warn(`[Photo Delete] Could not unlink ${filePath}:`, e);
        }
      }
    }

    db.prepare('DELETE FROM photos WHERE id = ?').run(photoId);
    saveDatabaseSnapshot();

    const fullProject = fetchFullProject(projectId);
    res.json({ message: 'Photograph deleted successfully', project: fullProject });
  } catch (err: any) {
    console.error('[Delete Photo Error]', err);
    res.status(500).json({ error: 'Failed to delete photograph', message: err.message });
  }
});

/**
 * Get all photos for a project
 */
projectPhotosRouter.get('/', requireAuth, (req, res) => {
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
