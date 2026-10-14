import React, { useCallback, useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Settings,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  X,
  ExternalLink,
  Key,
  Globe,
  Clock,
} from 'lucide-react';
import { api, type EmailLogItem, type EmailSettings } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { users as defaultUsers, type User } from '@/data/users';
import { useAppState } from '@/state/app-state';
import { MentionTextarea } from './mention-textarea';
import { errorMessage } from '@/lib/utils';

interface EmailHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'outbox' | 'settings' | 'send';
  projectId?: string;
  projectName?: string;
}

export function EmailHubModal({ isOpen, onClose, defaultTab = 'outbox', projectId, projectName }: EmailHubModalProps) {
  const [activeTab, setActiveTab] = useState<'outbox' | 'settings' | 'send'>(defaultTab);
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<EmailLogItem | null>(null);

  // Email settings. Microsoft 365 is configured on the server only; the app
  // just shows whether it is connected. SMTP is the fallback and editable here.
  const [provider, setProvider] = useState<EmailSettings['provider']>('outbox');
  const [graphStatus, setGraphStatus] = useState<EmailSettings['graph']>({ isConfigured: false, sendAsDomains: [] });
  const [smtpForm, setSmtpForm] = useState({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'Encalm Project Dashboard',
  });
  const [, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  // Send Project Update State
  const [customNote, setCustomNote] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
  const [recipientMentionText, setRecipientMentionText] = useState('');
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const { leads, user: currentUser } = useAppState();
  const { toast } = useToast();

  // Merge default users with leads
  const availableUsers: User[] = React.useMemo(() => {
    const combined = [...defaultUsers];
    if (Array.isArray(leads)) {
      leads.forEach((l) => {
        if (!combined.some((u) => u.id === l.id || u.email?.toLowerCase() === l.email?.toLowerCase())) {
          combined.push(l);
        }
      });
    }
    return combined;
  }, [leads]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await api.email.getLogs(projectId);
      setLogs(res.logs || []);
    } catch (err) {
      console.warn('Failed to load email logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [projectId]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { settings } = await api.email.getSettings();
      // Read defensively: during an update the server may briefly still send the older shape.
      setProvider(
        settings?.provider === 'microsoft_graph' || settings?.provider === 'smtp' ? settings.provider : 'outbox',
      );
      setGraphStatus({
        isConfigured: settings?.graph?.isConfigured === true,
        sendAsDomains: Array.isArray(settings?.graph?.sendAsDomains) ? settings.graph.sendAsDomains : [],
      });
      const smtp = settings?.smtp;
      setSmtpForm({
        host: smtp?.host || 'smtp-mail.outlook.com',
        port: smtp?.port || 587,
        secure: Boolean(smtp?.secure),
        user: smtp?.user || '',
        pass: smtp?.pass || '',
        fromName: smtp?.fromName || 'Encalm Project Dashboard',
      });
    } catch (err) {
      console.warn('Failed to load email settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      loadSettings();
    }
  }, [isOpen, loadLogs, loadSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.email.saveSettings({ smtp: smtpForm });
      setProvider(res.settings.provider);
      toast({ title: 'Settings Saved', description: 'SMTP settings saved.' });
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: errorMessage(err, 'Could not save email settings.'),
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const res = await api.email.sendTest();
      const status = res.result?.status;
      let desc = res.message || res.result?.error;
      if (
        status === 'failed' &&
        (res.result?.error?.includes('5.7.139') || res.result?.error?.includes('SmtpClientAuthentication is disabled'))
      ) {
        desc =
          'Microsoft has disabled basic SMTP sign-in for this tenant. Ask the server administrator to connect Microsoft 365 instead, or ask your M365 admin to enable Authenticated SMTP.';
      }
      toast({
        title:
          status === 'sent' ? '✓ Test Email Sent' : status === 'failed' ? 'Test Email Failed' : 'Waiting in Outbox',
        description: desc,
        variant: status === 'failed' ? 'destructive' : 'default',
      });
      loadLogs();
    } catch (err) {
      toast({
        title: 'Test Failed',
        description: errorMessage(err, 'Could not dispatch test email.'),
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleResend = async (logId: string) => {
    try {
      const res = await api.email.resend(logId);
      if (res.success) {
        toast({
          title: 'Email queued',
          description: 'It will be delivered in the background; the outbox updates shortly.',
        });
        // Delivery happens in the background: refresh again once it has had a moment.
        setTimeout(loadLogs, 6000);
      } else {
        toast({
          title: 'Resend Note',
          description: res.error || 'Failed to dispatch email.',
          variant: 'destructive',
        });
      }
      loadLogs();
    } catch (err) {
      toast({
        title: 'Resend Failed',
        description: errorMessage(err),
        variant: 'destructive',
      });
    }
  };

  const handleSendProjectUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    if (selectedRecipients.length === 0) {
      toast({
        title: 'Recipient Required',
        description: 'Please tag at least one recipient using @name before sending.',
        variant: 'destructive',
      });
      return;
    }

    setSendingUpdate(true);
    try {
      const recipients = selectedRecipients
        .filter((u) => u.email && u.email.includes('@'))
        .map((u) => ({
          email: u.email!,
          name: u.name,
        }));

      const res = await api.email.sendProjectUpdate(projectId, {
        recipients,
        customNote: customNote.trim() || undefined,
      });

      toast({
        title: 'Update Dispatched',
        description: res.message,
      });
      setCustomNote('');
      setSelectedRecipients([]);
      setRecipientMentionText('');
      setActiveTab('outbox');
      loadLogs();
    } catch (err) {
      toast({
        title: 'Dispatch Failed',
        description: errorMessage(err, 'Could not send project update.'),
        variant: 'destructive',
      });
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleAddRecipientMention = (user: User) => {
    setSelectedRecipients((prev) => {
      if (!prev.some((u) => u.id === user.id || u.email?.toLowerCase() === user.email?.toLowerCase())) {
        return [...prev, user];
      }
      return prev;
    });
    setRecipientMentionText('');
  };

  const handleRemoveRecipient = (userId: string) => {
    setSelectedRecipients((prev) => prev.filter((u) => u.id !== userId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b45]/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-[#f8f6f0] shadow-2xl animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#2e7c67]">
              <Mail size={18} />
            </span>
            <div>
              <h2 className="font-serif text-[18px] font-bold text-[#173e49]">Email Integration & Communications</h2>
              <p className="text-[11px] text-muted-foreground">
                Automated delivery radar, stakeholder notifications & SMTP outbox
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-white/70 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('outbox')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-[12px] font-bold transition ${
              activeTab === 'outbox'
                ? 'border-[#2e7c67] text-[#2e7c67]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Inbox size={14} />
            <span>Outbox & Delivery Logs</span>
            {logs.length > 0 && (
              <span className="rounded-full bg-[#edf5f0] px-2 py-0.5 text-[10px] font-semibold text-[#2e7c67]">
                {logs.length}
              </span>
            )}
          </button>

          {projectId && (
            <button
              type="button"
              onClick={() => setActiveTab('send')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 text-[12px] font-bold transition ${
                activeTab === 'send'
                  ? 'border-[#2e7c67] text-[#2e7c67]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Send size={14} />
              <span>Send Executive Update</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-[12px] font-bold transition ${
              activeTab === 'settings'
                ? 'border-[#2e7c67] text-[#2e7c67]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings size={14} />
            <span>Email Settings</span>
            <span
              className={`size-2 rounded-full ${provider !== 'outbox' ? 'bg-[#3d9a7e]' : 'bg-[#d19b35]'}`}
              title={provider !== 'outbox' ? 'Email delivery connected' : 'Outbox mode: no email service connected'}
            />
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: Outbox & Delivery Logs */}
          {activeTab === 'outbox' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-[#173e49]">Communication Log & Outbox Queue</h3>
                  <p className="text-[11px] text-muted-foreground">
                    All notifications dispatched by the dashboard are tracked here with full HTML preview.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                >
                  <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-white/50 py-12 text-center">
                  <Inbox size={28} className="mx-auto text-muted-foreground/60" />
                  <p className="mt-2 text-[12px] font-bold text-[#173e49]">Outbox Empty</p>
                  <p className="text-[11px] text-muted-foreground">
                    When you tag individuals or trigger alerts, email notifications will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border bg-white shadow-xs overflow-hidden">
                  {logs.map((log) => {
                    return (
                      <div
                        key={log.id}
                        className="flex flex-col gap-2 p-3.5 transition hover:bg-[#fbfaf6] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                log.status === 'sent'
                                  ? 'bg-[#edf5f0] text-[#2e7c67] border border-[#cbe4d9]'
                                  : log.status === 'outbox'
                                    ? 'bg-[#fdf3d8] text-[#9a711f] border border-[#eadcb1]'
                                    : log.status === 'queued'
                                      ? 'bg-[#eef0ed] text-[#4f5752] border border-border'
                                      : 'bg-[#fae5e1] text-[#b2473d] border border-[#f3c2bc]'
                              }`}
                            >
                              {log.status === 'sent' && <CheckCircle2 size={10} />}
                              {log.status === 'outbox' && <Inbox size={10} />}
                              {log.status === 'failed' && <AlertTriangle size={10} />}
                              {log.status === 'queued' && <Clock size={10} />}
                              <span>{log.status}</span>
                            </span>

                            <span className="font-mono text-[10px] text-muted-foreground">{log.createdAt}</span>
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground uppercase">
                              {log.templateType.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="mt-1 font-bold text-[12px] text-foreground truncate">{log.subject}</div>

                          <div className="text-[11px] text-muted-foreground">
                            To: <span className="font-semibold text-foreground">{log.recipientEmail}</span>
                            {log.recipientName && <span> ({log.recipientName})</span>}
                            {log.error && <span className="ml-2 text-[#b2473d]">Note: {log.error}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => setSelectedPreview(log)}
                            className="flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </button>

                          {(log.status === 'outbox' || log.status === 'failed') && (
                            <button
                              type="button"
                              onClick={() => handleResend(log.id)}
                              className="flex items-center gap-1 rounded-lg border border-[#cbe4d9] bg-[#edf5f0] px-2.5 py-1 text-[11px] font-bold text-[#2e7c67] hover:bg-[#dfeee5]"
                            >
                              <Send size={11} />
                              <span>Dispatch</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Send Executive Update */}
          {activeTab === 'send' && projectId && (
            <form onSubmit={handleSendProjectUpdate} className="space-y-4 max-w-2xl">
              <div>
                <h3 className="text-[13px] font-bold text-[#173e49]">Send Executive Project Status Update</h3>
                <p className="text-[11px] text-muted-foreground">
                  Dispatch a branded email summary of {projectName || 'this project'} to executive stakeholders.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-white p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="block text-[11px] font-bold text-foreground">
                      Executive Recipients (@mention to add)
                    </span>
                    <span className="text-[10px] font-mono text-[#2e7c67] font-semibold">
                      {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} tagged
                    </span>
                  </div>

                  {/* Selected Recipient Chips / Pills */}
                  {selectedRecipients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 p-2 rounded-lg border border-[#cbe4d9] bg-[#edf5f0]/50 max-h-32 overflow-y-auto">
                      {selectedRecipients.map((rec) => (
                        <span
                          key={rec.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#cbe4d9] px-2.5 py-1 text-[11px] font-semibold text-[#173e49] shadow-2xs"
                        >
                          <span className="grid size-4.5 place-items-center rounded-full bg-[#2e7c67] text-[8px] font-bold text-white">
                            {rec.initials}
                          </span>
                          <span>{rec.name}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">({rec.email})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(rec.id)}
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-[#fae5e1] hover:text-[#b2473d] transition-colors"
                            title="Remove recipient"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* @mention Autocomplete Input */}
                  <div className="mt-2">
                    <MentionTextarea
                      rows={1}
                      value={recipientMentionText}
                      onChange={(val) => setRecipientMentionText(val)}
                      users={availableUsers}
                      onMentionSelect={handleAddRecipientMention}
                      dropdownDirection="bottom"
                      placeholder="Type @ followed by colleague name (e.g. @Ruchika, @Chinmay, or Azure directory)..."
                      className="w-full rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Type <code className="bg-muted px-1 rounded font-mono text-[9px]">@name</code> above to search the
                    live Encalm corporate directory or core team members.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="email-hub-modal-executive-commentary-note"
                    className="block text-[11px] font-bold text-foreground"
                  >
                    Executive Commentary / Note
                  </label>
                  <textarea
                    id="email-hub-modal-executive-commentary-note"
                    rows={4}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Critical procurement milestones achieved this week; civil structural work remains on schedule for soft opening."
                    className="mt-1 w-full rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                  />
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={sendingUpdate || selectedRecipients.length === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2e7c67] px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#256654] disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title={
                      selectedRecipients.length === 0
                        ? 'Please tag at least one recipient with @name'
                        : 'Dispatch Executive Report'
                    }
                  >
                    <Send size={13} />
                    <span>{sendingUpdate ? 'Dispatching...' : 'Send Branded Update Email'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: Email settings */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-[13px] font-bold text-[#173e49]">Email Delivery</h3>
                <p className="text-[11px] text-muted-foreground">
                  Every email is sent as the person who caused it: tags, alerts and updates go out from the signed-in
                  user, and replies go back to them.
                </p>
              </div>

              {/* Microsoft 365: status only. Its credentials live on the server, never in the app. */}
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  graphStatus.isConfigured ? 'border-[#cbe4d9] bg-[#edf5f0]' : 'border-border bg-[#f7f5ef]'
                }`}
              >
                {graphStatus.isConfigured ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#2e7c67]" />
                ) : (
                  <Globe size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="text-[11px] leading-relaxed">
                  <div className="font-bold text-[#173e49]">
                    Microsoft 365: {graphStatus.isConfigured ? 'connected' : 'not configured'}
                  </div>
                  {graphStatus.isConfigured ? (
                    <p className="text-[#2e7c67]">
                      Emails are sent from each user's own mailbox
                      {graphStatus.sendAsDomains.length > 0 && <> (@{graphStatus.sendAsDomains.join(', @')})</>} and
                      saved in their Outlook Sent Items. Nobody can send as someone else.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Set up by the server administrator in the server's settings file; it is never entered or shown
                      here.
                    </p>
                  )}
                </div>
              </div>

              {provider === 'outbox' && (
                <div className="flex items-start gap-3 rounded-xl border border-[#eadcb1] bg-[#fdf3d8]/60 p-3.5">
                  <Inbox size={18} className="mt-0.5 shrink-0 text-[#9a711f]" />
                  <div className="text-[11px] leading-relaxed text-[#7a5914]">
                    <strong>In-App Outbox Mode Active:</strong> no email service is connected yet. Emails wait in the
                    Outbox with a full preview and can be resent once one is connected.
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="rounded-xl border border-border bg-white p-5 space-y-4">
                <div>
                  <h4 className="text-[12px] font-bold text-[#173e49]">SMTP (fallback)</h4>
                  <p className="text-[10px] text-muted-foreground">
                    {graphStatus.isConfigured
                      ? 'Not used while Microsoft 365 is connected.'
                      : 'Emails are sent from this account, shown as "<name> via Encalm Projects", with replies to the person who sent them.'}
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-[#cbe4d9] bg-[#edf5f0] p-3 text-[11px] text-[#2e7c67]">
                  <div className="flex items-center justify-between font-bold">
                    <span>Outlook & Office 365 SMTP Setup:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSmtpForm((prev) => ({ ...prev, host: 'smtp-mail.outlook.com', port: 587, secure: false }))
                        }
                        className="rounded bg-white px-2 py-0.5 text-[9px] font-bold shadow-2xs hover:bg-[#dfeee5]"
                      >
                        Use Outlook.com (587)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSmtpForm((prev) => ({ ...prev, host: 'smtp.office365.com', port: 587, secure: false }))
                        }
                        className="rounded bg-white px-2 py-0.5 text-[9px] font-bold shadow-2xs hover:bg-[#dfeee5]"
                      >
                        Use Office 365 (587)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-[#eadcb1] bg-[#fffbf2] p-3 text-[10px] text-[#8e681c]">
                  <Key size={14} className="mt-0.5 shrink-0 text-[#c9a04e]" />
                  <div className="leading-relaxed">
                    <strong>Two-Factor Authentication (2FA) Note:</strong> if the account uses two-step verification,
                    create an <strong>App Password</strong> in your{' '}
                    <a
                      href="https://account.live.com/proofs/manage/additional"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline text-[#715011] inline-flex items-center gap-0.5"
                    >
                      Microsoft Security Settings <ExternalLink size={10} />
                    </a>{' '}
                    and paste it into the Password field below.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="email-hub-modal-email-address-username"
                      className="block text-[11px] font-bold text-foreground"
                    >
                      Account Email / Username
                    </label>
                    <input
                      id="email-hub-modal-email-address-username"
                      type="email"
                      value={smtpForm.user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                      placeholder="notifications@encalm.com"
                      required
                      className="mt-1 w-full rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email-hub-modal-password-app-password"
                      className="block text-[11px] font-bold text-foreground"
                    >
                      Password / App Password
                    </label>
                    <input
                      id="email-hub-modal-password-app-password"
                      type="password"
                      value={smtpForm.pass}
                      onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                      placeholder="••••••••••••••••"
                      required
                      className="mt-1 w-full rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] font-mono focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="email-hub-modal-smtp-server-host"
                      className="block text-[11px] font-bold text-foreground"
                    >
                      SMTP Server (Host)
                    </label>
                    <input
                      id="email-hub-modal-smtp-server-host"
                      type="text"
                      value={smtpForm.host}
                      onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                      placeholder="smtp.office365.com"
                      required
                      className="mt-1 w-full rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] font-mono focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email-hub-modal-port-encryption"
                      className="block text-[11px] font-bold text-foreground"
                    >
                      Port & Encryption
                    </label>
                    <div className="flex gap-2 mt-1">
                      <input
                        id="email-hub-modal-port-encryption"
                        type="number"
                        value={smtpForm.port}
                        onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) || 587 })}
                        placeholder="587"
                        className="w-20 rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] font-mono focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                      />
                      <select
                        aria-label="Encryption"
                        value={smtpForm.secure ? 'ssl' : 'starttls'}
                        onChange={(e) => setSmtpForm({ ...smtpForm, secure: e.target.value === 'ssl' })}
                        className="flex-1 rounded-lg border border-border bg-[#faf8f3] px-2 text-[11px] font-medium"
                      >
                        <option value="starttls">STARTTLS (587)</option>
                        <option value="ssl">SSL/TLS (465)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email-hub-modal-sender-display-name"
                    className="block text-[11px] font-bold text-foreground"
                  >
                    Name for system emails
                  </label>
                  <input
                    id="email-hub-modal-sender-display-name"
                    type="text"
                    value={smtpForm.fromName}
                    onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })}
                    placeholder="Encalm Project Dashboard"
                    className="mt-1 w-full rounded-lg border border-border bg-[#faf8f3] px-3 py-2 text-[12px] focus:outline-hidden focus:ring-1 focus:ring-[#2e7c67]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={sendingTest}
                      className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                    >
                      <Send size={11} />
                      <span>{sendingTest ? 'Sending...' : 'Send me a test email'}</span>
                    </button>
                    {currentUser?.email && <span>to {currentUser.email}</span>}
                  </div>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2e7c67] px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#256654]"
                  >
                    <span>{savingSettings ? 'Saving...' : 'Save SMTP Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Selected Email HTML Preview Modal */}
        {selectedPreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="min-w-0">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Subject Preview
                  </span>
                  <h4 className="truncate text-[13px] font-bold text-[#173e49]">{selectedPreview.subject}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPreview(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-[#f7f5ef] p-4">
                {/* Rendered in a fully sandboxed iframe: no scripts, no same-origin access,
                    no forms or navigation, and its styles cannot leak into the app. */}
                <iframe
                  title={`Email preview: ${selectedPreview.subject}`}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={selectedPreview.htmlContent}
                  className="h-[60vh] w-full rounded-xl border border-[#e2ddd3] bg-white shadow-sm"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border p-3 text-[11px] text-muted-foreground">
                <span>To: {selectedPreview.recipientEmail}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPreview(null)}
                  className="rounded-lg border border-border px-3 py-1 font-semibold hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
