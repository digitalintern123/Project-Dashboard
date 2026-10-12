import { Link } from 'wouter';
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronUp, Plus, ShieldAlert } from 'lucide-react';
import { healthTone, statusTone } from '@/lib/tones';
import { leadName } from '@/data/users';
import { IssueForm } from './issue-form';
import { IssueSeverityGroup } from './issue-severity-group';
import type {
  IssueDraft,
  IssueFilter,
  IssueStatusChangeHandler,
  ProjectIssueSummary,
  SetIssueDraftField,
} from './types';

type ProjectIssuesCardProps = {
  item: ProjectIssueSummary;
  filter: IssueFilter;
  expanded: boolean;
  isAdding: boolean;
  canEdit: boolean;
  draft: IssueDraft;
  onToggle: () => void;
  onOpenAddForm: () => void;
  onDraftFieldChange: SetIssueDraftField;
  onSaveNewIssue: () => void;
  onCancelAdd: () => void;
  onStatusChange: IssueStatusChangeHandler;
};

/** A collapsible project card listing that project's issues and risks, with an inline "log issue" form. */
export function ProjectIssuesCard({
  item,
  filter,
  expanded,
  isAdding,
  canEdit,
  draft,
  onToggle,
  onOpenAddForm,
  onDraftFieldChange,
  onSaveNewIssue,
  onCancelAdd,
  onStatusChange,
}: ProjectIssuesCardProps) {
  const { project, filteredIssues } = item;
  const highSeverityIssues = filteredIssues.filter((i) => i.severity === 'High');
  const standardIssues = filteredIssues.filter((i) => i.severity !== 'High');

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-[#d9c585]">
      {/* Project Header Bar */}
      {/* Clicking anywhere on the header is a mouse shortcut; keyboard and screen-reader
          users use the expand/collapse button inside it. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center bg-card hover:bg-[#fcf5e5]/50 transition cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={expanded ? 'Collapse project' : 'Expand project'}
            className="mt-1 grid size-7 place-items-center rounded-lg border border-border bg-background text-muted-foreground"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/project/${project.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[14px] font-extrabold text-foreground hover:text-[#2e7c67] hover:underline"
              >
                {project.name}
              </Link>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}
              >
                {project.status || 'Yet to start'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${healthTone[project.health]}`}>
                {project.health}
              </span>
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
              {project.code} · {project.location} · {project.category} · Lead: {leadName(project.leadId)}
            </p>
          </div>
        </div>

        {/* Right Header Metrics & Actions */}
        {/* Stops clicks on these controls from also toggling the header (see above). */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            {item.criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fae5e1] px-2.5 py-1 font-bold text-[#b2473d]">
                <ShieldAlert size={11} /> {item.criticalCount} Critical
              </span>
            )}
            {item.openCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f8edcf] px-2.5 py-1 font-bold text-[#9a711f]">
                <AlertTriangle size={11} /> {item.openCount} Open
              </span>
            )}
            <span className="rounded-full bg-[#eef0ed] px-2.5 py-1 font-bold text-muted-foreground">
              {item.totalProjectIssuesCount} {item.totalProjectIssuesCount === 1 ? 'issue' : 'issues'}
            </span>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={onOpenAddForm}
              className="inline-flex items-center gap-1 rounded-xl bg-[#d6a95d] px-3 py-1.5 text-[10px] font-bold text-[#173e49] hover:bg-[#e2bd73]"
            >
              <Plus size={12} /> Log issue
            </button>
          )}

          <Link
            href={`/project/${project.id}`}
            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-muted-foreground hover:text-foreground"
          >
            View project <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Sub-Section: Issues and Risks within Project */}
      {expanded && (
        <div className="border-t border-border/70 bg-[#fbfaf6]/70 p-5 md:p-6">
          {/* Inline Form to Add an Issue to this specific Project */}
          {isAdding && (
            <IssueForm
              project={project}
              draft={draft}
              onFieldChange={onDraftFieldChange}
              onSave={onSaveNewIssue}
              onCancel={onCancelAdd}
            />
          )}

          {filteredIssues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white/70 p-6 text-center">
              <p className="text-[11px] text-muted-foreground">
                No issues or risks matching "{filter}" for {project.name}.
              </p>
              {canEdit && !isAdding && (
                <button
                  type="button"
                  onClick={onOpenAddForm}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#eadcb1] bg-[#fff8e9] px-3 py-1.5 text-[10px] font-bold text-[#9a711f]"
                >
                  <Plus size={11} /> Log an issue for this project
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sub-Section 1: Critical Issues (High Severity) */}
              {highSeverityIssues.length > 0 && (
                <IssueSeverityGroup
                  variant="critical"
                  projectId={project.id}
                  issues={highSeverityIssues}
                  canEdit={canEdit}
                  onStatusChange={onStatusChange}
                />
              )}

              {/* Sub-Section 2: Standard Issues & Risks (Medium / Low Severity) */}
              {standardIssues.length > 0 && (
                <IssueSeverityGroup
                  variant="standard"
                  projectId={project.id}
                  issues={standardIssues}
                  canEdit={canEdit}
                  onStatusChange={onStatusChange}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
