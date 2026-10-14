/** Escapes text for safe use in HTML element content and quoted attributes. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseEmailWrapper(contentHtml: string, previewText: string = 'Encalm Projects Notification'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(previewText)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f7f5ef;
      color: #1a202c;
    }
    .wrapper {
      max-width: 600px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2ddd3;
      box-shadow: 0 4px 20px rgba(23, 62, 73, 0.06);
    }
    .header {
      background: #173e49;
      padding: 24px 32px;
      border-bottom: 3px solid #d19b35;
    }
    .brand {
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-sub {
      color: #d19b35;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .body-content {
      padding: 32px;
      font-size: 14px;
      line-height: 1.6;
      color: #2d3748;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-gold { background: #fdf3d8; color: #9a711f; border: 1px solid #eadcb1; }
    .badge-teal { background: #edf5f0; color: #2e7c67; border: 1px solid #cbe4d9; }
    .badge-red { background: #fae5e1; color: #b2473d; border: 1px solid #f3c2bc; }
    .card-box {
      background: #faf8f2;
      border: 1px solid #e8e3d5;
      border-radius: 8px;
      padding: 18px;
      margin: 20px 0;
    }
    .btn {
      display: inline-block;
      background: #2e7c67;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 16px;
    }
    .footer {
      background: #faf8f2;
      padding: 20px 32px;
      border-top: 1px solid #e8e3d5;
      font-size: 11px;
      color: #718096;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">ENCALM HOSPITALITY</div>
      <div class="brand-sub">Project Dashboard</div>
    </div>
    <div class="body-content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">This is an automated notification from the <strong>Encalm Project Dashboard</strong>.</p>
      <p style="margin: 0;">Encalm Hospitality Private Limited • Airport Lounges, Transit Hotels & F&B Operations</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Template 1: User Tag & Comment Notification (Self-Contained Executive Email)
 */
export function buildTagNotificationHtml(data: {
  recipientName: string;
  taggedByName: string;
  senderEmail?: string;
  entityType: 'Task' | 'Stage' | 'Milestone' | 'Issue' | 'Update' | 'General';
  entityTitle: string;
  entityContext?: string;
  comment?: string;
  projectName: string;
  projectCode?: string;
  projectLocation?: string;
  currentStage?: string;
  targetDate?: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(
    `
    <div style="margin-bottom: 20px;">
      <p style="font-size: 16px; font-weight: 700; color: #173e49; margin: 0 0 6px 0;">
        Hello ${esc(data.recipientName)},
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #2d3748;">
        <strong>${esc(data.taggedByName)}</strong> from the Project Delivery Team has tagged you on a <strong>${esc(data.entityType)}</strong> in:
      </p>
      <p style="margin: 6px 0 0 0; font-size: 17px; font-weight: 800; color: #173e49;">
        ${esc(data.projectName)} ${data.projectCode ? `<span style="font-size: 12px; font-weight: 600; color: #2e7c67; background: #edf5f0; padding: 2px 7px; border-radius: 4px; margin-left: 6px; border: 1px solid #cbe4d9;">${esc(data.projectCode)}</span>` : ''}
      </p>
    </div>

    <!-- Executive Project Context Grid -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; background: #faf8f3; border: 1px solid #e8e3d5; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
      <tbody>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600; width: 35%;">Facility / Location:</td>
          <td style="padding: 10px 14px; color: #173e49; font-weight: 700;">${esc(data.projectLocation || 'Encalm Airport Facility')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Current Project Stage:</td>
          <td style="padding: 10px 14px; color: #2e7c67; font-weight: 700;">${esc(data.currentStage || 'Active Delivery')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee8db;">
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Tagged Item (${esc(data.entityType)}):</td>
          <td style="padding: 10px 14px; color: #173e49; font-weight: 700;">${esc(data.entityTitle)}</td>
        </tr>
        ${
          data.targetDate || data.entityContext
            ? `
        <tr>
          <td style="padding: 10px 14px; color: #718096; font-weight: 600;">Timeline / Target Date:</td>
          <td style="padding: 10px 14px; color: #d19b35; font-weight: 700;">${esc(data.targetDate || data.entityContext)}</td>
        </tr>`
            : ''
        }
      </tbody>
    </table>

    <!-- Prominently Highlighted Comment / Action Required Card -->
    ${
      data.comment
        ? `
      <div style="background: #fffdf5; border: 2px solid #d19b35; border-radius: 10px; padding: 18px 20px; margin: 22px 0; box-shadow: 0 2px 8px rgba(209, 155, 53, 0.08);">
        <div style="margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #8c671b; text-transform: uppercase; letter-spacing: 0.8px;">
            🚨 ACTION REQUIRED / COMMENT FROM ${esc(data.taggedByName.toUpperCase())}:
          </span>
        </div>
        <div style="font-size: 15px; font-weight: 600; color: #173e49; line-height: 1.6; white-space: pre-wrap;">
          "${esc(data.comment).replace(/@([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)?)/g, '<span style="color: #2e7c67; font-weight: 700; background: #edf5f0; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbe4d9;">@$1</span>')}"
        </div>
      </div>
    `
        : ''
    }

    <!-- Zero-Login Reply Banner -->
    <div style="background: #edf5f0; border: 1.5px solid #2e7c67; border-radius: 8px; padding: 16px 18px; margin: 22px 0; text-align: left;">
      <div style="font-size: 13.5px; font-weight: 700; color: #173e49; margin-bottom: 4px;">
        ✉️ Zero-Login Required — Simply Hit "Reply" in Outlook
      </div>
      <div style="font-size: 12.5px; color: #235445; line-height: 1.5;">
        You do not need to create an account or log into the dashboard. When you reply directly to this email in Outlook, your response will be delivered straight to <strong>${esc(data.taggedByName)}</strong>${data.senderEmail ? ` at <a href="mailto:${esc(data.senderEmail)}" style="color: #173e49; font-weight: 700;">${esc(data.senderEmail)}</a>` : ''}.
      </div>
    </div>

    <!-- Optional Dashboard Link -->
    <div style="text-align: center; margin-top: 18px;">
      <a href="${esc(data.dashboardUrl)}" style="color: #718096; font-size: 12px; text-decoration: underline;" target="_blank">
        (Optional) Open Project Workspace in Dashboard →
      </a>
    </div>
  `,
    `Action Required in ${esc(data.projectName)}: ${esc(data.entityTitle)}`,
  );
}

/**
 * Template 2: Critical Issue Alert
 */
export function buildCriticalIssueHtml(data: {
  recipientName: string;
  issueTitle: string;
  severity: string;
  category?: string;
  detail: string;
  projectName: string;
  raisedBy?: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(
    `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
      <span class="badge badge-red">CRITICAL ISSUE ALERT</span>
      <span class="badge badge-gold">${esc(data.projectName)}</span>
    </div>

    <p style="font-size: 16px; font-weight: 700; color: #b2473d; margin-top: 0;">
      Attention ${esc(data.recipientName)},
    </p>
    <p>
      A high-severity issue requiring immediate leadership oversight has been logged on <strong>${esc(data.projectName)}</strong>.
    </p>

    <div class="card-box" style="border-left: 4px solid #b2473d;">
      <div style="font-size: 15px; font-weight: 700; color: #173e49; margin-bottom: 6px;">
        ${esc(data.issueTitle)}
      </div>
      <div style="font-size: 12px; color: #718096; margin-bottom: 12px;">
        Severity: <strong style="color: #b2473d;">${esc(data.severity)}</strong> &nbsp;•&nbsp; 
        Category: <strong>${esc(data.category || 'General')}</strong>
        ${data.raisedBy ? ` &nbsp;•&nbsp; Raised by: <strong>${esc(data.raisedBy)}</strong>` : ''}
      </div>
      <p style="margin: 0; font-size: 13px; color: #2d3748; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2ddd3;">
        ${esc(data.detail)}
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" style="background: #b2473d;" target="_blank">Review Critical Issue →</a>
    </div>
  `,
    `Critical Issue Alert: ${esc(data.projectName)}`,
  );
}

/**
 * Template 3: Milestone Approval Required
 */
export function buildMilestoneApprovalHtml(data: {
  recipientName: string;
  milestoneTitle: string;
  targetDate: string;
  stage?: string;
  projectName: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(
    `
    <p style="font-size: 16px; font-weight: 700; color: #173e49; margin-top: 0;">
      Dear ${esc(data.recipientName)},
    </p>
    <p>
      A milestone requiring governance sign-off on <strong>${esc(data.projectName)}</strong> is waiting for review.
    </p>

    <div class="card-box">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #718096; margin-bottom: 6px;">
        Milestone Pending Approval
      </div>
      <div style="font-size: 16px; font-weight: 700; color: #173e49; margin-bottom: 8px;">
        ${esc(data.milestoneTitle)}
      </div>
      <div style="font-size: 12px; color: #4a5568;">
        Target Date: <strong>${esc(data.targetDate)}</strong> 
        ${data.stage ? `&nbsp;•&nbsp; Stage: <strong>${esc(data.stage)}</strong>` : ''}
      </div>
    </div>

    <p>As Project Coordinator, please log in to approve or reject this milestone milestone request.</p>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" target="_blank">Review & Sign Off Milestone →</a>
    </div>
  `,
    `Milestone Approval: ${esc(data.milestoneTitle)}`,
  );
}

/**
 * Template 4: Executive Project Summary
 */
export function buildProjectSummaryHtml(data: {
  recipientName: string;
  projectName: string;
  senderName: string;
  progress: number;
  health: string;
  status: string;
  customNote?: string;
  dashboardUrl: string;
}): string {
  return baseEmailWrapper(
    `
    <p style="font-size: 16px; font-weight: 700; color: #173e49; margin-top: 0;">
      Hello ${esc(data.recipientName)},
    </p>
    <p>
      <strong>${esc(data.senderName)}</strong> has shared an executive project status update for <strong>${esc(data.projectName)}</strong>.
    </p>

    <div class="card-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 16px; font-weight: 700; color: #173e49;">${esc(data.projectName)}</span>
        <span class="badge badge-teal">${esc(data.status)}</span>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0;">
        <tr>
          <td style="padding: 6px 0; color: #718096;">Progress:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #2e7c67;">${esc(data.progress)}% Completed</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #718096;">Health:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right;">${esc(data.health)}</td>
        </tr>
      </table>

      ${
        data.customNote
          ? `
        <div style="margin-top: 12px; padding: 12px; background: #ffffff; border-radius: 6px; border: 1px solid #e2ddd3;">
          <div style="font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; margin-bottom: 4px;">Executive Note:</div>
          <div style="font-size: 13px; color: #2d3748; white-space: pre-wrap;">${esc(data.customNote)}</div>
        </div>
      `
          : ''
      }
    </div>

    <div style="text-align: center;">
      <a href="${esc(data.dashboardUrl)}" class="btn" target="_blank">Open Project in Dashboard →</a>
    </div>
  `,
    `Project Update: ${esc(data.projectName)}`,
  );
}

/**
 * Template 5: SMTP Test Email
 */
export function buildTestEmailHtml(recipientName: string): string {
  return baseEmailWrapper(
    `
    <p style="font-size: 16px; font-weight: 700; color: #2e7c67; margin-top: 0;">
      ✓ SMTP Integration Connected Successfully!
    </p>
    <p>
      Hello <strong>${esc(recipientName)}</strong>,
    </p>
    <p>
      This is a test notification confirming that the Encalm Project Dashboard email service is operational and properly authenticated with your SMTP server.
    </p>

    <div class="card-box" style="border-left: 4px solid #2e7c67;">
      <div style="font-size: 13px; color: #2d3748;">
        <strong>Configuration Status:</strong> Active & Verified<br />
        <strong>Timestamp:</strong> ${new Date().toUTCString()}
      </div>
    </div>
  `,
    'Encalm Project Dashboard SMTP Test Email',
  );
}
