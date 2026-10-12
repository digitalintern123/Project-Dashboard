import { Link } from 'wouter';
import { TriangleAlert as AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { Project } from '@/data/projects';
import { healthStyles } from './constants';
import type { DashboardStats } from './use-dashboard-data';

function AttentionItem({ project }: { project: Project }) {
  const style = healthStyles[project.health];
  return (
    <Link
      href={`/project/${project.id}`}
      data-testid={`link-attention-${project.id}`}
      className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 p-3.5 hover:-translate-y-0.5 hover:border-[#d9c585] hover:bg-card"
    >
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${style.bg} ${style.text}`}>
        <AlertTriangle size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-bold text-foreground">{project.name}</span>
          <ArrowUpRight
            size={14}
            className="shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
          {project.issues[0]?.title ?? 'Schedule review required'}
        </span>
        <span className={`mt-2 inline-block font-mono text-[9px] uppercase tracking-[0.12em] ${style.text}`}>
          {project.location} · {project.health}
        </span>
      </span>
    </Link>
  );
}

interface HealthOverviewProps {
  stats: DashboardStats;
  projectCount: number;
  healthGradient: string;
  atRisk: Project[];
}

/** Portfolio health donut plus the "management attention" card beside it. */
export function HealthOverview({ stats, projectCount, healthGradient, atRisk }: HealthOverviewProps) {
  const { onTrackCount, atRiskCount, delayedCount, averageProgress } = stats;
  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-[#173e49]/[.03] md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Portfolio health</p>
            <h2 className="mt-2 text-[19px] font-extrabold tracking-[-.03em]">Where management time goes</h2>
          </div>
          <span className="rounded-full bg-[#e4f1ec] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] text-[#2e7c67]">
            Live view
          </span>
        </div>
        <div className="mt-7 grid gap-7 md:grid-cols-[.75fr_1.25fr] md:items-center">
          <div
            className="relative mx-auto grid size-40 place-items-center rounded-full"
            role="img"
            aria-label={`Average progress ${averageProgress}%. ${onTrackCount} on track, ${atRiskCount} at risk, ${delayedCount} delayed`}
            style={{ background: healthGradient }}
          >
            <div className="grid size-[118px] place-items-center rounded-full bg-card text-center">
              <span className="font-mono text-[27px] font-medium text-foreground">{averageProgress}%</span>
              <span className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">
                avg. complete
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <span className="flex items-center gap-2 text-[12px] font-semibold">
                <span className="size-2 rounded-full bg-[#3d9a7e]" />
                On track
              </span>
              <span className="font-mono text-[12px] font-medium">
                {onTrackCount} <span className="text-muted-foreground">/ {projectCount}</span>
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <span className="flex items-center gap-2 text-[12px] font-semibold">
                <span className="size-2 rounded-full bg-[#d19b35]" />
                At risk
              </span>
              <span className="font-mono text-[12px] font-medium">
                {atRiskCount} <span className="text-muted-foreground">/ {projectCount}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12px] font-semibold">
                <span className="size-2 rounded-full bg-[#d66254]" />
                Delayed
              </span>
              <span className="font-mono text-[12px] font-medium">
                {delayedCount} <span className="text-muted-foreground">/ {projectCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-[#eadcb1] bg-[#fbf1d8] p-5 shadow-sm shadow-[#d19b35]/[.08] md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#9a711f]">Management attention</p>
            <h2 className="mt-2 text-[19px] font-extrabold tracking-[-.03em] text-[#173e49]">
              {atRisk.length
                ? `${Math.min(atRisk.length, 3)} ${Math.min(atRisk.length, 3) === 1 ? 'thing' : 'things'} to unblock`
                : 'Nothing blocked'}
            </h2>
          </div>
          <AlertTriangle size={18} className="text-[#b78625]" />
        </div>
        <div className="mt-5 space-y-2.5">
          {atRisk.length ? (
            atRisk.slice(0, 3).map((project) => <AttentionItem key={project.id} project={project} />)
          ) : (
            <p className="rounded-xl border border-[#eadcb1] bg-white/60 p-4 text-[11px] leading-5 text-[#8e681c]">
              Every project is reporting on track. Nothing needs a decision this week.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
