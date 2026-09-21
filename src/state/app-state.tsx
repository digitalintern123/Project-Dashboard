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
  projects as seedProjects,
  type Milestone,
  type Phase,
  type Project,
  type ProjectIssue,
  type ProjectUpdate,
} from '@/data/projects';
import { readJson, removeItem, writeJson } from '@/lib/storage';
import { todayLabel } from '@/lib/date';

export type AppRole = 'hod' | 'lead';

export type DemoUser = {
  name: string;
  email: string;
  role: AppRole;
  title: string;
  initials: string;
};

const demoUsers: Record<AppRole, DemoUser> = {
  hod: { name: 'Rhea Shah', email: 'hod@encalm.com', role: 'hod', title: 'Project HOD', initials: 'RS' },
  lead: { name: 'Arjun Mehta', email: 'lead@encalm.com', role: 'lead', title: 'Project Lead', initials: 'AM' },
};

/** Roles allowed to mutate project records. HODs have read-only access. */
const EDITOR_ROLES: readonly AppRole[] = ['lead'];

type AppStateValue = {
  role: AppRole | null;
  user: DemoUser | null;
  projects: Project[];
  /** True when the signed-in role may mutate project data. Gate edit UI on this. */
  canEdit: boolean;
  login: (role: AppRole) => void;
  logout: () => void;
  updateProject: (id: string, patch: Partial<Project>) => boolean;
  updatePhase: (id: string, phaseIndex: number, patch: Partial<Phase>) => boolean;
  addPhase: (id: string, phase: Phase) => boolean;
  removePhase: (id: string, phaseIndex: number) => boolean;
  movePhase: (id: string, phaseIndex: number, direction: -1 | 1) => boolean;
  addProject: (project: Project) => boolean;
  addMilestone: (id: string, milestone: Milestone) => boolean;
  addIssue: (id: string, issue: ProjectIssue) => boolean;
  updateIssue: (id: string, issueIndex: number, patch: Partial<ProjectIssue>) => boolean;
  addUpdate: (id: string, update: ProjectUpdate) => boolean;
  resetProjects: () => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);

const PROJECTS_KEY = 'encalm-projects-data-v2';
const ROLE_KEY = 'encalm-projects-role-v1';

/**
 * Brings a project record up to the current shape, filling fields that older
 * saved payloads predate. Applied to seed data and hydrated data alike, so both
 * paths produce identically shaped objects.
 */
function normaliseProject(project: Project): Project {
  return {
    ...project,
    phases: (project.phases ?? []).map((phase, index) => ({
      ...phase,
      id: phase.id ?? `${project.id}-phase-${index}`,
    })),
    milestones: (project.milestones ?? []).map((milestone) => ({
      ...milestone,
      approvalStatus:
        milestone.approvalStatus ?? (milestone.approvalRequired ? 'Pending' : 'Not required'),
    })),
    issues: (project.issues ?? []).map((issue, index) => ({
      ...issue,
      id: issue.id ?? `${project.id}-issue-${index}`,
      category: issue.category ?? 'Other',
      status: issue.status ?? 'Open',
      dateRaised: issue.dateRaised ?? project.lastUpdated ?? todayLabel(),
    })),
    updates: (project.updates ?? []).map((update) => ({
      ...update,
      kind: update.kind ?? 'General',
    })),
  };
}

/**
 * Structural check on hydrated data. A payload from an older build, or a
 * hand-edited localStorage value, must not be able to crash the app.
 */
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

function seedState(): Project[] {
  return seedProjects.map(normaliseProject);
}

function hydrateProjects(): Project[] {
  const saved = readJson<unknown>(PROJECTS_KEY);
  if (!Array.isArray(saved)) return seedState();

  const valid = saved.filter(isProjectLike);
  // A partially corrupt payload is worse than none: fall back wholesale.
  if (valid.length === 0 || valid.length !== saved.length) return seedState();

  return valid.map(normaliseProject);
}

function hydrateRole(): AppRole | null {
  const saved = readJson<unknown>(ROLE_KEY);
  return saved === 'hod' || saved === 'lead' ? saved : null;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(hydrateRole);
  const [projectState, setProjectState] = useState<Project[]>(hydrateProjects);

  useEffect(() => {
    writeJson(PROJECTS_KEY, projectState);
  }, [projectState]);

  useEffect(() => {
    if (role) writeJson(ROLE_KEY, role);
    else removeItem(ROLE_KEY);
  }, [role]);

  const canEdit = role !== null && EDITOR_ROLES.includes(role);

  /**
   * Every mutation funnels through here: the role check lives in one place, and
   * the boolean return lets callers surface a message rather than silently
   * appearing to succeed.
   */
  const mutate = useCallback(
    (updater: (projects: Project[]) => Project[]): boolean => {
      if (!canEdit) return false;
      setProjectState(updater);
      return true;
    },
    [canEdit],
  );

  const patchById = useCallback(
    (id: string, transform: (project: Project) => Project): boolean =>
      mutate((projects) =>
        projects.map((project) => (project.id === id ? transform(project) : project)),
      ),
    [mutate],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      role,
      user: role ? demoUsers[role] : null,
      projects: projectState,
      canEdit,

      login: (next: AppRole) => setRole(next),
      logout: () => setRole(null),

      updateProject: (id, patch) =>
        patchById(id, (project) => ({ ...project, ...patch, lastUpdated: todayLabel() })),

      updatePhase: (id, phaseIndex, patch) =>
        patchById(id, (project) => {
          if (phaseIndex < 0 || phaseIndex >= project.phases.length) return project;
          return {
            ...project,
            phases: project.phases.map((phase, index) =>
              index === phaseIndex ? { ...phase, ...patch } : phase,
            ),
            lastUpdated: todayLabel(),
          };
        }),

      addPhase: (id, phase) =>
        patchById(id, (project) => ({
          ...project,
          phases: [...project.phases, { ...phase, id: phase.id ?? `${id}-phase-${Date.now()}` }],
          lastUpdated: todayLabel(),
        })),

      removePhase: (id, phaseIndex) =>
        patchById(id, (project) => {
          // A project with no stages breaks the timeline and every stage picker.
          if (project.phases.length <= 1) return project;
          if (phaseIndex < 0 || phaseIndex >= project.phases.length) return project;
          return {
            ...project,
            phases: project.phases.filter((_, index) => index !== phaseIndex),
            lastUpdated: todayLabel(),
          };
        }),

      movePhase: (id, phaseIndex, direction) =>
        patchById(id, (project) => {
          const targetIndex = phaseIndex + direction;
          if (phaseIndex < 0 || phaseIndex >= project.phases.length) return project;
          if (targetIndex < 0 || targetIndex >= project.phases.length) return project;
          const phases = [...project.phases];
          [phases[phaseIndex], phases[targetIndex]] = [phases[targetIndex], phases[phaseIndex]];
          return { ...project, phases, lastUpdated: todayLabel() };
        }),

      addProject: (project) =>
        mutate((projects) => {
          // Duplicate ids make routing ambiguous and collide as React keys.
          if (projects.some((existing) => existing.id === project.id)) return projects;
          return [normaliseProject(project), ...projects];
        }),

      addMilestone: (id, milestone) =>
        patchById(id, (project) => ({
          ...project,
          milestones: [...project.milestones, milestone],
          lastUpdated: todayLabel(),
        })),

      addIssue: (id, issue) =>
        patchById(id, (project) => ({
          ...project,
          issues: [...project.issues, { ...issue, id: issue.id ?? `${id}-issue-${Date.now()}` }],
          lastUpdated: todayLabel(),
        })),

      updateIssue: (id, issueIndex, patch) =>
        patchById(id, (project) => {
          if (issueIndex < 0 || issueIndex >= project.issues.length) return project;
          return {
            ...project,
            issues: project.issues.map((issue, index) =>
              index === issueIndex ? { ...issue, ...patch } : issue,
            ),
            lastUpdated: todayLabel(),
          };
        }),

      addUpdate: (id, update) =>
        patchById(id, (project) => ({
          ...project,
          updates: [{ ...update, kind: update.kind ?? 'General' }, ...project.updates],
          lastUpdated: todayLabel(),
        })),

      // Discards the saved payload first; otherwise the persistence effect would
      // immediately rewrite what we are trying to clear.
      resetProjects: () => {
        removeItem(PROJECTS_KEY);
        setProjectState(seedState());
      },
    }),
    [projectState, role, canEdit, mutate, patchById],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within an AppStateProvider');
  return context;
}
