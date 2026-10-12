import { CalendarDays, CircleDollarSign, Layers3, ReceiptText, TrendingUp } from 'lucide-react';
import { formatCrore, type Project } from '@/data/projects';
import { formatFullDate, parseIsoDate } from '@/lib/date';
import { getCommercialSummary, getProgressVariance } from '@/lib/calculations';
import { Metric } from './ui';

export function ProjectMetrics({ project }: { project: Project }) {
  const commercial = getCommercialSummary(project);
  const progressVariance = getProgressVariance(project);
  return (
    <section className="fade-up mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric
        label="Project Status"
        value={project.status || 'Yet to start'}
        note="User-defined status"
        icon={Layers3}
      />
      <Metric
        label="Completion %"
        value={`${project.progress}%`}
        note={
          progressVariance.variance !== null
            ? `${progressVariance.variance >= 0 ? '+' : ''}${progressVariance.variance}% vs planned`
            : 'Target schedule'
        }
        icon={TrendingUp}
      />
      <Metric
        label="Approved Budget (AOP)"
        value={formatCrore(project.aop)}
        tone={commercial.overAwarded ? 'warning' : 'default'}
        note={
          <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
            <div>
              {formatCrore(project.awarded)} committed{' '}
              {commercial.overAwarded && <span className="font-bold text-[#b2473d]">(Over AOP)</span>}
            </div>
            <div>{formatCrore(project.spent)} spent</div>
          </div>
        }
        icon={CircleDollarSign}
      />
      <Metric
        label="Projected Cost"
        value={formatCrore(project.projectedCost ?? project.aop)}
        tone={commercial.overBudget ? 'danger' : 'default'}
        note={
          commercial.costVariance === 0
            ? 'On approved budget'
            : commercial.costVariance > 0
              ? `+${formatCrore(commercial.costVariance)} variance (Over budget)`
              : `${formatCrore(commercial.costVariance)} variance`
        }
        icon={ReceiptText}
      />
      <Metric
        label="Completion Date"
        value={project.targetLabel || (project.targetDate ? formatFullDate(project.targetDate) : 'Not set')}
        note={(() => {
          const target = parseIsoDate(project.targetDate);
          if (!target) return 'Planned opening schedule';
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffMs = target.getTime() - today.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays > 0) return `${diffDays} days remaining`;
          if (diffDays === 0) return 'Due today';
          return `${Math.abs(diffDays)} days past target`;
        })()}
        icon={CalendarDays}
      />
    </section>
  );
}
