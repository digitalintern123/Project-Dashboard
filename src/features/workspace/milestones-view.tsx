import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowUpRight, Check, Flag, Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from './page-header';

export function MilestonesView() {
  const { projects, role, canEdit, canEditProject, approveMilestone, completeMilestone } = useAppState();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'All' | 'Approval' | 'Upcoming' | 'Late' | 'Complete'>('All');

  const allMilestones = useMemo(() => {
    return projects
      .flatMap((project) =>
        project.milestones.map((milestone) => ({
          ...milestone,
          id: milestone.id || `${project.id}-${milestone.title}`,
          project,
        })),
      )
      .sort((a, b) => {
        const aComplete = a.status === 'complete';
        const bComplete = b.status === 'complete';
        if (aComplete !== bComplete) {
          return aComplete ? 1 : -1; // incomplete first, complete at the bottom
        }
        if (aComplete) {
          return b.date.localeCompare(a.date); // completed: most recent first
        }
        return a.date.localeCompare(b.date); // incomplete: earliest / upcoming first
      });
  }, [projects]);

  const filtered = useMemo(() => {
    if (filter === 'Approval') {
      return allMilestones.filter((m) => m.approvalRequired && m.approvalStatus === 'Pending');
    }
    if (filter === 'Upcoming') {
      return allMilestones.filter((m) => m.status === 'upcoming');
    }
    if (filter === 'Late') {
      return allMilestones.filter((m) => m.status === 'late');
    }
    if (filter === 'Complete') {
      return allMilestones.filter((m) => m.status === 'complete');
    }
    return allMilestones;
  }, [allMilestones, filter]);

  const handleApprove = async (projectId: string, milestoneId: string, status: 'Approved' | 'Rejected') => {
    const success = await approveMilestone(projectId, milestoneId, status);
    if (success) {
      toast({
        title: `Milestone ${status}`,
        description: `Approval status updated to ${status}.`,
      });
    }
  };

  const handleComplete = async (projectId: string, milestoneId: string) => {
    const success = await completeMilestone(projectId, milestoneId);
    if (success) {
      toast({
        title: 'Milestone Completed',
        description: 'Control point marked as complete and logged.',
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Execution"
        title="Milestones"
        description="The control points across the portfolio, with approval gates and completion actions."
        action={
          canEdit ? (
            <Link
              href="/my-projects"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]"
            >
              <Plus size={15} /> Add milestone
            </Link>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {(['All', 'Approval', 'Upcoming', 'Late', 'Complete'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-xl px-3.5 py-2 text-[11px] font-bold transition ${
              filter === tab
                ? 'bg-[#173e49] text-white'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab === 'Approval' ? 'Needs Approval' : tab}
            <span className="ml-1.5 font-mono text-[9px] opacity-70">
              (
              {tab === 'All'
                ? allMilestones.length
                : tab === 'Approval'
                  ? allMilestones.filter((m) => m.approvalRequired && m.approvalStatus === 'Pending').length
                  : tab === 'Upcoming'
                    ? allMilestones.filter((m) => m.status === 'upcoming').length
                    : tab === 'Late'
                      ? allMilestones.filter((m) => m.status === 'late').length
                      : allMilestones.filter((m) => m.status === 'complete').length}
              )
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground md:col-span-2 xl:col-span-3">
            No milestones found for this filter.
          </p>
        ) : (
          filtered.map((item) => {
            const isPendingApproval = item.approvalRequired && item.approvalStatus === 'Pending';
            const isComplete = item.status === 'complete';
            const isLate = item.status === 'late';

            return (
              <div
                key={`${item.project.id}-${item.id}`}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                  isComplete
                    ? 'border-[#cbe4d9] bg-[#edf5f0]/80'
                    : isLate
                      ? 'border-[#f0c8c2] bg-[#fff5f2]'
                      : 'border-border bg-card hover:border-[#d9c585]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`grid size-9 place-items-center rounded-xl ${
                        isComplete
                          ? 'bg-[#d8ede3] text-[#2e7c67]'
                          : isLate
                            ? 'bg-[#fae5e1] text-[#b2473d]'
                            : 'bg-[#f8edcf] text-[#9a711f]'
                      }`}
                    >
                      {isComplete ? (
                        <Check size={16} strokeWidth={3} />
                      ) : isLate ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <Flag size={16} />
                      )}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                      {item.date}
                    </span>
                  </div>

                  <h3 className="mt-4 text-[13px] font-bold text-foreground">{item.title}</h3>
                  <Link
                    href={`/project/${item.project.id}`}
                    className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {item.project.name}
                  </Link>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        isComplete
                          ? 'bg-[#d8ede3] text-[#2e7c67]'
                          : isLate
                            ? 'bg-[#fae5e1] text-[#b2473d]'
                            : 'bg-[#e4f1ec] text-[#2e7c67]'
                      }`}
                    >
                      {isComplete ? 'Complete' : isLate ? 'Needs attention' : 'Upcoming'}
                    </span>

                    {item.approvalRequired && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          item.approvalStatus === 'Approved'
                            ? 'bg-[#d8ede3] text-[#2e7c67]'
                            : item.approvalStatus === 'Rejected'
                              ? 'bg-[#fae5e1] text-[#b2473d]'
                              : 'bg-[#f8edcf] text-[#9a711f]'
                        }`}
                      >
                        Approval · {item.approvalStatus || 'Pending'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Interactive Action Controls */}
                <div className="mt-5 border-t border-border/60 pt-3 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/project/${item.project.id}`}
                    className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-muted-foreground hover:text-foreground"
                  >
                    View project <ArrowUpRight size={11} />
                  </Link>

                  <div className="flex items-center gap-2">
                    {role === 'coordinator' && isPendingApproval && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(item.project.id, item.id, 'Approved')}
                          className="flex items-center gap-1 rounded-lg bg-[#2e7c67] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#256554]"
                        >
                          <ThumbsUp size={11} /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(item.project.id, item.id, 'Rejected')}
                          className="flex items-center gap-1 rounded-lg bg-[#b2473d] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#963c33]"
                        >
                          <ThumbsDown size={11} /> Reject
                        </button>
                      </>
                    )}

                    {canEditProject(item.project) && !isComplete && (
                      <button
                        type="button"
                        onClick={() => handleComplete(item.project.id, item.id)}
                        className="flex items-center gap-1 rounded-lg border border-[#cbe4d9] bg-white px-2.5 py-1 text-[10px] font-bold text-[#2e7c67] hover:bg-[#edf5f0]"
                      >
                        <Check size={11} /> Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
