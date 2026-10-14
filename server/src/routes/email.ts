import { Router } from 'express';
import { requireAuth, requireRole, requireTagAccess, type AuthenticatedRequest } from '../middleware/auth.js';
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

/** Request body for the audit log with the SMTP password removed. */
function redactEmailSettings(req: { body: { smtp?: { pass?: string } } }) {
  const { smtp } = req.body ?? {};
  return { smtp: smtp ? { ...smtp, pass: smtp.pass ? '[redacted]' : undefined } : undefined };
}

const sender = (req: AuthenticatedRequest) => ({ user: req.user!, origin: publicBaseUrl(req) });
const providerLabel = (provider: string) =>
  provider === 'microsoft_graph' ? 'Microsoft 365' : provider === 'smtp' ? 'SMTP' : 'Outbox';

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

// Email settings: SMTP (password masked) and whether Microsoft 365 is connected
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

// Sends a test email from and to the signed-in coordinator, immediately, so they see the real outcome.
router.post(
  '/test',
  requireAuth,
  requireRole(['coordinator']),
  validate({ body: S.emailTestBody }),
  audited({ action: 'send_test', entityType: 'email' }),
  async (req: AuthenticatedRequest, res) => {
    const me = req.user!;
    const provider = getActiveEmailProvider();
    const result = await sendEmailNow({
      to: me.email,
      recipientName: me.name,
      sender: { email: me.email, name: me.name },
      subject: `Encalm Projects - ${providerLabel(provider)} Delivery Test`,
      html: buildTestEmailHtml(me.name),
      templateType: 'test_email',
    });

    res.json({
      success: result.status === 'sent',
      result,
      message:
        result.status === 'sent'
          ? `Test email sent via ${providerLabel(provider)} to ${me.email}`
          : result.status === 'outbox'
            ? 'No email provider configured: the test email is waiting in the Outbox'
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
  requireTagAccess(),
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
  requireTagAccess(),
  validate({ body: S.tagAndCommentBody }),
  audited({ action: 'tag', entityType: 'email', id: (req) => req.body.projectId, details: (req) => req.body }),
  async (req: AuthenticatedRequest, res) => {
    const recipients = await tagAndComment(req.body, sender(req));
    res.json({
      success: true,
      message: `Queued notification email for ${recipients.filter((r) => r.status !== 'skipped').length} recipient(s)`,
      delivery: getActiveEmailProvider(),
      recipients,
    });
  },
);

export default router;
