import type { IssueCategory, Project, ProjectIssue } from '@/data/projects';

export type IssueFilter = 'All' | 'Critical' | 'Open' | 'Resolved';

export type IssueScope = 'with-issues' | 'all';

export type IssueDraft = {
  title: string;
  detail: string;
  category: IssueCategory;
  severity: 'High' | 'Medium' | 'Low';
  stage: string;
  owner: string;
  dueDate: string;
  issueAriseDate: string;
  targetClosureDate: string;
  impactCost: string;
  impactSchedule: string;
  impactScope: string;
  action: string;
};

export type SetIssueDraftField = (key: keyof IssueDraft, value: string) => void;

/** An issue flattened with its owning project and its index in `project.issues`. */
export type IssueRow = ProjectIssue & { project: Project; issueIndex: number };

export type ProjectIssueSummary = {
  project: Project;
  allProjectIssues: IssueRow[];
  filteredIssues: IssueRow[];
  totalProjectIssuesCount: number;
  criticalCount: number;
  openCount: number;
  resolvedCount: number;
  projectMatchesSearch: boolean;
};

export type PortfolioIssueCounts = {
  total: number;
  critical: number;
  open: number;
  resolved: number;
  projectsWithIssues: number;
};

export type IssueStatusChangeHandler = (projectId: string, issueIndex: number, newStatus: string) => void;
