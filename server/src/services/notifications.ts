import { randomUUID } from 'node:crypto';
import { db } from '../db/database.js';
import {
  queueEmail,
  buildTagNotificationHtml,
  buildCriticalIssueHtml,
  buildMilestoneApprovalHtml,
  type EmailSender,
} from './email.js';

interface TagNotificationParams {
  taggedUserIds: string[];
  taggedBy: string;
  entityType: 'Task' | 'Stage' | 'Milestone' | 'Issue' | 'Update' | 'General';
  entityTitle: string;
  entityContext?: string;
  comment?: string;
  projectId: string;
  projectName: string;
  origin?: string;
  /** The signed-in user who made the change; emails are sent as them. */
  sender?: EmailSender;
}

/**
 * Persists in-app notifications and queues emails to tagged users. Synchronous,
 * so callers can run it inside the same transaction as the change it reports.
 */
export function dispatchTagNotifications(params: TagNotificationParams): void {
  const {
    taggedUserIds,
    taggedBy,
    entityType,
    entityTitle,
    entityContext,
    comment,
    projectId,
    projectName,
    origin = 'http://localhost:5173',
    sender,
  } = params;

  const dashboardUrl = `${origin}/project/${projectId}`;
  const notifType = entityType === 'Issue' ? 'tagged_issue' : 'tagged_task';

  for (const userId of taggedUserIds) {
    if (!userId) continue;

    // Lookup user details from DB
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as
      { id: string; name: string; email: string } | undefined;

    // Someone who is not a user (a stale or made-up id) gets nothing.
    if (!user) continue;
    const recipientName = user.name || userId;
    const recipientEmail = user.email;

    // 1. Insert in-app notification with recipient_id
    const messageBody = comment
      ? `${taggedBy} tagged you on ${entityType.toLowerCase()} "${entityTitle}" in ${projectName}: "${comment}"`
      : `${taggedBy} tagged you on ${entityType.toLowerCase()} "${entityTitle}" in ${projectName}`;

    db.prepare(
      `
      INSERT INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `,
    ).run(
      `notif-tag-${randomUUID()}`,
      notifType,
      `Tagged on ${entityType}: ${entityTitle}`,
      messageBody,
      projectId,
      `/project/${projectId}`,
      userId,
    );

    // 2. Dispatch email (falls back to outbox if SMTP not configured)
    if (recipientEmail) {
      const html = buildTagNotificationHtml({
        recipientName,
        taggedByName: taggedBy,
        senderEmail: sender?.email,
        entityType,
        entityTitle,
        entityContext,
        comment,
        projectName,
        dashboardUrl,
      });

      queueEmail({
        to: recipientEmail,
        recipientName,
        sender,
        replyTo: sender?.email,
        subject: `Tagged on ${entityType}: ${entityTitle} (${projectName})`,
        html,
        templateType: 'tag_notification',
        projectId,
      });
    }
  }
}

interface CriticalIssueAlertParams {
  issueTitle: string;
  severity: string;
  category?: string;
  detail: string;
  raisedBy: string;
  projectId: string;
  projectName: string;
  origin?: string;
  /** The signed-in user who made the change; emails are sent as them. */
  sender?: EmailSender;
}

/**
 * Dispatches critical issue alert to HOD & Project Coordinators
 */
export function dispatchCriticalIssueAlert(params: CriticalIssueAlertParams): void {
  const {
    issueTitle,
    severity,
    category,
    detail,
    raisedBy,
    projectId,
    projectName,
    origin = 'http://localhost:5173',
    sender,
  } = params;
  const dashboardUrl = `${origin}/project/${projectId}`;

  const leaders = db.prepare("SELECT id, name, email, role FROM users WHERE role IN ('hod', 'coordinator')").all() as {
    id: string;
    name: string;
    email: string;
    role: string;
  }[];

  for (const leader of leaders) {
    if (!leader.email) continue;
    const html = buildCriticalIssueHtml({
      recipientName: leader.name,
      issueTitle,
      severity,
      category,
      detail,
      raisedBy,
      projectName,
      dashboardUrl,
    });

    queueEmail({
      to: leader.email,
      recipientName: leader.name,
      sender,
      replyTo: sender?.email,
      subject: `🚨 CRITICAL ISSUE: ${issueTitle} (${projectName})`,
      html,
      templateType: 'critical_issue',
      projectId,
    });
  }
}

interface MilestoneApprovalAlertParams {
  milestoneTitle: string;
  targetDate: string;
  stage?: string;
  requestedBy: string;
  projectId: string;
  projectName: string;
  origin?: string;
  /** The signed-in user who made the change; emails are sent as them. */
  sender?: EmailSender;
}

/**
 * Dispatches milestone approval alert to Project Coordinator
 */
export function dispatchMilestoneApprovalAlert(params: MilestoneApprovalAlertParams): void {
  const {
    milestoneTitle,
    targetDate,
    stage,
    projectId,
    projectName,
    origin = 'http://localhost:5173',
    sender,
  } = params;
  const dashboardUrl = `${origin}/project/${projectId}`;

  const coordinators = db.prepare("SELECT id, name, email FROM users WHERE role = 'coordinator'").all() as {
    id: string;
    name: string;
    email: string;
  }[];

  for (const coord of coordinators) {
    if (!coord.email) continue;
    const html = buildMilestoneApprovalHtml({
      recipientName: coord.name,
      milestoneTitle,
      targetDate,
      stage,
      projectName,
      dashboardUrl,
    });

    queueEmail({
      to: coord.email,
      recipientName: coord.name,
      sender,
      replyTo: sender?.email,
      subject: `Milestone Approval Required: ${milestoneTitle} (${projectName})`,
      html,
      templateType: 'milestone_approval',
      projectId,
    });
  }
}
