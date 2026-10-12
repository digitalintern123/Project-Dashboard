import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { auditRepo } from '../repositories/audit.repo.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';

/** Columns never written to the audit log. */
const REDACTED_COLUMNS = new Set(['password_hash', 'token_hash', 'html_content']);

const AUDITED_TABLES = new Set(['projects', 'phases', 'milestones', 'issues', 'updates', 'photos', 'users']);

/** Current row of an audited table, without sensitive columns, or null. */
export function rowSnapshot(table: string, id: string | undefined | null): Record<string, unknown> | null {
  if (!id || !AUDITED_TABLES.has(table)) return null;
  const row = auditRepo.findRow(table, id);
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).filter(([k]) => !REDACTED_COLUMNS.has(k)));
}

export type AuditEntry = {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

export function writeAudit(entry: AuditEntry): void {
  try {
    auditRepo.insert({
      id: crypto.randomUUID(),
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before_json: entry.before == null ? null : JSON.stringify(entry.before),
      after_json: entry.after == null ? null : JSON.stringify(entry.after),
      ip: entry.ip ?? null,
    });
  } catch (err) {
    // Auditing must never break the request it describes.
    logger.error({ err }, '[Audit] Failed to write audit entry');
  }
}

type AuditSpec = {
  action: 'create' | 'update' | 'delete' | string;
  entityType: string;
  /** Table to snapshot before and after the change. */
  table?: string;
  /** Id of the affected row, read from the request (e.g. a route param). */
  id?: (req: Request) => string | undefined;
  /** Extra details to record when there is no row to snapshot. */
  details?: (req: Request) => unknown;
};

/**
 * Records a successful mutation in the audit log. Snapshots the row before the
 * handler runs and again just before the success response is sent. Handlers
 * that create a row set res.locals.auditEntityId to the new id.
 */
export function audited(spec: AuditSpec) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const initialId = spec.id?.(req);
    const before = spec.table ? rowSnapshot(spec.table, initialId) : null;

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode < 400) {
        const entityId = (res.locals.auditEntityId as string | undefined) ?? initialId ?? null;
        const after =
          spec.action === 'delete'
            ? null
            : (res.locals.auditAfter ??
              (spec.table ? rowSnapshot(spec.table, entityId) : (spec.details?.(req) ?? null)));
        writeAudit({
          userId: req.user?.id ?? null,
          action: spec.action,
          entityType: spec.entityType,
          entityId,
          before,
          after,
          ip: req.ip,
        });
      }
      return originalJson(body);
    };
    next();
  };
}
