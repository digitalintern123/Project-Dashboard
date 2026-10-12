import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { IssueCard, type IssueCardVariant } from './issue-card';
import type { IssueRow, IssueStatusChangeHandler } from './types';

type IssueSeverityGroupProps = {
  variant: IssueCardVariant;
  projectId: string;
  issues: IssueRow[];
  canEdit: boolean;
  onStatusChange: IssueStatusChangeHandler;
};

/**
 * A titled group of issue cards: "critical" lists High severity issues, "standard"
 * lists Medium / Low severity issues and risks.
 */
export function IssueSeverityGroup({ variant, projectId, issues, canEdit, onStatusChange }: IssueSeverityGroupProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {variant === 'critical' ? (
          <>
            <span className="grid size-6 place-items-center rounded-lg bg-[#fae5e1] text-[#b2473d]">
              <ShieldAlert size={14} />
            </span>
            <h4 className="text-[12px] font-extrabold text-[#b2473d] uppercase tracking-[.06em]">
              Critical Issues & Blockers ({issues.length})
            </h4>
          </>
        ) : (
          <>
            <span className="grid size-6 place-items-center rounded-lg bg-[#f8edcf] text-[#9a711f]">
              <AlertTriangle size={14} />
            </span>
            <h4 className="text-[12px] font-extrabold text-[#9a711f] uppercase tracking-[.06em]">
              Standard Issues & Risks ({issues.length})
            </h4>
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {issues.map((issue) => (
          <IssueCard
            key={`${projectId}-${issue.id ?? issue.title}-${issue.issueIndex}`}
            variant={variant}
            issue={issue}
            projectId={projectId}
            canEdit={canEdit}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}
