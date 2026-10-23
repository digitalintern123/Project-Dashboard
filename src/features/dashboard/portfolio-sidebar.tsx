import { Link } from 'wouter';
import { ArrowUpRight, CalendarDays, CircleCheck as CheckCircle2, Clock3 } from 'lucide-react';
import type { Project } from '@/data/projects';
import { initialsOf, leadName } from '@/data/users';
import { milestoneWindowLabel } from './helpers';
import { currentStage } from '@/lib/stage-status';

interface PortfolioSidebarProps {
  upcoming: Project[];
  nearCompletionProject: Project | null;
  portfolioExpanded: boolean;
}

/** Upcoming milestones and the "near completion" spotlight beside the portfolio. */
export function PortfolioSidebar({ upcoming, nearCompletionProject, portfolioExpanded }: PortfolioSidebarProps) {
  return (
    <div className={portfolioExpanded ? 'grid gap-5 md:grid-cols-2' : 'space-y-5'}>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-[#173e49]/[.03]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Next up</p>
            <h2 className="mt-2 text-[18px] font-extrabold tracking-[-.03em]">Upcoming milestones</h2>
          </div>
          <CalendarDays size={18} className="text-muted-foreground/60" />
        </div>
        <div className="mt-5 space-y-4">
          {upcoming.length ? (
            upcoming.map((project) => (
              <Link
                href={`/project/${project.id}`}
                data-testid={`link-milestone-${project.id}`}
                key={project.id}
                className="group flex gap-3"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#f7f4ec] text-[#9a711f]">
                  <Clock3 size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-bold">{project.nextMilestone}</span>
                    <ArrowUpRight size={13} className="shrink-0 text-muted-foreground/45 group-hover:text-foreground" />
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">{project.name}</span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.1em] text-[#9a711f]">
                    {milestoneWindowLabel(project.nextMilestoneDate)}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <p className="text-[11px] leading-5 text-muted-foreground">No upcoming milestones recorded yet.</p>
          )}
        </div>
      </div>
      {nearCompletionProject && (
        <div className="rounded-2xl border border-[#d0e0d9] bg-[#edf5f0] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#2e7c67]">Near completion</p>
              <h2 className="mt-2 text-[18px] font-extrabold tracking-[-.03em] text-[#173e49]">Opening sequence</h2>
            </div>
            <CheckCircle2 size={18} className="text-[#3d9a7e]" />
          </div>
          <p className="mt-4 text-[11px] leading-5 text-[#517167]">
            <strong className="text-foreground">{nearCompletionProject.name}</strong> is at{' '}
            <strong className="text-foreground">{nearCompletionProject.progress}%</strong> complete in stage &ldquo;
            {currentStage(nearCompletionProject.phases)?.name || 'Delivery'}&rdquo;. Target completion is{' '}
            {nearCompletionProject.targetLabel}.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full border-2 border-[#edf5f0] bg-[#d6a95d] text-[9px] font-bold text-[#173e49]">
                {initialsOf(leadName(nearCompletionProject.leadId))}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">
                Lead: {leadName(nearCompletionProject.leadId)}
              </span>
            </div>
            <Link
              href={`/project/${nearCompletionProject.id}`}
              data-testid="link-near-completion"
              className="flex items-center gap-1 text-[11px] font-bold text-[#2e7c67] hover:text-[#173e49]"
            >
              Open project <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
