import { db } from '../db/database.js';
import type { Page } from '../utils/paging.js';

export type EmailStatus = 'queued' | 'sent' | 'failed' | 'outbox';

export type EmailLogRow = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  reply_to: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string;
  template_type: string;
  project_id: string | null;
  status: EmailStatus;
  html_content: string | null;
  error: string | null;
  created_at: string;
};

export type EmailJob = {
  attempts: number;
  max_attempts: number;
  recipient_email: string;
  recipient_name: string | null;
  reply_to: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string;
  html_content: string;
};

/** The `email_logs` outbox and the `email_queue` delivery jobs that point at it. */
export const emailRepo = {
  countLogs(projectId: string | undefined): number {
    const row = (
      projectId
        ? db.prepare('SELECT COUNT(*) AS n FROM email_logs WHERE project_id = ?').get(projectId)
        : db.prepare('SELECT COUNT(*) AS n FROM email_logs').get()
    ) as { n: number };
    return row.n;
  },
  listLogs(projectId: string | undefined, { limit, offset }: Page): EmailLogRow[] {
    return (
      projectId
        ? db
            .prepare('SELECT * FROM email_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
            .all(projectId, limit, offset)
        : db.prepare('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
    ) as EmailLogRow[];
  },
  findLogStatus(id: string): EmailStatus | undefined {
    const row = db.prepare('SELECT status FROM email_logs WHERE id = ?').get(id) as { status: EmailStatus } | undefined;
    return row?.status;
  },
  /** Logs a new email as queued and schedules its first delivery attempt. */
  enqueue(
    log: Pick<
      EmailLogRow,
      | 'id'
      | 'recipient_email'
      | 'recipient_name'
      | 'reply_to'
      | 'from_email'
      | 'from_name'
      | 'subject'
      | 'template_type'
      | 'project_id'
    > & { html_content: string },
    maxAttempts: number,
    nextAttemptAt: string,
  ): void {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO email_logs (
           id, recipient_email, recipient_name, reply_to, from_email, from_name, subject, template_type, project_id,
           status, html_content, created_at
         ) VALUES (
           @id, @recipient_email, @recipient_name, @reply_to, @from_email, @from_name, @subject, @template_type,
           @project_id, 'queued', @html_content, datetime('now')
         )`,
      ).run(log);
      db.prepare('INSERT INTO email_queue (log_id, max_attempts, next_attempt_at) VALUES (?, ?, ?)').run(
        log.id,
        maxAttempts,
        nextAttemptAt,
      );
    })();
  },
  /** Puts an existing log entry back on the queue. */
  requeue(id: string, maxAttempts: number, nextAttemptAt: string): void {
    db.transaction(() => {
      db.prepare("UPDATE email_logs SET status = 'queued', error = NULL WHERE id = ?").run(id);
      db.prepare('INSERT OR REPLACE INTO email_queue (log_id, max_attempts, next_attempt_at) VALUES (?, ?, ?)').run(
        id,
        maxAttempts,
        nextAttemptAt,
      );
    })();
  },
  findJob(logId: string): EmailJob | undefined {
    return db
      .prepare(
        `SELECT q.attempts, q.max_attempts, l.recipient_email, l.recipient_name, l.reply_to, l.from_email, l.from_name, l.subject,
                l.html_content
         FROM email_queue q JOIN email_logs l ON l.id = q.log_id
         WHERE q.log_id = ?`,
      )
      .get(logId) as EmailJob | undefined;
  },
  lockJob(logId: string, until: string): void {
    db.prepare('UPDATE email_queue SET locked_until = ? WHERE log_id = ?').run(until, logId);
  },
  /** Records the final outcome and removes the job. */
  finishJob(logId: string, status: Exclude<EmailStatus, 'queued'>, error: string | null): void {
    db.transaction(() => {
      db.prepare('UPDATE email_logs SET status = ?, error = ? WHERE id = ?').run(status, error, logId);
      db.prepare('DELETE FROM email_queue WHERE log_id = ?').run(logId);
    })();
  },
  scheduleRetry(logId: string, attempts: number, retryAt: string, error: string): void {
    db.transaction(() => {
      db.prepare(
        'UPDATE email_queue SET attempts = ?, next_attempt_at = ?, locked_until = NULL, last_error = ? WHERE log_id = ?',
      ).run(attempts, retryAt, error, logId);
      db.prepare('UPDATE email_logs SET error = ? WHERE id = ?').run(
        `Attempt ${attempts} failed, retrying: ${error}`,
        logId,
      );
    })();
  },
  dueJobIds(nowIso: string, limit: number): string[] {
    const rows = db
      .prepare(
        `SELECT log_id FROM email_queue
         WHERE next_attempt_at <= ? AND (locked_until IS NULL OR locked_until < ?)
         ORDER BY next_attempt_at
         LIMIT ?`,
      )
      .all(nowIso, nowIso, limit) as { log_id: string }[];
    return rows.map((r) => r.log_id);
  },
  /** Releases every lock, e.g. after a restart interrupted delivery. */
  unlockAll(): void {
    db.prepare('UPDATE email_queue SET locked_until = NULL').run();
  },
};
