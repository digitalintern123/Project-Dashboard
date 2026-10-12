import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { setupTestDb, insertProject } from './helpers.js';
import { db } from '../src/db/database.js';
import {
  SNAPSHOT_FILE_PATH,
  autoRestoreSnapshotIfEmpty,
  exportPortfolioProjects,
  getFullProjectRecord,
  restoreDatabaseFromJSON,
  saveDatabaseSnapshot,
} from '../src/utils/backup.js';
import { calculateProjectStatus } from '../src/utils/status.js';

setupTestDb();

const count = () => (db.prepare('SELECT COUNT(*) c FROM projects').get() as { c: number }).c;

describe('status utility', () => {
  it('keeps the manual status and defaults to Yet to start', () => {
    expect(calculateProjectStatus(100, [], 'In Tendering')).toBe('In Tendering');
    expect(calculateProjectStatus(50)).toBe('Yet to start');
  });
});

describe('snapshots', () => {
  it('writes the whole portfolio to the snapshot file', () => {
    insertProject('bk-1', 'u-lead-a');
    db.prepare(
      "INSERT INTO milestones (id, project_id, title, date, status, tagged_users) VALUES ('bk-m', 'bk-1', 'M', '2026-01-01', 'upcoming', 'u1, u2')",
    ).run();
    saveDatabaseSnapshot();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE_PATH, 'utf-8'));
    expect(path.dirname(SNAPSHOT_FILE_PATH)).toBe(process.env.DATA_DIR);
    expect(snap.projectCount).toBe(1);
    expect(snap.projects[0].milestones[0].title).toBe('M');
  });

  it('builds a full project record and returns null for unknown ids', () => {
    expect(getFullProjectRecord('bk-1')!.phases).toHaveLength(1);
    expect(getFullProjectRecord('nope')).toBeNull();
  });

  it('batch export matches the per-project record, ordered by name', () => {
    insertProject('bk-0', 'u-lead-a');
    db.prepare("UPDATE projects SET name = 'AAA first' WHERE id = 'bk-0'").run();
    const all = exportPortfolioProjects();
    expect(all.map((p) => p.id)).toEqual(['bk-0', 'bk-1']);
    expect(all[1]).toEqual(getFullProjectRecord('bk-1'));
    db.prepare("DELETE FROM projects WHERE id = 'bk-0'").run();
  });

  it('round-trips through restore, replacing children rather than duplicating them', () => {
    const record = getFullProjectRecord('bk-1')!;
    const result = restoreDatabaseFromJSON({ projects: [{ ...record, name: 'Restored' }] });
    expect(result.count).toBe(1);
    expect((db.prepare("SELECT name FROM projects WHERE id = 'bk-1'").get() as any).name).toBe('Restored');
    expect(db.prepare("SELECT COUNT(*) c FROM phases WHERE project_id = 'bk-1'").get()).toEqual({ c: 1 });
    expect(restoreDatabaseFromJSON({ projects: [] }).count).toBe(0);
  });

  it('auto-restores a full snapshot when the database has fewer than 68 projects', () => {
    const committed = path.resolve(__dirname, '../data/portfolio-database.json');
    fs.copyFileSync(committed, SNAPSHOT_FILE_PATH);
    expect(count()).toBeLessThan(68);
    autoRestoreSnapshotIfEmpty();
    expect(count()).toBeGreaterThanOrEqual(68);
  });

  it('does nothing when the snapshot is missing or small', () => {
    db.prepare('DELETE FROM projects').run();
    fs.writeFileSync(SNAPSHOT_FILE_PATH, JSON.stringify({ projects: [] }));
    autoRestoreSnapshotIfEmpty();
    expect(count()).toBe(0);
    fs.rmSync(SNAPSHOT_FILE_PATH);
    autoRestoreSnapshotIfEmpty();
    expect(count()).toBe(0);
  });
});
