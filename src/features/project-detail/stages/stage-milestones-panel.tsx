import { useState, useMemo } from 'react';
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Clock3, Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatShortDate, type Milestone, type Project } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { TagUserPopover } from '@/components/tag-user-popover';
import { DetailCard } from '../ui';
import { currentStage } from '@/lib/stage-status';

export function StageMilestonesPanel({
  project,
  editable,
  canTag = true,
  onAdd,
}: {
  project: Project;
  editable: boolean;
  canTag?: boolean;
  onAdd: (milestone: {
    title: string;
    date: string;
    status: 'upcoming';
    stage: string;
    owner: string;
    approvalRequired: boolean;
    approvalStatus: 'Not required' | 'Pending';
  }) => void;
}) {
  const { approveMilestone, completeMilestone, updateMilestone } = useAppState();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [stage, setStage] = useState(currentStage(project.phases)?.name ?? project.phases[0]?.name ?? '');
  const [owner, setOwner] = useState('');
  const [approvalRequired, setApprovalRequired] = useState(false);

  const handleApprove = async (milestoneId: string, status: 'Approved' | 'Rejected') => {
    const success = await approveMilestone(project.id, milestoneId, status);
    if (success) {
      toast({
        title: `Milestone ${status}`,
        description: `Approval status updated to ${status}.`,
      });
    }
  };

  const handleComplete = async (milestoneId: string) => {
    const success = await completeMilestone(project.id, milestoneId);
    if (success) {
      toast({
        title: 'Milestone Completed',
        description: 'Control point marked as complete and logged.',
      });
    }
  };

  // Partition into Active/Incomplete (top) and Completed (bottom)
  const sortedMilestones = useMemo(() => {
    const active: Array<{ milestone: Milestone; originalIndex: number }> = [];
    const completed: Array<{ milestone: Milestone; originalIndex: number }> = [];

    project.milestones.forEach((m, idx) => {
      if (m.status === 'complete') {
        completed.push({ milestone: m, originalIndex: idx });
      } else {
        active.push({ milestone: m, originalIndex: idx });
      }
    });

    // Active/incomplete: earliest / imminent target date first
    active.sort((a, b) => a.milestone.date.localeCompare(b.milestone.date));
    // Completed: most recently completed / target date first at bottom
    completed.sort((a, b) => b.milestone.date.localeCompare(a.milestone.date));

    return [...active, ...completed];
  }, [project.milestones]);

  const hasActive = sortedMilestones.some((item) => item.milestone.status !== 'complete');
  const hasCompleted = sortedMilestones.some((item) => item.milestone.status === 'complete');

  return (
    <DetailCard title="Milestones & approvals" eyebrow="Control points" icon={CalendarDays}>
      <div className="mt-6 space-y-6">
        {/* Active & Pending Milestones */}
        <div>
          {hasCompleted && hasActive && (
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-foreground">
                Active & Upcoming ({sortedMilestones.filter((m) => m.milestone.status !== 'complete').length})
              </span>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedMilestones
              .filter((item) => item.milestone.status !== 'complete')
              .map(({ milestone, originalIndex }) => {
                const milestoneId = milestone.id || `${project.id}-${milestone.title}`;
                const isPendingApproval = milestone.approvalRequired && milestone.approvalStatus === 'Pending';
                const isComplete = milestone.status === 'complete';
                return (
                  <div
                    key={`${milestone.title}-${milestone.date}-${originalIndex}`}
                    className={`flex flex-col justify-between rounded-xl border p-4 ${
                      isComplete
                        ? 'border-[#cbe4d9] bg-[#edf5f0]'
                        : milestone.status === 'late'
                          ? 'border-[#f0c8c2] bg-[#fae5e1]'
                          : 'border-border bg-[#fbfaf6]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-7 place-items-center rounded-lg ${
                            isComplete
                              ? 'bg-[#d8ede3] text-[#2e7c67]'
                              : milestone.status === 'late'
                                ? 'bg-[#f3d3ce] text-[#b2473d]'
                                : 'bg-[#f8edcf] text-[#9a711f]'
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 size={14} />
                          ) : milestone.status === 'late' ? (
                            <AlertTriangle size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">
                          {milestone.status}
                        </span>
                      </div>
                      <p className="mt-4 text-[11px] font-bold leading-4">{milestone.title}</p>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[.09em] text-muted-foreground">
                        {formatShortDate(milestone.date)} {milestone.date.slice(0, 4)}
                      </p>
                      {(milestone.stage || milestone.owner) && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {milestone.stage ?? 'Unassigned'} · {milestone.owner ?? 'No owner'}
                        </p>
                      )}
                      {milestone.approvalRequired && (
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] ${
                            milestone.approvalStatus === 'Approved'
                              ? 'bg-[#d8ede3] text-[#2e7c67]'
                              : milestone.approvalStatus === 'Rejected'
                                ? 'bg-[#fae5e1] text-[#b2473d]'
                                : 'bg-[#f8edcf] text-[#9a711f]'
                          }`}
                        >
                          Approval · {milestone.approvalStatus ?? 'Pending'}
                        </span>
                      )}

                      <div className="mt-3 flex items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          Assigned:
                        </span>
                        <TagUserPopover
                          taggedUsers={milestone.taggedUsers}
                          onChange={(newTagged) =>
                            updateMilestone(project.id, originalIndex, { taggedUsers: newTagged })
                          }
                          canTag={canTag}
                          saveTags={editable}
                          label="Tag Member"
                          projectId={project.id}
                          entityType="Milestone"
                          entityId={milestoneId}
                          entityTitle={milestone.title}
                          entityContext={`Target Date: ${milestone.date}${milestone.stage ? ` • Stage: ${milestone.stage}` : ''}`}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                      {isPendingApproval && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Approved')}
                            className="flex items-center gap-1 rounded-lg bg-[#2e7c67] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#256554]"
                          >
                            <ThumbsUp size={10} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Rejected')}
                            className="flex items-center gap-1 rounded-lg bg-[#b2473d] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#963c33]"
                          >
                            <ThumbsDown size={10} /> Reject
                          </button>
                        </>
                      )}
                      {!isComplete && (
                        <button
                          type="button"
                          onClick={() => handleComplete(milestoneId)}
                          className="flex items-center gap-1 rounded-lg border border-[#cbe4d9] bg-white px-2 py-1 text-[9px] font-bold text-[#2e7c67] hover:bg-[#edf5f0]"
                        >
                          <Check size={10} /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Completed Milestones Section at Bottom */}
        {hasCompleted && (
          <div className="border-t border-border/70 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                Completed Milestones ({sortedMilestones.filter((m) => m.milestone.status === 'complete').length})
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedMilestones
                .filter((item) => item.milestone.status === 'complete')
                .map(({ milestone, originalIndex }) => {
                  const milestoneId = milestone.id || `${project.id}-${milestone.title}`;
                  const isPendingApproval = milestone.approvalRequired && milestone.approvalStatus === 'Pending';
                  return (
                    <div
                      key={`${milestone.title}-${milestone.date}-${originalIndex}`}
                      className="flex flex-col justify-between rounded-xl border border-[#cbe4d9] bg-[#edf5f0]/80 p-4 opacity-90 transition hover:opacity-100"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="grid size-7 place-items-center rounded-lg bg-[#d8ede3] text-[#2e7c67]">
                            <CheckCircle2 size={14} />
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-[.08em] text-[#2e7c67] font-semibold">
                            Complete
                          </span>
                        </div>
                        <p className="mt-4 text-[11px] font-bold leading-4 line-through decoration-[#2e7c67]/40 text-foreground/80">
                          {milestone.title}
                        </p>
                        <p className="mt-2 font-mono text-[9px] uppercase tracking-[.09em] text-muted-foreground">
                          {formatShortDate(milestone.date)} {milestone.date.slice(0, 4)}
                        </p>
                        {(milestone.stage || milestone.owner) && (
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            {milestone.stage ?? 'Unassigned'} · {milestone.owner ?? 'No owner'}
                          </p>
                        )}
                        {milestone.approvalRequired && (
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] ${
                              milestone.approvalStatus === 'Approved'
                                ? 'bg-[#d8ede3] text-[#2e7c67]'
                                : milestone.approvalStatus === 'Rejected'
                                  ? 'bg-[#fae5e1] text-[#b2473d]'
                                  : 'bg-[#f8edcf] text-[#9a711f]'
                            }`}
                          >
                            Approval · {milestone.approvalStatus ?? 'Pending'}
                          </span>
                        )}

                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            Assigned:
                          </span>
                          <TagUserPopover
                            taggedUsers={milestone.taggedUsers}
                            onChange={(newTagged) =>
                              updateMilestone(project.id, originalIndex, { taggedUsers: newTagged })
                            }
                            canTag={canTag}
                            saveTags={editable}
                            label="Tag Member"
                            projectId={project.id}
                            entityType="Milestone"
                            entityId={milestoneId}
                            entityTitle={milestone.title}
                            entityContext={`Target Date: ${milestone.date}${milestone.stage ? ` • Stage: ${milestone.stage}` : ''}`}
                          />
                        </div>
                      </div>

                      {/* Action Buttons if needed */}
                      {isPendingApproval && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Approved')}
                            className="flex items-center gap-1 rounded-lg bg-[#2e7c67] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#256554]"
                          >
                            <ThumbsUp size={10} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Rejected')}
                            className="flex items-center gap-1 rounded-lg bg-[#b2473d] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#963c33]"
                          >
                            <ThumbsDown size={10} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      {editable &&
        (adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!title || !date) return;
              onAdd({
                title,
                date,
                status: 'upcoming',
                stage,
                owner: owner || 'Project Lead',
                approvalRequired,
                approvalStatus: approvalRequired ? 'Pending' : 'Not required',
              });
              setTitle('');
              setDate('');
              setOwner('');
              setApprovalRequired(false);
              setAdding(false);
            }}
            className="mt-5 space-y-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Milestone name"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                required
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                {project.phases.map((phase, index) => (
                  <option key={`${phase.name}-${index}`}>{phase.name}</option>
                ))}
              </select>
              <input
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Milestone owner"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(event) => setApprovalRequired(event.target.checked)}
              />{' '}
              Requires HOD / stakeholder approval
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-[#173e49] px-4 py-2 text-[10px] font-bold text-white">
                Add milestone
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
            className="mt-5 rounded-xl border border-border bg-[#f7f4ec] px-3 py-2 text-[10px] font-bold"
          >
            <Plus size={13} className="mr-1 inline" /> Add milestone
          </button>
        ))}
    </DetailCard>
  );
}
