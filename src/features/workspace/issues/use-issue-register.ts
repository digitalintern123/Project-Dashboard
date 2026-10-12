import { useMemo } from 'react';
import type { Project } from '@/data/projects';
import { leadName } from '@/data/users';
import type { IssueFilter, IssueScope, PortfolioIssueCounts, ProjectIssueSummary } from './types';

/**
 * Derives the per-project issue summaries, portfolio counts, and the sorted list of
 * project cards shown on the issues register.
 */
export function useIssueRegister(
  projects: Project[],
  search: string,
  filter: IssueFilter,
  scope: IssueScope,
): { portfolioCounts: PortfolioIssueCounts; displayedProjects: ProjectIssueSummary[] } {
  // Aggregate and filter issues per project
  const projectIssueData = useMemo((): ProjectIssueSummary[] => {
    const term = search.trim().toLowerCase();

    return projects.map((project) => {
      const allProjectIssues = project.issues.map((issue, issueIndex) => ({
        ...issue,
        project,
        issueIndex,
      }));

      const filteredIssues = allProjectIssues.filter((issue) => {
        if (filter === 'Critical' && issue.severity !== 'High') return false;
        if (filter === 'Open' && (issue.status === 'Resolved' || issue.status === 'Closed')) return false;
        if (filter === 'Resolved' && issue.status !== 'Resolved' && issue.status !== 'Closed') return false;

        if (term) {
          const matchProject = `${project.name} ${project.code} ${project.location} ${leadName(project.leadId)}`
            .toLowerCase()
            .includes(term);
          const matchIssue =
            `${issue.title} ${issue.detail} ${issue.owner} ${issue.category ?? ''} ${issue.stage ?? ''}`
              .toLowerCase()
              .includes(term);
          if (!matchProject && !matchIssue) return false;
        }

        return true;
      });

      const totalProjectIssuesCount = project.issues.length;
      const criticalCount = project.issues.filter((i) => i.severity === 'High').length;
      const openCount = project.issues.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed').length;
      const resolvedCount = project.issues.filter((i) => i.status === 'Resolved' || i.status === 'Closed').length;

      const projectMatchesSearch = term
        ? `${project.name} ${project.code} ${project.location} ${leadName(project.leadId)}`.toLowerCase().includes(term)
        : true;

      return {
        project,
        allProjectIssues,
        filteredIssues,
        totalProjectIssuesCount,
        criticalCount,
        openCount,
        resolvedCount,
        projectMatchesSearch,
      };
    });
  }, [projects, search, filter]);

  // Portfolio-level summary counts
  const portfolioCounts = useMemo((): PortfolioIssueCounts => {
    let total = 0;
    let critical = 0;
    let open = 0;
    let resolved = 0;
    let projectsWithIssues = 0;

    for (const p of projects) {
      if (p.issues.length > 0) projectsWithIssues++;
      for (const i of p.issues) {
        total++;
        if (i.severity === 'High') critical++;
        if (i.status !== 'Resolved' && i.status !== 'Closed') open++;
        if (i.status === 'Resolved' || i.status === 'Closed') resolved++;
      }
    }
    return { total, critical, open, resolved, projectsWithIssues };
  }, [projects]);

  // Filter and sort project cards to display (incomplete facilities with issues first)
  const displayedProjects = useMemo(() => {
    const list = projectIssueData.filter((item) => {
      if (search.trim()) {
        return item.projectMatchesSearch || item.filteredIssues.length > 0;
      }
      if (scope === 'with-issues') {
        return item.filteredIssues.length > 0;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      // 1. Projects with matching issues come before projects with none
      if (a.filteredIssues.length > 0 && b.filteredIssues.length === 0) return -1;
      if (a.filteredIssues.length === 0 && b.filteredIssues.length > 0) return 1;

      // 2. Incomplete projects come before completed ones
      const aIncomplete = (a.project.progress ?? 0) < 100 && a.project.status !== 'Operational';
      const bIncomplete = (b.project.progress ?? 0) < 100 && b.project.status !== 'Operational';
      if (aIncomplete && !bIncomplete) return -1;
      if (!aIncomplete && bIncomplete) return 1;

      // 3. Higher critical count first
      if (b.criticalCount !== a.criticalCount) {
        return b.criticalCount - a.criticalCount;
      }

      return a.project.name.localeCompare(b.project.name);
    });
  }, [projectIssueData, search, scope]);

  return { portfolioCounts, displayedProjects };
}
