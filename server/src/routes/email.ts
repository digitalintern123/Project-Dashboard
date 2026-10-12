import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import {
  getActiveEmailProvider,
  saveActiveEmailProvider,
  getSmtpConfig,
  saveSmtpConfig,
  getGraphConfig,
  saveGraphConfig,
  sendEmail,
  resendEmailLog,
  buildTestEmailHtml,
  buildProjectSummaryHtml,
  buildTagNotificationHtml,
  searchEncalmDirectory,
} from '../services/email.js';
import { fetchFullProject } from './projects.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';

const router = Router();

// GET live Encalm corporate directory search via Microsoft Graph API
router.get('/directory', requireAuth, validate({ query: S.directoryQuery }), async (req, res) => {
  try {
    const query = ((req.query.q as string) || '').trim();
    const directoryUsers = await searchEncalmDirectory(query);
    return res.json({ users: directoryUsers });
  } catch (err: any) {
    console.error('[Directory Search Route Error]', err.message);
    return res.status(500).json({ error: 'Failed to search directory', users: [] });
  }
});


// GET email logs / outbox
router.get('/logs', requireAuth, requireRole(['coordinator']), validate({ query: S.emailLogsQuery }), (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const limit = Math.min(100, parseInt((req.query.limit as string) || '50', 10));

  let query = 'SELECT * FROM email_logs';
  const params: any[] = [];

  if (projectId) {
    query += ' WHERE project_id = ?';
    params.push(projectId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const logs = db.prepare(query).all(...params) as any[];

  return res.json({
    logs: logs.map((l) => ({
      id: l.id,
      recipientEmail: l.recipient_email,
      recipientName: l.recipient_name,
      subject: l.subject,
      templateType: l.template_type,
      projectId: l.project_id,
      status: l.status,
      htmlContent: l.html_content,
      error: l.error,
      createdAt: l.created_at,
    })),
  });
});

// GET email settings (supports SMTP & Microsoft Graph API with masked passwords)
router.get('/settings', requireAuth, requireRole(['coordinator']), (req, res) => {
  const provider = getActiveEmailProvider();
  const smtpConfig = getSmtpConfig();
  const graphConfig = getGraphConfig();

  const isSmtpConfigured = Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass);
  const isGraphConfigured = Boolean(graphConfig.tenantId && graphConfig.clientId && graphConfig.clientSecret && graphConfig.senderEmail);

  return res.json({
    settings: {
      provider,
      smtp: {
        host: smtpConfig.host || 'smtp-mail.outlook.com',
        port: smtpConfig.port || 587,
        secure: Boolean(smtpConfig.secure),
        user: smtpConfig.user || '',
        pass: smtpConfig.pass ? '••••••••' : '',
        fromName: smtpConfig.fromName || 'Encalm Project Dashboard',
        fromEmail: smtpConfig.fromEmail || smtpConfig.user || 'notifications@encalm.com',
        isConfigured: isSmtpConfigured,
      },
      graph: {
        tenantId: graphConfig.tenantId || '',
        clientId: graphConfig.clientId || '',
        clientSecret: graphConfig.clientSecret ? '••••••••' : '',
        senderEmail: graphConfig.senderEmail || 'notifications@encalm.com',
        saveToSentItems: graphConfig.saveToSentItems !== false,
        isConfigured: isGraphConfigured,
      },
      // Backwards-compatible convenience fields:
      tenantId: graphConfig.tenantId || '',
      clientId: graphConfig.clientId || '',
      clientSecret: graphConfig.clientSecret ? '••••••••' : '',
      senderEmail: graphConfig.senderEmail || 'notifications@encalm.com',
      saveToSentItems: graphConfig.saveToSentItems !== false,
      isConfigured: provider === 'smtp' ? isSmtpConfigured : isGraphConfigured,
    },
  });
});

// POST save email settings (SMTP and/or Microsoft Graph API)
router.post('/settings', requireAuth, requireRole(['coordinator']), validate({ body: S.emailSettingsBody }), (req: AuthenticatedRequest, res) => {
  const { provider, smtp, graph, tenantId, clientId, clientSecret, senderEmail, saveToSentItems } = req.body;

  if (provider === 'smtp' || provider === 'microsoft_graph') {
    saveActiveEmailProvider(provider);
  }

  // Save SMTP settings if provided
  if (smtp && typeof smtp === 'object') {
    saveSmtpConfig({
      host: smtp.host,
      port: smtp.port !== undefined ? Number(smtp.port) : undefined,
      secure: smtp.secure !== undefined ? Boolean(smtp.secure) : undefined,
      user: smtp.user,
      pass: smtp.pass,
      fromName: smtp.fromName,
      fromEmail: smtp.fromEmail,
    });
  }

  // Save Graph settings if provided (either in graph object or root)
  const gTenantId = graph?.tenantId ?? tenantId;
  const gClientId = graph?.clientId ?? clientId;
  const gClientSecret = graph?.clientSecret ?? clientSecret;
  const gSenderEmail = graph?.senderEmail ?? senderEmail;
  const gSaveToSent = graph?.saveToSentItems ?? saveToSentItems;

  if (gTenantId !== undefined || gClientId !== undefined || gClientSecret !== undefined || gSenderEmail !== undefined) {
    saveGraphConfig({
      tenantId: gTenantId,
      clientId: gClientId,
      clientSecret: gClientSecret,
      senderEmail: gSenderEmail,
      saveToSentItems: gSaveToSent !== undefined ? Boolean(gSaveToSent) : true,
    });
  }

  const activeProvider = getActiveEmailProvider();
  const updatedSmtp = getSmtpConfig();
  const updatedGraph = getGraphConfig();

  const isSmtpConfigured = Boolean(updatedSmtp.host && updatedSmtp.user && updatedSmtp.pass);
  const isGraphConfigured = Boolean(updatedGraph.tenantId && updatedGraph.clientId && updatedGraph.clientSecret && updatedGraph.senderEmail);

  return res.json({
    message: 'Email settings saved successfully',
    settings: {
      provider: activeProvider,
      smtp: {
        host: updatedSmtp.host || 'smtp-mail.outlook.com',
        port: updatedSmtp.port || 587,
        secure: Boolean(updatedSmtp.secure),
        user: updatedSmtp.user || '',
        pass: updatedSmtp.pass ? '••••••••' : '',
        fromName: updatedSmtp.fromName || 'Encalm Project Dashboard',
        fromEmail: updatedSmtp.fromEmail || updatedSmtp.user || 'notifications@encalm.com',
        isConfigured: isSmtpConfigured,
      },
      graph: {
        tenantId: updatedGraph.tenantId || '',
        clientId: updatedGraph.clientId || '',
        clientSecret: updatedGraph.clientSecret ? '••••••••' : '',
        senderEmail: updatedGraph.senderEmail || 'notifications@encalm.com',
        saveToSentItems: updatedGraph.saveToSentItems !== false,
        isConfigured: isGraphConfigured,
      },
      tenantId: updatedGraph.tenantId || '',
      clientId: updatedGraph.clientId || '',
      clientSecret: updatedGraph.clientSecret ? '••••••••' : '',
      senderEmail: updatedGraph.senderEmail || 'notifications@encalm.com',
      saveToSentItems: updatedGraph.saveToSentItems !== false,
      isConfigured: activeProvider === 'smtp' ? isSmtpConfigured : isGraphConfigured,
    },
  });
});

// POST send test email via active provider (SMTP or Microsoft Graph)
router.post('/test', requireAuth, requireRole(['coordinator']), validate({ body: S.emailTestBody }), async (req: AuthenticatedRequest, res) => {
  const { to, recipientName, provider: reqProvider, smtp, graph } = req.body;

  if (reqProvider === 'smtp' || reqProvider === 'microsoft_graph') {
    saveActiveEmailProvider(reqProvider);
  }

  if (smtp && typeof smtp === 'object') {
    saveSmtpConfig({
      host: smtp.host,
      port: smtp.port !== undefined ? Number(smtp.port) : undefined,
      secure: smtp.secure !== undefined ? Boolean(smtp.secure) : undefined,
      user: smtp.user,
      pass: smtp.pass,
      fromName: smtp.fromName,
      fromEmail: smtp.fromEmail,
    });
  }

  if (graph && typeof graph === 'object') {
    saveGraphConfig({
      tenantId: graph.tenantId,
      clientId: graph.clientId,
      clientSecret: graph.clientSecret,
      senderEmail: graph.senderEmail,
      saveToSentItems: graph.saveToSentItems !== undefined ? Boolean(graph.saveToSentItems) : true,
    });
  }

  const targetEmail = to || req.user?.email || 'hod@encalm.com';
  const name = recipientName || req.user?.name || 'Encalm User';
  const provider = getActiveEmailProvider();

  const html = buildTestEmailHtml(name);
  const result = await sendEmail({
    to: targetEmail,
    recipientName: name,
    subject: `Encalm Projects - ${provider === 'smtp' ? 'SMTP' : 'Microsoft Graph'} Delivery Test`,
    html,
    templateType: 'test_email',
  });

  const providerLabel = provider === 'smtp' ? 'SMTP (Outlook/Office 365)' : 'Microsoft Graph API';

  return res.json({
    success: result.status === 'sent',
    result,
    message:
      result.status === 'sent'
        ? `Test email sent successfully via ${providerLabel} to ${targetEmail}`
        : result.status === 'outbox'
          ? `${providerLabel} not configured: Email queued in dashboard Outbox`
          : `Failed to deliver email: ${result.error}`,
  });
});

// POST resend log entry
router.post('/resend/:id', requireAuth, requireRole(['coordinator']), validate({ params: S.idParams }), async (req, res) => {
  const id = req.params.id as string;
  const result = await resendEmailLog(id);
  return res.json(result);
});

// POST send executive project update to stakeholders
router.post('/send-project-update', requireAuth, validate({ body: S.sendProjectUpdateBody }), async (req: AuthenticatedRequest, res) => {
  const { projectId, recipients, customNote } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  if (!req.user || !req.user.email) {
    return res.status(401).json({ error: 'Unauthorized: Valid authenticated session is required to dispatch project updates' });
  }

  const project = fetchFullProject(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Anti-Spoofing: Bind sender strictly to authenticated session
  const senderName = req.user.name;
  const senderEmail = req.user.email;
  const targetRecipients: { email: string; name: string }[] = [];

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Please select at least one recipient using @mention to dispatch the update.' });
  }

  recipients.forEach((r: any) => {
    if (typeof r === 'string' && r.includes('@')) {
      targetRecipients.push({ email: r.trim(), name: r.split('@')[0] });
    } else if (r && typeof r === 'object' && r.email) {
      targetRecipients.push({ email: r.email.trim(), name: r.name || r.email });
    }
  });

  if (targetRecipients.length === 0) {
    return res.status(400).json({ error: 'No valid recipient email addresses provided.' });
  }

  const origin = publicBaseUrl(req);
  const dashboardUrl = `${origin}/project/${projectId}`;

  const dispatchResults: any[] = [];
  for (const rc of targetRecipients) {
    const html = buildProjectSummaryHtml({
      recipientName: rc.name,
      projectName: project.name,
      senderName,
      progress: project.progress,
      health: project.health,
      status: project.status,
      customNote,
      dashboardUrl,
    });

    const result = await sendEmail({
      to: rc.email,
      recipientName: rc.name,
      replyTo: senderEmail,
      subject: `Project Update: ${project.name} (${project.progress}% Complete)`,
      html,
      templateType: 'project_summary',
      projectId,
    });

    dispatchResults.push({ recipient: rc.email, ...result });
  }

  return res.json({
    success: true,
    message: `Dispatched project summary to ${dispatchResults.length} recipient(s)`,
    results: dispatchResults,
  });
});

// POST tag team member(s) with comment & dispatch automated email
router.post('/tag-and-comment', requireAuth, validate({ body: S.tagAndCommentBody }), async (req: AuthenticatedRequest, res) => {
  const {
    projectId,
    entityType = 'Stage',
    entityId,
    entityTitle,
    entityContext,
    taggedUserIds = [],
    comment,
  } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  // Security check: Verify authenticated user
  if (!req.user || !req.user.email) {
    return res.status(401).json({ error: 'Unauthorized: Valid authenticated session is required to tag members and send email' });
  }

  // Auto-discover any @mentions directly written in the comment text
  const combinedUserIds = new Set<string>(Array.isArray(taggedUserIds) ? taggedUserIds.filter(Boolean) : []);

  if (comment && typeof comment === 'string') {
    const allUsers = db.prepare('SELECT id, name, email FROM users').all() as Array<{ id: string; name: string; email: string }>;
    
    // Sort users by full name length descending so longer full names match first
    const sortedUsers = [...allUsers].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));

    // Count first name occurrences across all users to guard against ambiguous first names (e.g. 7 users named Akash)
    const firstNameCounts = new Map<string, number>();
    for (const u of allUsers) {
      if (!u.name) continue;
      const fn = u.name.toLowerCase().trim().split(' ')[0];
      if (fn) {
        firstNameCounts.set(fn, (firstNameCounts.get(fn) || 0) + 1);
      }
    }

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let remainingComment = comment;

    // 1. Exact Full Name Matching (e.g. "@Akash Deep")
    for (const u of sortedUsers) {
      if (!u.name) continue;
      const fullName = u.name.trim();
      const fnRegex = new RegExp(`@${escapeRegex(fullName)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
      if (fnRegex.test(remainingComment)) {
        combinedUserIds.add(u.id);
        // Mask out the matched full name so sub-tokens are not falsely re-matched
        remainingComment = remainingComment.replace(new RegExp(`@${escapeRegex(fullName)}`, 'gi'), ' ');
      }
    }

    // 2. Exact Email or Email Prefix Matching (e.g. "@akash.deep@encalm.com" or "@akash.deep")
    for (const u of sortedUsers) {
      if (!u.email) continue;
      const email = u.email.trim();
      const emailPrefix = email.split('@')[0];

      const emailRegex = new RegExp(`@${escapeRegex(email)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
      if (emailRegex.test(remainingComment)) {
        combinedUserIds.add(u.id);
        remainingComment = remainingComment.replace(new RegExp(`@${escapeRegex(email)}`, 'gi'), ' ');
        continue;
      }

      if (emailPrefix && emailPrefix.length >= 3) {
        const prefixRegex = new RegExp(`@${escapeRegex(emailPrefix)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
        if (prefixRegex.test(remainingComment)) {
          combinedUserIds.add(u.id);
          remainingComment = remainingComment.replace(new RegExp(`@${escapeRegex(emailPrefix)}`, 'gi'), ' ');
        }
      }
    }

    // 3. User ID Slug Matching (e.g. "user-praveen-pal" -> "@praveen pal")
    for (const u of sortedUsers) {
      if (!u.id) continue;
      const idSlug = u.id.replace('user-', '').replace(/-/g, ' ').trim();
      if (idSlug.length >= 3) {
        const idSlugRegex = new RegExp(`@${escapeRegex(idSlug)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
        if (idSlugRegex.test(remainingComment)) {
          combinedUserIds.add(u.id);
          remainingComment = remainingComment.replace(new RegExp(`@${escapeRegex(idSlug)}`, 'gi'), ' ');
        }
      }
    }

    // 4. First name matching ONLY IF that first name is completely unique across the organisation
    // If multiple users share the same first name (e.g. multiple "Akash" in Encalm), matching on first name alone is strictly disabled
    for (const u of sortedUsers) {
      if (!u.name) continue;
      const firstName = u.name.trim().split(' ')[0];
      const fnLower = firstName.toLowerCase();
      if (firstName.length >= 3 && firstNameCounts.get(fnLower) === 1) {
        const firstNameRegex = new RegExp(`@${escapeRegex(firstName)}(?:\\b|\\s|[,:;!?]|$)`, 'i');
        if (firstNameRegex.test(remainingComment)) {
          combinedUserIds.add(u.id);
          remainingComment = remainingComment.replace(new RegExp(`@${escapeRegex(firstName)}`, 'gi'), ' ');
        }
      }
    }
  }

  const finalUserIds = Array.from(combinedUserIds);

  if (finalUserIds.length === 0) {
    return res.status(400).json({ error: 'At least one user must be tagged or @mentioned' });
  }

  const project = fetchFullProject(projectId);
  const projectName = project ? project.name : projectId;
  const projectCode = project?.code;
  const projectLocation = project?.location;
  const currentStage =
    (project?.phases && Array.isArray(project.phases) && project.phases.find((p: any) => p.status === 'In Progress')?.name) ||
    project?.status ||
    'Active Delivery';
  const targetDate = project?.targetDate || entityContext;

  // Anti-Spoofing Security: Strictly bind sender identity to the authenticated user from JWT token
  const sender = req.user.name;
  const senderEmail = req.user.email;
  const origin = publicBaseUrl(req);
  const dashboardUrl = `${origin}/project/${projectId}`;

  const dispatchResults: Array<{
    userId: string;
    userName: string;
    email: string;
    status: string;
    id?: string;
    error?: string;
  }> = [];

  for (const userId of finalUserIds) {
    if (!userId) continue;

    // Lookup user details from DB
    let userRow = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as
      | { id: string; name: string; email: string }
      | undefined;

    // If user is from Azure Directory (e.g. azure-guid) or not in local DB
    if (!userRow && userId.startsWith('azure-')) {
      try {
        const azureUsers = await searchEncalmDirectory();
        const foundAzure = azureUsers.find((au) => au.id === userId);
        if (foundAzure) {
          // Auto-insert into local users table so foreign keys and future tags work seamlessly
          db.prepare(`
            INSERT INTO users (id, name, email, role, title, initials, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email
          `).run(
            foundAzure.id,
            foundAzure.name,
            foundAzure.email,
            foundAzure.role,
            foundAzure.title,
            foundAzure.initials
          );
          userRow = { id: foundAzure.id, name: foundAzure.name, email: foundAzure.email };
        }
      } catch (err: any) {
        console.warn('[Azure User Auto-Register Error]', err.message);
      }
    }

    const recipientName = userRow?.name || userId;
    const recipientEmail = userRow?.email;


    // 1. Insert in-app notification
    const notifTitle = `Tagged on ${entityType}: ${entityTitle || 'Project Item'}`;
    const notifMessage = comment
      ? `${sender} tagged you on ${entityType.toLowerCase()} "${entityTitle || 'item'}" in ${projectName}: "${comment}"`
      : `${sender} tagged you on ${entityType.toLowerCase()} "${entityTitle || 'item'}" in ${projectName}`;

    try {
      db.prepare(`
        INSERT INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
        VALUES (?, 'tagged_task', ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(
        `notif-tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        notifTitle,
        notifMessage,
        projectId,
        `/project/${projectId}`,
        userId
      );
    } catch (err) {
      console.warn('[Tag Notification Insert Error]', err);
    }

    // 2. Dispatch email notification
    if (recipientEmail) {
      const html = buildTagNotificationHtml({
        recipientName,
        taggedByName: sender,
        senderEmail,
        entityType,
        entityTitle: entityTitle || `${entityType} in ${projectName}`,
        entityContext,
        comment,
        projectName,
        projectCode,
        projectLocation,
        currentStage,
        targetDate,
        dashboardUrl,
      });

      const emailRes = await sendEmail({
        to: recipientEmail,
        recipientName,
        replyTo: senderEmail,
        subject: `[Encalm - ${projectCode || 'ACTION'}] Action Required: ${entityTitle || projectName}`,
        html,
        templateType: 'tag_notification',
        projectId,
      });

      dispatchResults.push({
        userId,
        userName: recipientName,
        email: recipientEmail,
        status: emailRes.status,
        id: emailRes.id,
        error: emailRes.error,
      });
    } else {
      dispatchResults.push({
        userId,
        userName: recipientName,
        email: 'no-email-found',
        status: 'skipped',
        error: 'User has no registered email',
      });
    }
  }

  // 3. If there is a comment, also append it to project updates feed so activity is preserved
  if (comment && comment.trim() && project) {
    try {
      const updateId = `upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const taggedNames = dispatchResults.map((d) => d.userName).join(', ');
      db.prepare(`
        INSERT INTO updates (id, project_id, author, role, date, stage, kind, text, created_at)
        VALUES (?, ?, ?, ?, date('now'), ?, 'Progress', ?, datetime('now'))
      `).run(
        updateId,
        projectId,
        sender,
        req.user?.title || 'Team Member',
        entityTitle || entityType,
        `[Tagged ${taggedNames}]: ${comment.trim()}`
      );
    } catch (err) {
      console.warn('[Activity Log Append Error]', err);
    }
  }

  return res.json({
    success: true,
    message: `Dispatched notification email to ${dispatchResults.filter((r) => r.status !== 'skipped').length} recipient(s)`,
    recipients: dispatchResults,
  });
});

export default router;
