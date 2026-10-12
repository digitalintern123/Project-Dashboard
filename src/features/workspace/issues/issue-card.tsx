import { getIssueStatusTheme, issueStatusOptions } from '@/lib/issue-theme';
import type { IssueRow, IssueStatusChangeHandler } from './types';

export type IssueCardVariant = 'critical' | 'standard';

/** Impact chip classes differ only in colour between critical and standard issues. */
const impactChipClass: Record<IssueCardVariant, string> = {
  critical: 'rounded-md bg-white/90 px-2 py-0.5 font-mono text-[#b2473d] border border-border/60',
  standard: 'rounded-md bg-white/90 px-2 py-0.5 font-mono text-[#9a711f] border border-border/70',
};

const actionChipClass: Record<IssueCardVariant, string> = {
  critical: 'rounded-md bg-white/90 px-2 py-0.5 text-muted-foreground border border-border',
  standard: 'rounded-md bg-white/90 px-2 py-0.5 text-muted-foreground border border-border/70',
};

type IssueCardProps = {
  variant: IssueCardVariant;
  issue: IssueRow;
  projectId: string;
  canEdit: boolean;
  onStatusChange: IssueStatusChangeHandler;
};

/** A single issue or risk card within a project's issue register. */
export function IssueCard({ variant, issue, projectId, canEdit, onStatusChange }: IssueCardProps) {
  const statusTheme =
    variant === 'critical'
      ? getIssueStatusTheme(issue.status, 'High')
      : getIssueStatusTheme(issue.status, issue.severity || 'Medium');

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-colors duration-200 ${statusTheme.cardClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {variant === 'critical' ? (
              <span className="rounded-full bg-[#fae5e1] px-2 py-0.5 font-mono text-[8px] uppercase font-bold text-[#b2473d]">
                High Severity
              </span>
            ) : (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase font-bold ${
                  issue.severity === 'Medium' ? 'bg-[#f8edcf] text-[#9a711f]' : 'bg-[#eef0ed] text-muted-foreground'
                }`}
              >
                {issue.severity || 'Medium'} Severity
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase font-bold ${statusTheme.badgeClass}`}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: statusTheme.dotColor }} />
              {issue.status || 'Open'}
            </span>
            {issue.category && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] text-muted-foreground border border-border/70">
                {issue.category}
              </span>
            )}
            {issue.stage && (
              <span className="font-mono text-[9px] text-muted-foreground">
                Stage: <strong className="text-foreground">{issue.stage}</strong>
              </span>
            )}
          </div>
          <h5 className="mt-2 text-[12px] font-bold text-foreground">{issue.title}</h5>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{issue.detail}</p>

      {(issue.impactSchedule || issue.impactCost || issue.impactScope || issue.action) && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-2 text-[10px]">
          {issue.impactSchedule && <span className={impactChipClass[variant]}>Schedule: {issue.impactSchedule}</span>}
          {issue.impactCost && <span className={impactChipClass[variant]}>Cost: {issue.impactCost}</span>}
          {issue.action && (
            <span className={actionChipClass[variant]}>
              Action: <strong className="text-foreground">{issue.action}</strong>
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 font-mono text-[9px]">
        <div className="text-muted-foreground">
          <span>
            Owner: <strong className="text-foreground">{issue.owner || 'Unassigned'}</strong>
          </span>
          {(issue.targetClosureDate || issue.dueDate) && (
            <span className="ml-2">
              Target: <strong className="text-foreground">{issue.targetClosureDate || issue.dueDate}</strong>
            </span>
          )}
        </div>

        {canEdit ? (
          <select
            value={issue.status || 'Open'}
            onChange={(e) => onStatusChange(projectId, issue.issueIndex, e.target.value)}
            className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer transition-colors shadow-sm ${statusTheme.selectClass}`}
          >
            {issueStatusOptions.map((opt) => (
              <option key={opt.status} value={opt.status} className="bg-white text-foreground">
                {opt.prefix} {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={`rounded-full px-2 py-0.5 font-bold ${statusTheme.badgeClass}`}>
            {issue.status || 'Open'}
          </span>
        )}
      </div>
    </div>
  );
}
