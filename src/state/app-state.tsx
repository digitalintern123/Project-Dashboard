import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type Health,
  type Milestone,
  type Phase,
  type Project,
  type ProjectIssue,
  type ProjectStatus,
  type ProjectUpdate,
  type SitePhoto,
  type PhotoCategory,
} from '@/data/projects';
import { removeItem } from '@/lib/storage';
import { todayLabel } from '@/lib/date';
import { getUserById, users as defaultUsers, type User } from '@/data/users';
import { api, onUnauthorized, type NotificationItem } from '@/lib/api';
import { calculateWeightedProgress, sortProjectsIncompleteFirst } from '@/lib/calculations';

export type AppRole = 'hod' | 'lead' | 'coordinator';
export type AuthUser = User;
export type DemoUser = AuthUser;

const EDITOR_ROLES: readonly AppRole[] = ['lead', 'coordinator'];

type AppStateValue = {
  role: AppRole | null;
  user: AuthUser | null;
  projects: Project[];
  canEdit: boolean;
  canEditProject: (projectOrId: Project | string) => boolean;
  isConnected: boolean;
  notifications: NotificationItem[];
  unreadNotifCount: number;
  leads: User[];
  users: User[];
  resolveUser: (id: string | undefined | null) => User | undefined;
  refreshUsers: () => Promise<void>;
  refreshLeads: () => Promise<void>;
  createLead: (data: { name: string; email: string; password: string; title?: string }) => Promise<{ success: boolean; error?: string; lead?: User }>;
  allotProject: (projectId: string, leadId: string) => Promise<{ success: boolean; error?: string }>;
  /** False until the stored session has been checked with the server. */
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProjects: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  approveMilestone: (projectId: string, milestoneId: string, status: 'Approved' | 'Rejected') => Promise<boolean>;
  completeMilestone: (projectId: string, milestoneId: string) => Promise<boolean>;
  updateProject: (id: string, patch: Partial<Project>) => boolean;
  updatePhase: (id: string, phaseIndex: number, patch: Partial<Phase>) => boolean;
  addPhase: (id: string, phase: Phase) => boolean;
  removePhase: (id: string, phaseIndex: number) => boolean;
  movePhase: (id: string, phaseIndex: number, direction: -1 | 1) => boolean;
  addProject: (project: Project) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  addMilestone: (id: string, milestone: Milestone) => boolean;
  updateMilestone: (id: string, milestoneIndex: number, patch: Partial<Milestone>) => boolean;
  addIssue: (id: string, issue: ProjectIssue) => boolean;
  updateIssue: (id: string, issueIndex: number, patch: Partial<ProjectIssue>) => boolean;
  addUpdate: (id: string, update: ProjectUpdate) => boolean;
  addPhoto: (
    projectId: string,
    photo: {
      fileData?: string;
      fileName?: string;
      url?: string;
      caption: string;
      stage?: string;
      category?: PhotoCategory;
      takenDate?: string;
    }
  ) => Promise<SitePhoto | null>;
  addMultiplePhotos: (
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
  ) => Promise<SitePhoto[]>;
  deletePhoto: (projectId: string, photoId: string) => Promise<boolean>;
  resetProjects: () => Promise<void>;
  restoreAllPdfs: () => Promise<{ success: boolean; count?: number; error?: string }>;
  exportBackup: () => Promise<void>;
  importBackup: (fileOrJson: string | object) => Promise<{ success: boolean; count?: number; error?: string }>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

const ROLE_KEY = 'encalm-projects-role-v1';

// Nuclear purge of all legacy browser-side project caches so SQLite database is the sole authority
if (typeof window !== 'undefined') {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('encalm-projects') || k.includes('project'))) {
        const val = localStorage.getItem(k) || '';
        if (val.includes('Goa Business Hotel') || k.includes('data') || k.includes('backup') || k.includes('storage')) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  [
    'encalm-projects-data-v1',
    'encalm-projects-data-v2',
    'encalm-projects-storage-v2',
    'encalm-projects-backup-v2',
    'encalm-projects-permanent-backup-v1',
  ].forEach((key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  });
}

function normaliseProject(project: Project): Project {
  const phases = (project.phases ?? []).map((phase, index) => {
    const rawName = phase.name || '';
    const normalisedName =
      rawName === 'Build & install' || rawName === 'Build and install' || rawName === 'Build & installation'
        ? 'Execution'
        : rawName;
    return {
      ...phase,
      id: phase.id ?? `${project.id}-phase-${index}`,
      name: normalisedName,
      weight: typeof phase.weight === 'number' ? phase.weight : undefined,
      taggedUsers: phase.taggedUsers ?? [],
    };
  });
  const calculatedProgress =
    phases.length > 0
      ? calculateWeightedProgress(phases).overallProgress
      : (project.progress ?? 0);
  const status: ProjectStatus = project.status || 'Yet to start';
  const normalisedHealth: Health =
    (project.health === 'Not started' || !project.health) && calculatedProgress > 0
      ? 'On track'
      : (project.health || 'Not started');

  return {
    ...project,
    progress: calculatedProgress,
    status,
    health: normalisedHealth,
    phases,
    milestones: (project.milestones ?? []).map((milestone, index) => ({
      ...milestone,
      id: (milestone as any).id ?? `${project.id}-milestone-${index}`,
      approvalStatus:
        milestone.approvalStatus ?? (milestone.approvalRequired ? 'Pending' : 'Not required'),
      taggedUsers: milestone.taggedUsers ?? [],
    })),
    issues: (project.issues ?? []).map((issue, index) => ({
      ...issue,
      id: issue.id ?? `${project.id}-issue-${index}`,
      category: issue.category ?? 'Other',
      status: issue.status ?? 'Open',
      dateRaised: issue.dateRaised ?? issue.issueAriseDate ?? project.lastUpdated ?? todayLabel(),
      issueAriseDate: issue.issueAriseDate ?? issue.dateRaised ?? project.lastUpdated ?? todayLabel(),
      dueDate: issue.dueDate ?? issue.targetClosureDate,
      targetClosureDate: issue.targetClosureDate ?? issue.dueDate,
      taggedUsers: issue.taggedUsers ?? [],
    })),
    updates: (project.updates ?? []).map((update) => ({
      ...update,
      kind: update.kind ?? 'General',
    })),
    photos: project.photos ?? [],
  };
}

function isProjectLike(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Project>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.phases) &&
    Array.isArray(candidate.milestones) &&
    Array.isArray(candidate.issues) &&
    Array.isArray(candidate.updates)
  );
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Role and user always come from the server session, never from browser storage.
  const [role, setRole] = useState<AppRole | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [projectState, setProjectState] = useState<Project[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [leads, setLeads] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(() => [...defaultUsers]);

  // Clear the role hint older versions stored; it is no longer trusted or used.
  useEffect(() => {
    removeItem(ROLE_KEY);
  }, []);

  // Fetch full project list from backend database (server is the sole source of truth)
  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.projects.getAll();
      if (Array.isArray(data.projects)) {
        setProjectState(data.projects.map(normaliseProject));
        setIsConnected(true);
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  // Fetch notifications from backend
  const refreshNotifications = useCallback(async () => {
    try {
      const data = await api.notifications.getAll();
      setNotifications(data.notifications || []);
      setUnreadNotifCount(data.unreadCount || 0);
    } catch {
      // Offline fallback
    }
  }, []);

  // Fetch leads list from backend
  const refreshLeads = useCallback(async () => {
    try {
      const data = await api.auth.getLeads();
      if (Array.isArray(data.leads)) {
        setLeads(data.leads);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  // Fetch complete directory users from backend (local accounts + directory stakeholders)
  const refreshUsers = useCallback(async () => {
    try {
      const data = await api.auth.getUsers();
      if (Array.isArray(data.users) && data.users.length > 0) {
        setAllUsers((prev) => {
          const map = new Map<string, User>();
          defaultUsers.forEach((u) => map.set(u.id, u));
          prev.forEach((u) => map.set(u.id, u));
          data.users.forEach((u) => {
            const existing = map.get(u.id);
            map.set(u.id, existing ? { ...existing, ...u } : u);
          });
          return Array.from(map.values());
        });
      }
    } catch {
      // Offline fallback
    }
  }, []);

  // Fast resolver for any userId (handles local, leads, and azure- IDs)
  const resolveUser = useCallback(
    (id: string | undefined | null): User | undefined => {
      if (!id) return undefined;
      return (
        allUsers.find((u) => u.id === id) ||
        getUserById(id) ||
        leads.find((l) => l.id === id)
      );
    },
    [allUsers, leads],
  );

  const createLead = useCallback(
    async (data: { name: string; email: string; password: string; title?: string }) => {
      try {
        const res = await api.auth.createLead(data);
        await refreshLeads();
        await refreshUsers();
        return { success: true, lead: res.lead };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to create lead' };
      }
    },
    [refreshLeads, refreshUsers],
  );

  const allotProject = useCallback(
    async (projectId: string, leadId: string) => {
      try {
        const res = await api.projects.allot(projectId, leadId);
        setProjectState((prev) =>
          prev.map((p) => (p.id === projectId ? normaliseProject(res.project) : p)),
        );
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to allot project' };
      }
    },
    [],
  );

  const clearSession = useCallback(() => {
    setRole(null);
    setUser(null);
  }, []);

  // Any 401 from the API means the session is gone: return to the login screen.
  useEffect(() => {
    onUnauthorized(() => {
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
        window.history.replaceState(null, '', `${import.meta.env.BASE_URL.replace(/\/$/, '')}/login`);
      }
    });
    return () => onUnauthorized(null);
  }, [clearSession]);

  // Restore an existing session on load.
  useEffect(() => {
    const restoreSession = async () => {
      // The session cookie is httpOnly, so ask the server who we are. An expired
      // access token is refreshed transparently by the API client.
      try {
        const authData = await api.auth.me();
        if (authData.user) {
          setUser(authData.user);
          setRole(authData.user.role);
        }
      } catch {
        clearSession();
      }
      setAuthReady(true);
    };
    restoreSession();
  }, [clearSession]);

  const sessionActive = role !== null && !user?.mustChangePassword;

  // Load data once signed in, then poll for updates.
  useEffect(() => {
    if (!sessionActive) return;
    refreshProjects();
    refreshNotifications();
    refreshLeads();
    refreshUsers();

    const interval = setInterval(() => {
      refreshProjects();
      refreshNotifications();
      refreshLeads();
      refreshUsers();
    }, 15000);

    return () => clearInterval(interval);
  }, [sessionActive, refreshProjects, refreshNotifications, refreshLeads, refreshUsers]);

  const canEdit = role !== null && EDITOR_ROLES.includes(role);

  const canEditProject = useCallback(
    (projectOrId: Project | string): boolean => {
      if (!role) return false;
      if (role === 'coordinator') return true;
      if (role === 'hod') return false;
      if (role === 'lead') {
        const target =
          typeof projectOrId === 'string'
            ? projectState.find((p) => p.id === projectOrId)
            : projectOrId;
        if (!target) return false;
        return !target.leadId || target.leadId === user?.id;
      }
      return false;
    },
    [role, user?.id, projectState],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await api.auth.login(email.trim().toLowerCase(), password);
        setUser(result.user);
        setRole(result.user.role);
        setIsConnected(true);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Login failed' };
      }
    },
    [],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await api.auth.changePassword(currentPassword, newPassword);
        setUser(result.user);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to change password' };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    api.auth.logout().catch(() => {});
    clearSession();
  }, [clearSession]);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    try {
      await api.notifications.markRead(id);
    } catch {
      // Silently ignore
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotifCount(0);
    try {
      await api.notifications.markAllRead();
    } catch {
      // Silently ignore
    }
  }, []);

  // Mutator wrapper for optimistic updates + backend sync
  const mutate = useCallback(
    (updater: (projects: Project[]) => Project[]): boolean => {
      if (!canEdit) return false;
      setProjectState(updater);
      return true;
    },
    [canEdit],
  );

  const patchById = useCallback(
    (id: string, transform: (project: Project) => Project): boolean => {
      if (!canEditProject(id)) return false;
      return mutate((projects) =>
        projects.map((project) => (project.id === id ? transform(project) : project)),
      );
    },
    [canEditProject, mutate],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>): boolean => {
      const ok = patchById(id, (project) => {
        const newProgress = patch.progress !== undefined ? patch.progress : project.progress;
        const autoHealth =
          patch.health !== undefined
            ? patch.health
            : (project.health === 'Not started' || !project.health) && newProgress > 0
            ? 'On track'
            : project.health;
        return {
          ...project,
          ...patch,
          status: patch.status !== undefined ? patch.status : project.status,
          health: autoHealth,
          lastUpdated: todayLabel(),
        };
      });

      if (ok) {
        api.projects.update(id, patch).catch((err) => {
          console.warn('Backend update failed:', err);
        });
      }
      return ok;
    },
    [patchById],
  );

  const updatePhase = useCallback(
    (id: string, phaseIndex: number, patch: Partial<Phase>): boolean => {
      const targetProject = projectState.find((p) => p.id === id);
      const phase = targetProject?.phases[phaseIndex];
      const phaseId = phase?.id || `${id}-phase-${phaseIndex}`;

      const ok = patchById(id, (project) => {
        if (phaseIndex < 0 || phaseIndex >= project.phases.length) return project;
        const newPhases = project.phases.map((p, index) =>
          index === phaseIndex ? { ...p, ...patch, updatedAt: todayLabel() } : p,
        );
        const { overallProgress } = calculateWeightedProgress(newPhases);
        const autoHealth =
          (project.health === 'Not started' || !project.health) && overallProgress > 0
            ? 'On track'
            : project.health;
        return {
          ...project,
          phases: newPhases,
          progress: overallProgress,
          health: autoHealth,
          lastUpdated: todayLabel(),
        };
      });

      if (ok && phaseId) {
        api.phases.update(id, phaseId, patch).then((res) => {
          if (res?.project) {
            patchById(id, () => normaliseProject(res.project));
          }
        }).catch(console.warn);
      }
      return ok;
    },
    [patchById, projectState],
  );

  const addPhase = useCallback(
    (id: string, phase: Phase): boolean => {
      const generatedId = phase.id ?? `${id}-phase-${Date.now()}`;
      const newPhase = { ...phase, id: generatedId };

      const ok = patchById(id, (project) => {
        const newPhases = [...project.phases, newPhase];
        const { overallProgress } = calculateWeightedProgress(newPhases);
        return {
          ...project,
          phases: newPhases,
          progress: overallProgress,
          lastUpdated: todayLabel(),
        };
      });

      if (ok) {
        api.phases.add(id, newPhase).then((res) => {
          if (res?.project) {
            patchById(id, () => normaliseProject(res.project));
          }
        }).catch(console.warn);
      }
      return ok;
    },
    [patchById],
  );

  const removePhase = useCallback(
    (id: string, phaseIndex: number): boolean => {
      const targetProject = projectState.find((p) => p.id === id);
      const phase = targetProject?.phases[phaseIndex];
      const phaseId = phase?.id;

      const ok = patchById(id, (project) => {
        if (project.phases.length <= 1) return project;
        if (phaseIndex < 0 || phaseIndex >= project.phases.length) return project;
        const newPhases = project.phases.filter((_, index) => index !== phaseIndex);
        const { overallProgress } = calculateWeightedProgress(newPhases);
        return {
          ...project,
          phases: newPhases,
          progress: overallProgress,
          lastUpdated: todayLabel(),
        };
      });

      if (ok && phaseId) {
        api.phases.delete(id, phaseId).then((res) => {
          if (res?.project) {
            patchById(id, () => normaliseProject(res.project));
          }
        }).catch(console.warn);
      }
      return ok;
    },
    [patchById, projectState],
  );

  const movePhase = useCallback(
    (id: string, phaseIndex: number, direction: -1 | 1): boolean => {
      const ok = patchById(id, (project) => {
        const targetIndex = phaseIndex + direction;
        if (phaseIndex < 0 || phaseIndex >= project.phases.length) return project;
        if (targetIndex < 0 || targetIndex >= project.phases.length) return project;
        const phases = [...project.phases];
        [phases[phaseIndex], phases[targetIndex]] = [phases[targetIndex], phases[phaseIndex]];
        const { overallProgress } = calculateWeightedProgress(phases);
        return { ...project, phases, progress: overallProgress, lastUpdated: todayLabel() };
      });

      if (ok) {
        api.phases.move(id, phaseIndex, direction).then((res) => {
          if (res?.project) {
            patchById(id, () => normaliseProject(res.project));
          }
        }).catch(console.warn);
      }
      return ok;
    },
    [patchById],
  );

  const addProject = useCallback(
    async (project: Project): Promise<boolean> => {
      const normalised = normaliseProject(project);
      setProjectState((projects) => {
        if (projects.some((existing) => existing.id === project.id)) return projects;
        return [normalised, ...projects];
      });

      try {
        const res = await api.projects.create(normalised);
        if (res?.project) {
          const saved = normaliseProject(res.project);
          setProjectState((projects) =>
            projects.map((p) => (p.id === project.id || p.id === saved.id ? saved : p)),
          );
        }
        await refreshNotifications();
        return true;
      } catch (err) {
        console.error('Backend project create failed:', err);
        await refreshProjects();
        return false;
      }
    },
    [refreshProjects, refreshNotifications],
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      setProjectState((prev) => prev.filter((p) => p.id !== id));
      try {
        await api.projects.delete(id);
        await refreshNotifications();
        return true;
      } catch (err) {
        console.error('Backend project delete failed:', err);
        await refreshProjects();
        return false;
      }
    },
    [refreshProjects, refreshNotifications],
  );

  const addMilestone = useCallback(
    (id: string, milestone: Milestone): boolean => {
      const ok = patchById(id, (project) => ({
        ...project,
        milestones: [...project.milestones, milestone],
        lastUpdated: todayLabel(),
      }));

      if (ok) {
        api.milestones.add(id, milestone).then((res) => {
          if (res?.project) {
            patchById(id, () => normaliseProject(res.project));
          }
        }).catch(console.warn);
      }
      return ok;
    },
    [patchById],
  );

  const updateMilestone = useCallback(
    (id: string, milestoneIndex: number, patch: Partial<Milestone>): boolean => {
      const targetProject = projectState.find((p) => p.id === id);
      const milestone = targetProject?.milestones[milestoneIndex];
      const milestoneId = (milestone as any)?.id || milestone?.title;

      const ok = patchById(id, (project) => {
        if (milestoneIndex < 0 || milestoneIndex >= project.milestones.length) return project;
        return {
          ...project,
          milestones: project.milestones.map((m, index) =>
            index === milestoneIndex ? { ...m, ...patch } : m,
          ),
          lastUpdated: todayLabel(),
        };
      });

      if (ok && milestoneId) {
        api.milestones.update(id, milestoneId, patch).then((res) => {
          if (res?.project) {
            patchById(id, () => normaliseProject(res.project));
          }
        }).catch(console.warn);
      }
      return ok;
    },
    [patchById, projectState],
  );

  const approveMilestone = useCallback(
    async (projectId: string, milestoneId: string, status: 'Approved' | 'Rejected'): Promise<boolean> => {
      // Governance approval is strictly reserved for Coordinator
      if (role !== 'coordinator') return false;

      setProjectState((projects) =>
        projects.map((project) => {
          if (project.id !== projectId) return project;
          return {
            ...project,
            milestones: project.milestones.map((m) =>
              (m as any).id === milestoneId || m.title === milestoneId
                ? { ...m, approvalStatus: status }
                : m,
            ),
          };
        }),
      );

      try {
        await api.milestones.update(projectId, milestoneId, { approvalStatus: status });
        refreshNotifications();
        return true;
      } catch {
        return false;
      }
    },
    [role, refreshNotifications],
  );

  const completeMilestone = useCallback(
    async (projectId: string, milestoneId: string): Promise<boolean> => {
      // Only the assigned project lead or coordinator can complete milestones
      if (!canEditProject(projectId)) return false;

      const today = new Date().toISOString().split('T')[0];
      setProjectState((projects) =>
        projects.map((project) => {
          if (project.id !== projectId) return project;
          return {
            ...project,
            milestones: project.milestones.map((m) =>
              (m as any).id === milestoneId || m.title === milestoneId
                ? { ...m, status: 'complete', completedDate: today }
                : m,
            ),
          };
        }),
      );

      try {
        await api.milestones.update(projectId, milestoneId, { status: 'complete', completedDate: today });
        refreshNotifications();
        return true;
      } catch {
        return false;
      }
    },
    [canEditProject, refreshNotifications],
  );

  const addIssue = useCallback(
    (id: string, issue: ProjectIssue): boolean => {
      const generatedId = issue.id ?? `${id}-issue-${Date.now()}`;
      const newIssue = { ...issue, id: generatedId };

      const ok = patchById(id, (project) => ({
        ...project,
        issues: [...project.issues, newIssue],
        lastUpdated: todayLabel(),
      }));

      if (ok) {
        api.issues.add(id, newIssue).catch(console.warn);
      }
      return ok;
    },
    [patchById],
  );

  const updateIssue = useCallback(
    (id: string, issueIndex: number, patch: Partial<ProjectIssue>): boolean => {
      const targetProject = projectState.find((p) => p.id === id);
      const issue = targetProject?.issues[issueIndex];
      const issueId = issue?.id;

      const ok = patchById(id, (project) => {
        if (issueIndex < 0 || issueIndex >= project.issues.length) return project;
        return {
          ...project,
          issues: project.issues.map((iss, index) =>
            index === issueIndex ? { ...iss, ...patch } : iss,
          ),
          lastUpdated: todayLabel(),
        };
      });

      if (ok && issueId) {
        api.issues.update(id, issueId, patch).catch(console.warn);
      }
      return ok;
    },
    [patchById, projectState],
  );

  const addUpdate = useCallback(
    (id: string, update: ProjectUpdate): boolean => {
      const ok = patchById(id, (project) => ({
        ...project,
        updates: [{ ...update, kind: update.kind ?? 'General' }, ...project.updates],
        lastUpdated: todayLabel(),
      }));

      if (ok) {
        api.updates.add(id, update).catch(console.warn);
      }
      return ok;
    },
    [patchById],
  );

  const addPhoto = useCallback(
    async (
      projectId: string,
      photoData: {
        fileData?: string;
        fileName?: string;
        url?: string;
        caption: string;
        stage?: string;
        category?: PhotoCategory;
        takenDate?: string;
      }
    ): Promise<SitePhoto | null> => {
      try {
        const res = await api.photos.upload(projectId, photoData);
        if (res && res.photo) {
          const newPhotos = res.photos || [res.photo];
          patchById(projectId, (p) => ({
            ...p,
            photos: [...newPhotos, ...(p.photos || []).filter((oldPh) => !newPhotos.some((np) => np.id === oldPh.id))],
            lastUpdated: todayLabel(),
          }));
          refreshNotifications();
          return res.photo;
        }
        return null;
      } catch (err) {
        console.error('Failed to upload photo:', err);
        throw err;
      }
    },
    [patchById, refreshNotifications],
  );

  const addMultiplePhotos = useCallback(
    async (
      projectId: string,
      photoList: Array<{
        fileData?: string;
        fileName?: string;
        url?: string;
        caption: string;
        stage?: string;
        category?: PhotoCategory;
        takenDate?: string;
      }>
    ): Promise<SitePhoto[]> => {
      try {
        const res = await api.photos.uploadBatch(projectId, photoList);
        if (res && res.photos && res.photos.length > 0) {
          patchById(projectId, (p) => ({
            ...p,
            photos: [...res.photos, ...(p.photos || []).filter((oldPh) => !res.photos.some((np) => np.id === oldPh.id))],
            lastUpdated: todayLabel(),
          }));
          refreshNotifications();
          return res.photos;
        }
        return [];
      } catch (err) {
        console.error('Failed to upload multiple photos:', err);
        throw err;
      }
    },
    [patchById, refreshNotifications],
  );

  const deletePhoto = useCallback(
    async (projectId: string, photoId: string): Promise<boolean> => {
      try {
        await api.photos.delete(projectId, photoId);
        patchById(projectId, (p) => ({
          ...p,
          photos: (p.photos || []).filter((ph) => ph.id !== photoId),
        }));
        return true;
      } catch (err) {
        console.error('Failed to delete photo:', err);
        return false;
      }
    },
    [patchById],
  );

  const exportBackup = useCallback(async () => {
    try {
      let exportData: any = null;
      try {
        exportData = await api.system.exportBackup();
      } catch {
        // Fallback to local state if server unreachable
        exportData = {
          version: 1,
          exportedAt: new Date().toISOString(),
          projectCount: projectState.length,
          projects: projectState,
          notifications,
        };
      }

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `encalm-portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export backup failed:', err);
    }
  }, [projectState, notifications]);

  const importBackup = useCallback(
    async (fileOrJson: string | object): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const payload = typeof fileOrJson === 'string' ? JSON.parse(fileOrJson) : fileOrJson;
        const rawProjects = Array.isArray(payload.projects) ? payload.projects : (Array.isArray(payload) ? payload : null);
        if (!rawProjects || rawProjects.length === 0) {
          return { success: false, error: 'No valid projects array found in backup data' };
        }

        const validProjects = rawProjects.filter(isProjectLike).map(normaliseProject);
        if (validProjects.length === 0) {
          return { success: false, error: 'File contains no recognisable project structures' };
        }

        // Try backend import first
        try {
          await api.system.importBackup({ projects: validProjects, notifications: payload.notifications || [] });
        } catch {
          // Fallback to bulk sync endpoint
          await api.projects.sync(validProjects).catch(console.warn);
        }

        // Immediately update state from server
        setProjectState(validProjects);

        await refreshProjects();
        await refreshNotifications();

        return { success: true, count: validProjects.length };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to import backup file' };
      }
    },
    [refreshProjects, refreshNotifications],
  );

  const resetProjects = useCallback(async () => {
    try {
      await api.system.reset();
      setProjectState([]);
      await refreshProjects();
      await refreshNotifications();
    } catch {
      // Local fallback reset
      setProjectState([]);
    }
  }, [refreshProjects, refreshNotifications]);

  const restoreAllPdfs = useCallback(async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
      const res = await api.system.restoreAllPdfs();
      await refreshProjects();
      await refreshNotifications();
      return { success: true, count: res.totalProjects };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to restore PDF master data' };
    }
  }, [refreshProjects, refreshNotifications]);

  const value = useMemo<AppStateValue>(
    () => ({
      role,
      user,
      projects: projectState,
      canEdit,
      canEditProject,
      isConnected,
      notifications,
      unreadNotifCount,
      leads,
      users: allUsers,
      resolveUser,
      refreshUsers,
      refreshLeads,
      createLead,
      allotProject,
      authReady,
      login,
      changePassword,
      logout,
      refreshProjects,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      approveMilestone,
      completeMilestone,
      updateProject,
      updatePhase,
      addPhase,
      removePhase,
      movePhase,
      addProject,
      deleteProject,
      addMilestone,
      updateMilestone,
      addIssue,
      updateIssue,
      addUpdate,
      addPhoto,
      addMultiplePhotos,
      deletePhoto,
      resetProjects,
      restoreAllPdfs,
      exportBackup,
      importBackup,
    }),
    [
      role,
      user,
      projectState,
      canEdit,
      canEditProject,
      isConnected,
      notifications,
      unreadNotifCount,
      leads,
      allUsers,
      resolveUser,
      refreshUsers,
      refreshLeads,
      createLead,
      allotProject,
      authReady,
      login,
      changePassword,
      logout,
      refreshProjects,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      approveMilestone,
      completeMilestone,
      updateProject,
      updatePhase,
      addPhase,
      removePhase,
      movePhase,
      addProject,
      deleteProject,
      addMilestone,
      updateMilestone,
      addIssue,
      updateIssue,
      addUpdate,
      addPhoto,
      addMultiplePhotos,
      deletePhoto,
      resetProjects,
      restoreAllPdfs,
      exportBackup,
      importBackup,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within an AppStateProvider');
  return context;
}
