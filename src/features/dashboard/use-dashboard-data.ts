import { useMemo } from 'react';
import type { Category, Health, Location, Project, ProjectStatus } from '@/data/projects';
import { sortProjectsIncompleteFirst } from '@/lib/calculations';
import { leadName } from '@/data/users';
import { buildHealthGradient, clampPercent } from './helpers';

export interface DashboardStats {
  total: number;
  onTrackCount: number;
  atRiskCount: number;
  delayedCount: number;
  notStartedCount: number;
  totalAop: number;
  averageProgress: number;
  locationCount: number;
  highPriorityCount: number;
}

export interface DashboardDataInput {
  projects: Project[];
  userId: string | undefined;
  query: string;
  location: 'All' | Location;
  category: 'All' | Category;
  health: 'All' | Health;
  status: 'All' | ProjectStatus;
}

export interface DashboardData {
  filteredProjects: Project[];
  stats: DashboardStats;
  atRisk: Project[];
  upcoming: Project[];
  myProjectCount: number;
  nearCompletionProject: Project | null;
  healthGradient: string;
}

/** Derives every memoised view of the portfolio the dashboard renders. */
export function useDashboardData({
  projects,
  userId,
  query,
  location,
  category,
  health,
  status,
}: DashboardDataInput): DashboardData {
  // `projects` was missing from these deps, so newly created or edited
  // projects never appeared until a full remount.
  const filteredProjects = useMemo(() => {
    const list = projects.filter((project) => {
      // Search covers name, location, category, code and lead — matching the
      // same fields the portfolio table under "All projects" searches.
      const haystack =
        `${project.name} ${project.location} ${project.category} ${project.code} ${leadName(project.leadId)}`.toLowerCase();
      return (
        haystack.includes(query.trim().toLowerCase()) &&
        (location === 'All' || project.location === location) &&
        (category === 'All' || project.category === category) &&
        (health === 'All' || project.health === health) &&
        (status === 'All' || (project.status || 'Yet to start') === status)
      );
    });
    return sortProjectsIncompleteFirst(list);
  }, [projects, query, location, category, health, status]);

  const stats = useMemo((): DashboardStats => {
    const total = projects.length;
    const onTrackCount = projects.filter((project) => project.health === 'On track').length;
    const atRiskCount = projects.filter((project) => project.health === 'At risk').length;
    const delayedCount = projects.filter((project) => project.health === 'Delayed').length;
    const notStartedCount = total - onTrackCount - atRiskCount - delayedCount;
    const totalAop = projects.reduce((sum, project) => sum + (Number.isFinite(project.aop) ? project.aop : 0), 0);
    // Guard the divide: an empty portfolio previously rendered "NaN%".
    const averageProgress = total
      ? Math.round(projects.reduce((sum, project) => sum + clampPercent(project.progress), 0) / total)
      : 0;
    const locationCount = new Set(projects.map((project) => project.location)).size;
    const highPriorityCount = projects.filter((project) =>
      project.issues.some((issue) => issue.severity === 'High'),
    ).length;
    return {
      total,
      onTrackCount,
      atRiskCount,
      delayedCount,
      notStartedCount,
      totalAop,
      averageProgress,
      locationCount,
      highPriorityCount,
    };
  }, [projects]);

  const atRisk = useMemo(
    () => projects.filter((project) => project.health === 'At risk' || project.health === 'Delayed'),
    [projects],
  );
  const upcoming = useMemo(
    () =>
      [...projects]
        .filter((project) => Boolean(project.nextMilestoneDate))
        .sort((a, b) => (a.nextMilestoneDate || '').localeCompare(b.nextMilestoneDate || ''))
        .slice(0, 4),
    [projects],
  );
  // "My projects" is keyed off the signed-in user's stable id (project.leadId),
  // never a display-name string comparison.
  const myProjectCount = useMemo(
    () => projects.filter((project) => project.leadId === userId).length,
    [projects, userId],
  );

  // Dynamically find project nearest completion (highest progress < 100% or highest progress)
  const nearCompletionProject = useMemo(() => {
    if (!projects.length) return null;
    const candidates = projects.filter((p) => p.progress > 0 && p.progress < 100);
    if (candidates.length === 0) return null;
    return candidates.reduce((highest, curr) => (curr.progress > highest.progress ? curr : highest), candidates[0]);
  }, [projects]);

  // The donut used to be a hardcoded gradient that did not track the data.
  const healthGradient = useMemo(() => buildHealthGradient(stats), [stats]);

  return { filteredProjects, stats, atRisk, upcoming, myProjectCount, nearCompletionProject, healthGradient };
}
