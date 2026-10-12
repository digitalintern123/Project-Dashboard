import type { Phase, Milestone, Project, ProjectIssue, ProjectUpdate, SitePhoto, PhotoCategory } from '@/data/projects';
import type { User } from '@/data/users';

const TOKEN_KEY = 'encalm-auth-token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted webviews
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers the callback run when the server rejects the session (HTTP 401). */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Session expired or revoked: drop the token and let the app return to the login screen.
  if (response.status === 401 && !path.startsWith('/api/auth/login')) {
    setStoredToken(null);
    unauthorizedHandler?.();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export type NotificationItem = {
  id: string;
  type: 'milestone_overdue' | 'high_issue' | 'approval_required' | 'system' | 'tagged_issue' | 'tagged_task';
  title: string;
  message: string;
  projectId?: string;
  link?: string;
  recipient_id?: string;
  read: boolean;
  createdAt: string;
};

export type EmailLogItem = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  templateType: string;
  projectId: string | null;
  status: 'sent' | 'failed' | 'outbox';
  htmlContent: string;
  error: string | null;
  createdAt: string;
};

export type EmailSettings = {
  provider: 'smtp' | 'microsoft_graph';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass?: string;
    fromName?: string;
    fromEmail?: string;
    isConfigured?: boolean;
  };
  graph?: {
    tenantId: string;
    clientId: string;
    clientSecret?: string;
    senderEmail: string;
    saveToSentItems: boolean;
    isConfigured?: boolean;
  };
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  senderEmail?: string;
  saveToSentItems?: boolean;
  isConfigured: boolean;
};

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: User }>('/api/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string; user: User }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    resetPassword: (userId: string) =>
      request<{ message: string; temporaryPassword: string }>(`/api/auth/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
      }),
    logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
    getUsers: () => request<{ users: User[] }>('/api/auth/users'),
    getLeads: () => request<{ leads: User[] }>('/api/auth/leads'),
    createLead: (data: { name: string; email: string; password: string; title?: string }) =>
      request<{ message: string; lead: User }>('/api/auth/create-lead', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  projects: {
    getAll: () => request<{ projects: Project[] }>('/api/projects'),
    get: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),
    create: (project: Partial<Project>) =>
      request<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(project),
      }),
    update: (id: string, patch: Partial<Project>) =>
      request<{ project: Project }>(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    allot: (id: string, leadId: string) =>
      request<{ project: Project }>(`/api/projects/${id}/allot`, {
        method: 'PATCH',
        body: JSON.stringify({ leadId }),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/projects/${id}`, {
        method: 'DELETE',
      }),
    sync: (projects: Project[]) =>
      request<{ count: number; success: boolean }>('/api/projects/sync', {
        method: 'POST',
        body: JSON.stringify({ projects }),
      }),
  },

  phases: {
    add: (projectId: string, phase: Partial<Phase>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/phases`, {
        method: 'POST',
        body: JSON.stringify(phase),
      }),
    update: (projectId: string, phaseId: string, patch: Partial<Phase>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/phases/${phaseId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    delete: (projectId: string, phaseId: string) =>
      request<{ project: Project }>(`/api/projects/${projectId}/phases/${phaseId}`, {
        method: 'DELETE',
      }),
    move: (projectId: string, phaseIndex: number, direction: -1 | 1) =>
      request<{ project: Project }>(`/api/projects/${projectId}/phases/move`, {
        method: 'POST',
        body: JSON.stringify({ phaseIndex, direction }),
      }),
  },

  milestones: {
    add: (projectId: string, milestone: Partial<Milestone>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        body: JSON.stringify(milestone),
      }),
    update: (projectId: string, milestoneId: string, patch: Partial<Milestone>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    delete: (projectId: string, milestoneId: string) =>
      request<{ project: Project }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'DELETE',
      }),
  },

  issues: {
    add: (projectId: string, issue: Partial<ProjectIssue>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/issues`, {
        method: 'POST',
        body: JSON.stringify(issue),
      }),
    update: (projectId: string, issueId: string, patch: Partial<ProjectIssue>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    delete: (projectId: string, issueId: string) =>
      request<{ project: Project }>(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'DELETE',
      }),
  },

  updates: {
    getAll: () =>
      request<{ updates: (ProjectUpdate & { id: string; project: { id: string; name: string; code: string } })[] }>(
        '/api/updates'
      ),
    add: (projectId: string, update: Partial<ProjectUpdate>) =>
      request<{ project: Project }>(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        body: JSON.stringify(update),
      }),
  },

  photos: {
    getAll: () =>
      request<{
        photos: (SitePhoto & {
          projectName: string;
          projectCode: string;
          projectLocation: string;
          projectCategory: string;
        })[];
      }>('/api/photos'),
    getByProject: (projectId: string) => request<{ photos: SitePhoto[] }>(`/api/projects/${projectId}/photos`),
    upload: (
      projectId: string,
      data: {
        fileData?: string;
        fileName?: string;
        url?: string;
        caption: string;
        stage?: string;
        category?: PhotoCategory;
        takenDate?: string;
      }
    ) =>
      request<{ message: string; photo: SitePhoto; photos?: SitePhoto[]; project: Project }>(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadBatch: (
      projectId: string,
      photos: Array<{
        fileData?: string;
        fileName?: string;
        url?: string;
        caption: string;
        stage?: string;
        category?: PhotoCategory;
        takenDate?: string;
      }>
    ) =>
      request<{ message: string; photos: SitePhoto[]; photo: SitePhoto; project: Project }>(`/api/projects/${projectId}/photos/batch`, {
        method: 'POST',
        body: JSON.stringify({ photos }),
      }),
    delete: (projectId: string, photoId: string) =>
      request<{ message: string; project: Project }>(`/api/projects/${projectId}/photos/${photoId}`, {
        method: 'DELETE',
      }),
  },

  notifications: {
    getAll: () => request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),
    markRead: (id: string) => request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
  },

  system: {
    health: () => request<{ status: string; database: string; counts: Record<string, number> }>('/api/system/health'),
    reset: () => request<{ message: string }>('/api/system/reset', { method: 'POST' }),
    restoreAllPdfs: () =>
      request<{
        success: boolean;
        message: string;
        totalProjects: number;
        hotelCount: number;
        loungeCount: number;
        kitchenCount: number;
        otherCount: number;
        encalmEatsCount: number;
        locations: Record<string, number>;
        restoredAt: string;
      }>('/api/system/restore-all-pdfs', { method: 'POST' }),
    exportBackup: () => request<any>('/api/system/export'),
    importBackup: (data: any) =>
      request<{ message: string; count: number }>('/api/system/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  email: {
    getLogs: (projectId?: string) =>
      request<{ logs: EmailLogItem[] }>(`/api/email/logs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
    searchDirectory: (q: string) =>
      request<{ users: User[] }>(`/api/email/directory?q=${encodeURIComponent(q)}`),
    getSettings: () => request<{ settings: EmailSettings }>('/api/email/settings'),
    saveSettings: (settings: Partial<EmailSettings>) =>
      request<{ message: string; settings: EmailSettings }>('/api/email/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
    sendTest: (to?: string, recipientName?: string, payload?: { provider?: string; smtp?: any; graph?: any }) =>
      request<{ success: boolean; message: string; result: any }>('/api/email/test', {
        method: 'POST',
        body: JSON.stringify({ to, recipientName, ...payload }),
      }),
    resend: (id: string) =>
      request<{ success: boolean; status: string; error?: string }>(`/api/email/resend/${id}`, {
        method: 'POST',
      }),
    sendProjectUpdate: (
      projectId: string,
      payload: { recipients?: (string | { email: string; name?: string })[]; customNote?: string }
    ) =>
      request<{ success: boolean; message: string; results: any[] }>('/api/email/send-project-update', {
        method: 'POST',
        body: JSON.stringify({ projectId, ...payload }),
      }),
    tagAndComment: (payload: {
      projectId: string;
      entityType?: 'Task' | 'Stage' | 'Milestone' | 'Issue' | 'Update' | 'General';
      entityId?: string;
      entityTitle?: string;
      entityContext?: string;
      taggedUserIds: string[];
      comment?: string;
      authorName?: string;
      authorEmail?: string;
    }) =>
      request<{
        success: boolean;
        message: string;
        recipients: Array<{
          userId: string;
          userName: string;
          email: string;
          status: string;
          id?: string;
          error?: string;
        }>;
      }>('/api/email/tag-and-comment', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
};
