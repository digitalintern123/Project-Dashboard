import { randomUUID } from 'node:crypto';
import { db } from '../db/database.js';
import type { UserPayload } from '../middleware/auth.js';
import { notificationsRepo } from '../repositories/notifications.repo.js';
import { updatesRepo } from '../repositories/updates.repo.js';
import { usersRepo } from '../repositories/users.repo.js';
import { badRequest, notFound } from '../utils/http-error.js';
import {
  buildProjectSummaryHtml,
  buildTagNotificationHtml,
  queueEmail,
  searchEncalmDirectory,
  type QueueResult,
} from './email.js';
import { getProject } from './projects.service.js';

/** Who is sending, and the public URL that links in the email point at. */
export type Sender = { user: UserPayload; origin: string };

type Recipient = string | { email: string; name?: string };

/**
 * Emails a project summary to stakeholders. The sender is always the signed-in
 * user, and replies go to them.
 */
export function sendProjectUpdate(
  projectId: string,
  recipients: Recipient[],
  customNote: string | undefined,
  { user, origin }: Sender,
): Array<{ recipient: string } & QueueResult> {
  const project = getProject(projectId);
  if (!project) throw notFound('Project');

  const targets = recipients.map((r) =>
    typeof r === 'string'
      ? { email: r.trim(), name: r.split('@')[0] }
      : { email: r.email.trim(), name: r.name || r.email },
  );
  if (targets.length === 0) throw badRequest('No valid recipient email addresses provided.');

  const dashboardUrl = `${origin}/project/${projectId}`;
  return db.transaction(() =>
    targets.map((rc) => ({
      recipient: rc.email,
      ...queueEmail({
        to: rc.email,
        recipientName: rc.name,
        sender: { email: user.email, name: user.name },
        replyTo: user.email,
        subject: `Project Update: ${project.name} (${project.progress}% Complete)`,
        html: buildProjectSummaryHtml({
          recipientName: rc.name,
          projectName: project.name,
          senderName: user.name,
          progress: project.progress,
          health: project.health,
          status: project.status,
          customNote,
          dashboardUrl,
        }),
        templateType: 'project_summary',
        projectId,
      }),
    })),
  )();
}

type TaggableEntity = Parameters<typeof buildTagNotificationHtml>[0]['entityType'];

export type TagRequest = {
  projectId: string;
  entityType?: TaggableEntity;
  entityTitle?: string;
  entityContext?: string;
  taggedUserIds?: string[];
  comment?: string;
};

export type TagResult = {
  userId: string;
  userName: string;
  email: string;
  status: string;
  id?: string;
  error?: string;
};

type Person = { id: string; name: string; email: string | null };

/** Finds a tagged person locally, or in the Microsoft directory for `azure-` ids. */
async function findPerson(userId: string): Promise<Person | undefined> {
  const local = usersRepo.find(userId);
  if (local) return { id: local.id, name: local.name, email: local.email };
  if (!userId.startsWith('azure-')) return undefined;
  // The directory search also saves the people it finds as local users.
  const match = (await searchEncalmDirectory()).find((u) => u.id === userId);
  return match && { id: match.id, name: match.name, email: match.email };
}

/**
 * Tags people on a project item: each gets an in-app notification and an
 * email sent as the signed-in user, and the comment (if any) is added to the
 * project's update feed. Only the people picked in `taggedUserIds` are
 * emailed: @names in the comment are never re-read, because two people can
 * share a name.
 */
export async function tagAndComment(request: TagRequest, { user, origin }: Sender): Promise<TagResult[]> {
  const { projectId, entityType = 'Stage', entityTitle, entityContext, comment } = request;

  const userIds = new Set((request.taggedUserIds ?? []).filter(Boolean));

  const project = getProject(projectId);
  if (!project) throw notFound('Project');
  if (userIds.size === 0) throw badRequest('At least one user must be tagged or @mentioned');

  const currentStage =
    project.phases.find((p) => p.status === 'In Progress')?.name || project.status || 'Active Delivery';
  const targetDate = project.targetDate || entityContext;
  const dashboardUrl = `${origin}/project/${projectId}`;
  const itemTitle = entityTitle || 'item';
  const notifTitle = `Tagged on ${entityType}: ${entityTitle || 'Project Item'}`;
  const notifMessage = comment
    ? `${user.name} tagged you on ${entityType.toLowerCase()} "${itemTitle}" in ${project.name}: "${comment}"`
    : `${user.name} tagged you on ${entityType.toLowerCase()} "${itemTitle}" in ${project.name}`;

  // Directory lookups are async, so resolve everyone before the transaction.
  const people: Array<{ userId: string; person: Person }> = [];
  const unknown: string[] = [];
  const seenEmails = new Set<string>();
  for (const userId of userIds) {
    const person = await findPerson(userId);
    if (!person) {
      unknown.push(userId);
      continue;
    }
    // The same person can appear under two ids (local and directory): email them once.
    const key = person.email?.trim().toLowerCase();
    if (key && seenEmails.has(key)) continue;
    if (key) seenEmails.add(key);
    people.push({ userId: person.id, person });
  }
  if (unknown.length) throw badRequest(`Unknown people tagged: ${unknown.join(', ')}`);

  return db.transaction(() => {
    const results = people.map(({ userId, person }): TagResult => {
      const recipientName = person.name || userId;
      notificationsRepo.insert({
        id: `notif-tag-${randomUUID()}`,
        type: 'tagged_task',
        title: notifTitle,
        message: notifMessage,
        project_id: projectId,
        link: `/project/${projectId}`,
        recipient_id: userId,
      });

      if (!person.email) {
        return {
          userId,
          userName: recipientName,
          email: 'no-email-found',
          status: 'skipped',
          error: 'User has no registered email',
        };
      }

      const queued = queueEmail({
        to: person.email,
        recipientName,
        sender: { email: user.email, name: user.name },
        replyTo: user.email,
        subject: `[Encalm - ${project.code || 'ACTION'}] Action Required: ${entityTitle || project.name}`,
        html: buildTagNotificationHtml({
          recipientName,
          taggedByName: user.name,
          senderEmail: user.email,
          entityType,
          entityTitle: entityTitle || `${entityType} in ${project.name}`,
          entityContext,
          comment,
          projectName: project.name,
          projectCode: project.code,
          projectLocation: project.location,
          currentStage,
          targetDate,
          dashboardUrl,
        }),
        templateType: 'tag_notification',
        projectId,
      });
      return { userId, userName: recipientName, email: person.email, ...queued };
    });

    // Keep the conversation in the project's update feed.
    if (comment?.trim()) {
      updatesRepo.insert({
        id: `upd-${randomUUID()}`,
        project_id: projectId,
        date: new Date().toISOString().slice(0, 10),
        author: user.name,
        role: user.title || 'Team Member',
        stage: entityTitle || entityType,
        kind: 'Progress',
        text: `[Tagged ${results.map((r) => r.userName).join(', ')}]: ${comment.trim()}`,
      });
    }
    return results;
  })();
}
