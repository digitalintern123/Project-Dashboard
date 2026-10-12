import type { Phase, Milestone, Project, ProjectIssue, ProjectUpdate, SitePhoto, PhotoCategory } from '@/data/projects';
import type { User } from '@/data/users';

// Sessions live in httpOnly cookies the browser sends automatically. Older
// versions kept a bearer token in localStorage; remove any leftover copy.
try {
  localStorage.removeItem('encalm-auth-token');
} catch {
  // Storage can be unavailable in restricted webviews.
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers the callback run when the session cannot be refreshed (HTTP 401). */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function send(path: string, options: RequestInit): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    // Required by the server's CSRF check on state-changing requests.
    'X-Requested-With': 'XMLHttpRequest',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  return fetch(url, { ...options, headers, credentials: 'include' });
}

// One refresh at a time: concurrent 401s all wait on the same attempt.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = send('/api/auth/refresh', { method: 'POST' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await send(path, options);

  // Access token expired: refresh once and retry; if that fails the session is over.
  if (response.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      response = await send(path, options);
    }
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export type PhotoUploadInput = {
  file: File;
  caption: string;
  stage?: string;
  category?: PhotoCategory;
  takenDate?: string;
};

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
      request<{ user: User }>('/api/auth/login', {
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
    logoutAll: () => request<{ message: string }>('/api/auth/logout-all', { method: 'POST' }),
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
    /** Uploads one or more photos as multipart/form-data (field "photos" plus a "meta" JSON array). */
    upload: (projectId: string, items: PhotoUploadInput[]) => {
      const form = new FormData();
      for (const item of items) form.append('photos', item.file, item.file.name);
      form.append(
        'meta',
        JSON.stringify(items.map(({ caption, stage, category, takenDate }) => ({ caption, stage, category, takenDate }))),
      );
      return request<{ message: string; photos: SitePhoto[]; photo: SitePhoto; project: Project }>(
        `/api/projects/${encodeURIComponent(projectId)}/photos`,
        { method: 'POST', body: form },
      );
    },
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
