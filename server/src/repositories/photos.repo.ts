import { db } from '../db/database.js';
import type { PhotoRow } from './rows.js';

export type PortfolioPhoto = {
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
  projectName: string;
  projectCode: string;
  projectLocation: string;
  projectCategory: string;
};

export const photosRepo = {
  findInProject(projectId: string, photoId: string): PhotoRow | undefined {
    return db.prepare('SELECT * FROM photos WHERE id = ? AND project_id = ?').get(photoId, projectId) as
      PhotoRow | undefined;
  },
  listForProject(projectId: string): PhotoRow[] {
    return db
      .prepare('SELECT * FROM photos WHERE project_id = ? ORDER BY taken_date DESC, created_at DESC')
      .all(projectId) as PhotoRow[];
  },
  listPortfolio(): PortfolioPhoto[] {
    return db
      .prepare(
        `SELECT
           p.id,
           p.project_id AS projectId,
           p.url,
           p.thumbnail_url AS thumbnailUrl,
           p.caption,
           p.stage,
           p.category,
           p.taken_date AS takenDate,
           p.uploaded_by AS uploadedBy,
           p.role,
           p.file_size AS fileSize,
           p.created_at AS createdAt,
           pr.name AS projectName,
           pr.code AS projectCode,
           pr.location AS projectLocation,
           pr.category AS projectCategory
         FROM photos p
         JOIN projects pr ON p.project_id = pr.id
         ORDER BY p.taken_date DESC, p.created_at DESC`,
      )
      .all() as PortfolioPhoto[];
  },
  insert(row: PhotoRow): void {
    db.prepare(
      `INSERT INTO photos (
         id, project_id, url, thumbnail_url, caption, stage, category, taken_date, uploaded_by, role, file_size, created_at
       ) VALUES (
         @id, @project_id, @url, @thumbnail_url, @caption, @stage, @category, @taken_date, @uploaded_by, @role,
         @file_size, @created_at
       )`,
    ).run(row);
  },
  delete(id: string): void {
    db.prepare('DELETE FROM photos WHERE id = ?').run(id);
  },
};
