import { randomUUID } from 'node:crypto';
import { emailRepo } from '../../repositories/email.repo.js';
import { EmailNotConfiguredError, deliver } from './transport.js';
import type { QueueResult, SendEmailOptions } from './types.js';
import { logger } from '../../logger.js';

/** Attempts per email before it is marked failed. */
export const EMAIL_MAX_ATTEMPTS = 5;
/** First retry delay; doubles each attempt (30s, 1m, 2m, 4m). */
export const EMAIL_RETRY_BASE_MS = 30_000;
/** How long a worker may hold an email before another worker may retry it. */
const EMAIL_LOCK_MS = 2 * 60_000;

let workerTimer: NodeJS.Timeout | null = null;
let processing: Promise<number> | null = null;

const errorMessage = (err: unknown) => (err instanceof Error && err.message) || 'Delivery failed';

/** Asks a running worker to look at the queue now instead of on its next tick. */
function kickWorker() {
  if (workerTimer) setImmediate(() => void processEmailQueue().catch((err) => logger.error({ err }, '[Email Queue]')));
}

/**
 * Queues an email for delivery and returns immediately. The message is logged
 * as 'queued' and delivered by the background worker, with retries.
 * Synchronous, so it can run inside a database transaction.
 */
export function queueEmail(options: SendEmailOptions, maxAttempts = EMAIL_MAX_ATTEMPTS): QueueResult {
  const id = `eml-${randomUUID()}`;
  emailRepo.enqueue(
    {
      id,
      recipient_email: options.to,
      recipient_name: options.recipientName || null,
      reply_to: options.replyTo || null,
      from_email: options.sender?.email || null,
      from_name: options.sender?.name || null,
      subject: options.subject,
      template_type: options.templateType,
      project_id: options.projectId || null,
      html_content: options.html,
    },
    maxAttempts,
    new Date().toISOString(),
  );
  kickWorker();
  return { id, status: 'queued' };
}

/** Delivers one queued email now and records the outcome. */
export async function deliverQueuedEmail(logId: string, now = Date.now()): Promise<QueueResult> {
  const job = emailRepo.findJob(logId);
  if (!job) return { id: logId, status: 'failed', error: 'Not queued' };

  emailRepo.lockJob(logId, new Date(now + EMAIL_LOCK_MS).toISOString());

  try {
    await deliver({
      to: job.recipient_email,
      recipientName: job.recipient_name,
      replyTo: job.reply_to,
      sender: job.from_email ? { email: job.from_email, name: job.from_name || job.from_email } : null,
      subject: job.subject,
      html: job.html_content,
    });
    emailRepo.finishJob(logId, 'sent', null);
    logger.info(`[Email] Delivered "${job.subject}" to ${job.recipient_email}`);
    return { id: logId, status: 'sent' };
  } catch (err) {
    const message = errorMessage(err);
    if (err instanceof EmailNotConfiguredError) {
      emailRepo.finishJob(logId, 'outbox', message);
      return { id: logId, status: 'outbox', error: message };
    }
    const attempts = job.attempts + 1;
    if (attempts >= job.max_attempts) {
      emailRepo.finishJob(logId, 'failed', message);
      logger.warn(
        `[Email] Giving up on "${job.subject}" to ${job.recipient_email} after ${attempts} attempt(s): ${message}`,
      );
      return { id: logId, status: 'failed', error: message };
    }
    const retryAt = new Date(now + EMAIL_RETRY_BASE_MS * 2 ** (attempts - 1)).toISOString();
    emailRepo.scheduleRetry(logId, attempts, retryAt, message);
    logger.warn(`[Email] Attempt ${attempts} for ${job.recipient_email} failed (${message}); retrying at ${retryAt}`);
    return { id: logId, status: 'queued', error: message };
  }
}

/** Delivers every email that is due. Returns how many were processed. */
export function processEmailQueue(now = Date.now()): Promise<number> {
  if (processing) return processing;
  processing = (async () => {
    const due = emailRepo.dueJobIds(new Date(now).toISOString(), 25);
    for (const logId of due) await deliverQueuedEmail(logId, now);
    return due.length;
  })().finally(() => {
    processing = null;
  });
  return processing;
}

/** Starts the background delivery worker. Emails interrupted by a restart are retried. */
export function startEmailWorker(intervalMs = 5000): void {
  if (workerTimer) return;
  emailRepo.unlockAll();
  workerTimer = setInterval(
    () => void processEmailQueue().catch((err) => logger.error({ err }, '[Email Queue]')),
    intervalMs,
  );
  workerTimer.unref();
  kickWorker();
}

export function stopEmailWorker(): void {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}

/**
 * Sends one email immediately (no retries) and reports the result. Only for
 * the settings "send test email" button, where the user waits for the answer.
 */
export async function sendEmailNow(options: SendEmailOptions): Promise<QueueResult> {
  const { id } = queueEmail(options, 1);
  return deliverQueuedEmail(id);
}

/** Puts a logged email back on the queue (e.g. after fixing SMTP settings). */
export function resendEmailLog(id: string): { success: boolean; status: string; error?: string } {
  const status = emailRepo.findLogStatus(id);
  if (!status) return { success: false, status: 'not_found', error: 'Email record not found' };
  if (status === 'queued') return { success: true, status: 'queued' };
  emailRepo.requeue(id, EMAIL_MAX_ATTEMPTS, new Date().toISOString());
  kickWorker();
  return { success: true, status: 'queued' };
}
