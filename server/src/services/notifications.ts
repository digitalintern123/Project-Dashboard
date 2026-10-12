import { db } from '../db/database.js';
import {
  sendEmail,
  buildTagNotificationHtml,
  buildCriticalIssueHtml,
  buildMilestoneApprovalHtml,
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
}

/**
 * Persists in-app notifications and dispatches emails to tagged users.
 */
export async function dispatchTagNotifications(params: TagNotificationParams): Promise<void> {
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
  } = params;

  const dashboardUrl = `${origin}/project/${projectId}`;
  const notifType = entityType === 'Issue' ? 'tagged_issue' : 'tagged_task';

  for (const userId of taggedUserIds) {
    if (!userId) continue;

    // Lookup user details from DB
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as
      | { id: string; name: string; email: string }
      | undefined;

    const recipientName = user?.name || userId;
    const recipientEmail = user?.email;

    // 1. Insert in-app notification with recipient_id
    try {
      const messageBody = comment 
        ? `${taggedBy} tagged you on ${entityType.toLowerCase()} "${entityTitle}" in ${projectName}: "${comment}"`
        : `${taggedBy} tagged you on ${entityType.toLowerCase()} "${entityTitle}" in ${projectName}`;

      db.prepare(`
        INSERT INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(
        `notif-tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        notifType,
        `Tagged on ${entityType}: ${entityTitle}`,
        messageBody,
        projectId,
        `/project/${projectId}`,
        userId
      );
    } catch (err) {
      console.warn('[Notification Insert Error]', err);
    }

    // 2. Dispatch email (falls back to outbox if SMTP not configured)
    if (recipientEmail) {
      const html = buildTagNotificationHtml({
        recipientName,
        taggedByName: taggedBy,
        entityType,
        entityTitle,
        entityContext,
        comment,
        projectName,
        dashboardUrl,
      });

      sendEmail({
        to: recipientEmail,
        recipientName,
        subject: `Tagged on ${entityType}: ${entityTitle} (${projectName})`,
        html,
        templateType: 'tag_notification',
        projectId,
      }).catch((e) => console.warn('[Tag Email Dispatch Error]', e));
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
}

/**
 * Dispatches critical issue alert to HOD & Project Coordinators
 */
export async function dispatchCriticalIssueAlert(params: CriticalIssueAlertParams): Promise<void> {
  const { issueTitle, severity, category, detail, raisedBy, projectId, projectName, origin = 'http://localhost:5173' } = params;
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

    sendEmail({
      to: leader.email,
      recipientName: leader.name,
      subject: `🚨 CRITICAL ISSUE: ${issueTitle} (${projectName})`,
      html,
      templateType: 'critical_issue',
      projectId,
    }).catch((e) => console.warn('[Critical Issue Email Error]', e));
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
}

/**
 * Dispatches milestone approval alert to Project Coordinator
 */
export async function dispatchMilestoneApprovalAlert(params: MilestoneApprovalAlertParams): Promise<void> {
  const { milestoneTitle, targetDate, stage, projectId, projectName, origin = 'http://localhost:5173' } = params;
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

    sendEmail({
      to: coord.email,
      recipientName: coord.name,
      subject: `Milestone Approval Required: ${milestoneTitle} (${projectName})`,
      html,
      templateType: 'milestone_approval',
      projectId,
    }).catch((e) => console.warn('[Milestone Approval Email Error]', e));
  }
}
