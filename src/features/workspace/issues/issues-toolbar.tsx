import { Search } from 'lucide-react';
import type { IssueFilter, IssueScope, PortfolioIssueCounts } from './types';

type IssuesToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  scope: IssueScope;
  onScopeChange: (scope: IssueScope) => void;
  filter: IssueFilter;
  onFilterChange: (filter: IssueFilter) => void;
  portfolioCounts: PortfolioIssueCounts;
  projectCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

/** Search, project-scope toggle, status tabs, and expand/collapse controls for the issues register. */
export function IssuesToolbar({
  search,
  onSearchChange,
  scope,
  onScopeChange,
  filter,
  onFilterChange,
  portfolioCounts,
  projectCount,
  onExpandAll,
  onCollapseAll,
}: IssuesToolbarProps) {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by project, code, lead, issue title or owner..."
            className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
          />
        </label>

        {/* Project View Scope Toggle */}
        <div className="flex rounded-xl border border-border bg-background p-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onScopeChange('with-issues')}
            className={`rounded-lg px-3 py-1.5 transition ${
              scope === 'with-issues'
                ? 'bg-[#173e49] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Projects with issues ({portfolioCounts.projectsWithIssues})
          </button>
          <button
            type="button"
            onClick={() => onScopeChange('all')}
            className={`rounded-lg px-3 py-1.5 transition ${
              scope === 'all' ? 'bg-[#173e49] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All projects ({projectCount})
          </button>
        </div>
      </div>

      {/* Issue Status Tabs & Quick Expand/Collapse Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['All', 'Critical', 'Open', 'Resolved'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onFilterChange(tab)}
              className={`rounded-xl px-3.5 py-2 text-[11px] font-bold transition ${
                filter === tab
                  ? 'bg-[#173e49] text-white'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab === 'Critical' ? 'Critical (High)' : tab}
              <span className="ml-1.5 font-mono text-[9px] opacity-70">
                (
                {tab === 'All'
                  ? portfolioCounts.total
                  : tab === 'Critical'
                    ? portfolioCounts.critical
                    : tab === 'Open'
                      ? portfolioCounts.open
                      : portfolioCounts.resolved}
                )
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
          <button
            type="button"
            onClick={onExpandAll}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted hover:text-foreground"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted hover:text-foreground"
          >
            Collapse all
          </button>
        </div>
      </div>
    </div>
  );
}
