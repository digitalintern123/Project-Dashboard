import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  applyEmailSettings,
  buildTestEmailHtml,
  describeEmailSettings,
  getActiveEmailProvider,
  resendEmailLog,
  searchEncalmDirectory,
  sendEmailNow,
} from '../services/email.js';
import { sendProjectUpdate, tagAndComment } from '../services/email-dispatch.service.js';
import { emailRepo } from '../repositories/email.repo.js';
import { validate } from '../validation/validate.js';
import { pageFrom } from '../utils/paging.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';
import { audited } from '../utils/audit.js';

const router = Router();

type SecretBearing = { smtp?: { pass?: string }; graph?: { clientSecret?: string }; clientSecret?: string };

/** Request body for the audit log with every secret removed. */
function redactEmailSettings(req: { body: SecretBearing }) {
  const { smtp, graph, clientSecret: _cs, ...rest } = req.body ?? {};
  return {
    ...rest,
    smtp: smtp ? { ...smtp, pass: smtp.pass ? '[redacted]' : undefined } : undefined,
    graph: graph ? { ...graph, clientSecret: graph.clientSecret ? '[redacted]' : undefined } : undefined,
  };
}

const sender = (req: AuthenticatedRequest) => ({ user: req.user!, origin: publicBaseUrl(req) });

// Live search of the Encalm directory through Microsoft Graph
router.get('/directory', requireAuth, validate({ query: S.directoryQuery }), async (req, res) => {
  const query = ((req.query.q as string) || '').trim();
  res.json({ users: await searchEncalmDirectory(query) });
});

// Email outbox, newest first
router.get('/logs', requireAuth, requireRole(['coordinator']), validate({ query: S.emailLogsQuery }), (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const page = pageFrom(req.query, 50, 100);
  res.json({
    total: emailRepo.countLogs(projectId),
    ...page,
    logs: emailRepo.listLogs(projectId, page).map((l) => ({
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

// Email settings (SMTP and Microsoft Graph) with secrets masked
router.get('/settings', requireAuth, requireRole(['coordinator']), (_req, res) => {
  res.json({ settings: describeEmailSettings() });
});

router.post(
  '/settings',
  requireAuth,
  requireRole(['coordinator']),
  validate({ body: S.emailSettingsBody }),
  audited({ action: 'update', entityType: 'email_settings', details: redactEmailSettings }),
  (req, res) => {
    applyEmailSettings(req.body);
    res.json({ message: 'Email settings saved successfully', settings: describeEmailSettings() });
  },
);

// Saves any settings sent with it, then sends a test email immediately so the coordinator sees the real outcome.
router.post(
  '/test',
  requireAuth,
  requireRole(['coordinator']),
  validate({ body: S.emailTestBody }),
  audited({ action: 'send_test', entityType: 'email', details: redactEmailSettings }),
  async (req: AuthenticatedRequest, res) => {
    const { to, recipientName, provider: requestedProvider, smtp, graph } = req.body;
    applyEmailSettings({ provider: requestedProvider, smtp, graph }, { legacyGraphFields: false });

    const targetEmail = to || req.user!.email;
    const name = recipientName || req.user!.name;
    const provider = getActiveEmailProvider();
    const result = await sendEmailNow({
      to: targetEmail,
      recipientName: name,
      subject: `Encalm Projects - ${provider === 'smtp' ? 'SMTP' : 'Microsoft Graph'} Delivery Test`,
      html: buildTestEmailHtml(name),
      templateType: 'test_email',
    });

    const providerLabel = provider === 'smtp' ? 'SMTP (Outlook/Office 365)' : 'Microsoft Graph API';
    res.json({
      success: result.status === 'sent',
      result,
      message:
        result.status === 'sent'
          ? `Test email sent successfully via ${providerLabel} to ${targetEmail}`
          : result.status === 'outbox'
            ? `${providerLabel} not configured: Email queued in dashboard Outbox`
            : `Failed to deliver email: ${result.error}`,
    });
  },
);

// Put an outbox entry back on the delivery queue
router.post(
  '/resend/:id',
  requireAuth,
  requireRole(['coordinator']),
  validate({ params: S.idParams }),
  audited({ action: 'resend', entityType: 'email', id: (req) => req.params.id as string }),
  (req, res) => {
    res.json(resendEmailLog(req.params.id as string));
  },
);

// Email a project summary to stakeholders
router.post(
  '/send-project-update',
  requireAuth,
  validate({ body: S.sendProjectUpdateBody }),
  audited({
    action: 'send_project_update',
    entityType: 'email',
    id: (req) => req.body.projectId,
    details: (req) => ({ recipients: req.body.recipients }),
  }),
  (req: AuthenticatedRequest, res) => {
    const { projectId, recipients, customNote } = req.body;
    const results = sendProjectUpdate(projectId, recipients, customNote, sender(req));
    res.json({
      success: true,
      message: `Queued project summary for ${results.length} recipient(s)`,
      results,
    });
  },
);

// Tag people on a project item: in-app notification plus email
router.post(
  '/tag-and-comment',
  requireAuth,
  validate({ body: S.tagAndCommentBody }),
  audited({ action: 'tag', entityType: 'email', id: (req) => req.body.projectId, details: (req) => req.body }),
  async (req: AuthenticatedRequest, res) => {
    const recipients = await tagAndComment(req.body, sender(req));
    res.json({
      success: true,
      message: `Queued notification email for ${recipients.filter((r) => r.status !== 'skipped').length} recipient(s)`,
      recipients,
    });
  },
);

export default router;
