import { useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import {
  formatShortDate,
  issueCategories,
  type IssueCategory,
  type IssueStatus,
  type Project,
  type ProjectIssue,
} from '@/data/projects';
import { todayLabel } from '@/lib/date';
import { TagUserPopover } from '@/components/tag-user-popover';
import { getIssueStatusTheme, issueStatusOptions } from '@/lib/issue-theme';
import { DetailCard } from '../ui';

export function StageIssuesPanel({
  project,
  editable,
  canTag = true,
  onAdd,
  onUpdate,
}: {
  project: Project;
  editable: boolean;
  canTag?: boolean;
  onAdd: (issue: ProjectIssue) => void;
  onUpdate: (index: number, patch: Partial<ProjectIssue>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    detail: '',
    category: 'Design' as IssueCategory,
    severity: 'Medium' as ProjectIssue['severity'],
    stage: project.phases.find((phase) => phase.status === 'active')?.name ?? project.phases[0]?.name ?? '',
    owner: '',
    issueAriseDate: todayLabel(),
    targetClosureDate: '',
    dueDate: '',
    impactCost: '',
    impactSchedule: '',
    impactScope: '',
    action: '',
  });
  const set = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <DetailCard title="Issues & risks" eyebrow="Decision radar" icon={ShieldAlert} tone="gold">
      <div className="mt-5 space-y-3">
        {project.issues.length ? (
          project.issues.map((issue, index) => {
            const ariseDate = issue.issueAriseDate || issue.dateRaised;
            const closureDate = issue.targetClosureDate || issue.dueDate;
            const statusTheme = getIssueStatusTheme(issue.status, issue.severity);
            const StatusIcon = statusTheme.icon;

            return (
              <div
                key={`${issue.id ?? issue.title}-${index}`}
                className={`rounded-xl border p-3.5 transition-colors duration-200 ${statusTheme.cardClass}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg transition-colors ${statusTheme.iconBoxClass}`}
                    title={statusTheme.description}
                  >
                    <StatusIcon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold">{issue.title}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${statusTheme.badgeClass}`}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: statusTheme.dotColor }} />
                          {issue.status ?? 'Open'}
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-[.1em] text-muted-foreground">
                          {issue.severity} · Category: {issue.category ?? 'Other'}
                        </span>
                      </div>
                    </span>
                    <span className="mt-1.5 block text-[10px] leading-4 text-muted-foreground">{issue.detail}</span>
                    <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                      <span className="rounded-full bg-white px-2 py-1">{issue.stage ?? 'General project issue'}</span>
                      <span className="rounded-full bg-white px-2 py-1">Owner · {issue.owner}</span>
                      {ariseDate && (
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-[#8b631d]">
                          Issue Arise Date: {formatShortDate(ariseDate)}
                        </span>
                      )}
                      {closureDate && (
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-[#173e49]">
                          Target Closure Date: {formatShortDate(closureDate)}
                        </span>
                      )}
                    </div>
                    {(issue.action || issue.impactCost || issue.impactSchedule || issue.impactScope) && (
                      <div className="mt-3 grid gap-2 text-[10px] text-muted-foreground md:grid-cols-2">
                        {issue.action && (
                          <p>
                            <strong className="text-foreground">Action:</strong> {issue.action}
                          </p>
                        )}
                        {issue.impactSchedule && (
                          <p>
                            <strong className="text-foreground">Schedule impact:</strong> {issue.impactSchedule}
                          </p>
                        )}
                        {issue.impactCost && (
                          <p>
                            <strong className="text-foreground">Cost impact:</strong> {issue.impactCost}
                          </p>
                        )}
                        {issue.impactScope && (
                          <p>
                            <strong className="text-foreground">Scope / quality impact:</strong> {issue.impactScope}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Progress indicator toward resolution & closure */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/5">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${statusTheme.stepPercent}%`,
                            backgroundColor: statusTheme.dotColor,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[8px] font-bold" style={{ color: statusTheme.dotColor }}>
                        {statusTheme.stepPercent}% · {statusTheme.description}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          Tagged:
                        </span>
                        <TagUserPopover
                          taggedUsers={issue.taggedUsers}
                          onChange={(newTagged) => onUpdate(index, { taggedUsers: newTagged })}
                          canTag={canTag}
                          saveTags={editable}
                          label="Tag Member"
                          projectId={project.id}
                          entityType="Issue"
                          entityId={`issue-${index}`}
                          entityTitle={issue.title}
                          entityContext={`Severity: ${issue.severity || 'Medium'} • Category: ${issue.category || 'General'}${issue.detail ? `\nDetail: ${issue.detail}` : ''}`}
                        />
                      </div>
                      {editable ? (
                        <label className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="text-muted-foreground">Status</span>
                          <select
                            value={issue.status ?? 'Open'}
                            onChange={(event) => onUpdate(index, { status: event.target.value as IssueStatus })}
                            className={`h-8 rounded-lg border px-2 text-[10px] outline-none transition-all cursor-pointer shadow-sm ${statusTheme.selectClass}`}
                          >
                            {issueStatusOptions.map((opt) => (
                              <option key={opt.status} value={opt.status} className="bg-white text-foreground">
                                {opt.prefix} {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] ${statusTheme.badgeClass}`}
                        >
                          {issue.status ?? 'Open'}
                        </span>
                      )}
                    </div>
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-[#eadcb1] bg-[#fff8e9]/70 p-4 text-[11px] text-muted-foreground">
            No issues or risks recorded for this project.
          </p>
        )}
      </div>

      {editable &&
        (adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.title || !draft.detail) return;
              onAdd({
                ...draft,
                owner: draft.owner || 'Project Lead',
                status: 'Open',
                dateRaised: draft.issueAriseDate || todayLabel(),
                issueAriseDate: draft.issueAriseDate || todayLabel(),
                dueDate: draft.targetClosureDate || draft.dueDate,
                targetClosureDate: draft.targetClosureDate || draft.dueDate,
              });
              setDraft({
                title: '',
                detail: '',
                category: 'Design',
                severity: 'Medium',
                stage: project.phases.find((phase) => phase.status === 'active')?.name ?? project.phases[0]?.name ?? '',
                owner: '',
                dueDate: '',
                issueAriseDate: todayLabel(),
                targetClosureDate: '',
                impactCost: '',
                impactSchedule: '',
                impactScope: '',
                action: '',
              });
              setAdding(false);
            }}
            className="mt-5 space-y-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input
                required
                value={draft.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="Issue or risk title *"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <select
                value={draft.category}
                onChange={(event) => set('category', event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                {issueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={draft.stage}
                onChange={(event) => set('stage', event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                {project.phases.map((phase, index) => (
                  <option key={`${phase.name}-${index}`}>{phase.name}</option>
                ))}
              </select>
              <select
                value={draft.severity}
                onChange={(event) => set('severity', event.target.value as ProjectIssue['severity'])}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <input
                value={draft.owner}
                onChange={(event) => set('owner', event.target.value)}
                placeholder="Issue owner"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <label className="block">
                <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                  Issue Arise Date
                </span>
                <input
                  type="date"
                  value={draft.issueAriseDate}
                  onChange={(event) => set('issueAriseDate', event.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                  Target Closure Date
                </span>
                <input
                  type="date"
                  value={draft.targetClosureDate}
                  onChange={(event) => set('targetClosureDate', event.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
                />
              </label>
            </div>
            <textarea
              required
              value={draft.detail}
              onChange={(event) => set('detail', event.target.value)}
              placeholder="Describe the issue, cause, and current situation *"
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[11px]"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={draft.impactSchedule}
                onChange={(event) => set('impactSchedule', event.target.value)}
                placeholder="Schedule impact"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={draft.impactCost}
                onChange={(event) => set('impactCost', event.target.value)}
                placeholder="Cost impact"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={draft.impactScope}
                onChange={(event) => set('impactScope', event.target.value)}
                placeholder="Scope / quality impact"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={draft.action}
                onChange={(event) => set('action', event.target.value)}
                placeholder="Next action / resolution"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-[#173e49] px-4 py-2 text-[10px] font-bold text-white">
                Add issue
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-[10px] font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 rounded-xl border border-[#eadcb1] bg-white/60 px-3 py-2 text-[10px] font-bold text-[#9a711f]"
          >
            <Plus size={13} className="mr-1 inline" /> Add issue or risk
          </button>
        ))}
    </DetailCard>
  );
}
