export type EmailProvider = 'smtp' | 'microsoft_graph';

export interface EmailLogEntry {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  templateType: string;
  projectId: string | null;
  status: 'queued' | 'sent' | 'failed' | 'outbox';
  htmlContent: string;
  error: string | null;
  createdAt: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
}

export interface MicrosoftGraphConfig {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  senderEmail?: string;
  saveToSentItems?: boolean;
}

export interface SendEmailOptions {
  to: string;
  recipientName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  templateType: 'tag_notification' | 'critical_issue' | 'milestone_approval' | 'project_summary' | 'test_email';
  projectId?: string;
}

export type QueueResult = { id: string; status: 'queued' | 'sent' | 'failed' | 'outbox'; error?: string };
