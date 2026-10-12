import {
  Activity,
  TriangleAlert as AlertTriangle,
  ChartBar as BarChart3,
  CircleDollarSign,
  TrendingUp,
} from 'lucide-react';
import { formatCrore, type Project } from '@/data/projects';
import type { DashboardStats } from './use-dashboard-data';

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  accent: string;
  delay: string;
}) {
  return (
    <div
      className={`fade-up ${delay} group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm shadow-[#173e49]/[.03]`}
    >
      <div
        className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[40px] ${accent} opacity-10 transition-transform duration-500 group-hover:scale-125`}
      />
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <Icon size={17} className="text-muted-foreground/60" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-2">
        <p
          data-testid={`text-kpi-${label.toLowerCase().replaceAll(' ', '-')}`}
          className="text-[27px] font-extrabold tracking-[-0.045em] text-foreground"
        >
          {value}
        </p>
        <p className="mb-1 text-right text-[10px] font-semibold text-[#3d9a7e]">{detail}</p>
      </div>
    </div>
  );
}

interface KpiStripProps {
  projects: Project[];
  stats: DashboardStats;
  atRiskCount: number;
}

export function KpiStrip({ projects, stats, atRiskCount }: KpiStripProps) {
  const { onTrackCount, totalAop, averageProgress } = stats;
  return (
    <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Active projects"
        value={`${stats.total}`}
        detail={`Across ${stats.locationCount} ${stats.locationCount === 1 ? 'location' : 'locations'}`}
        icon={BarChart3}
        accent="bg-[#3d9a7e]"
        delay="stagger-1"
      />
      <KpiCard
        label="Portfolio AOP"
        value={formatCrore(totalAop)}
        detail={`${formatCrore(totalAop - projects.reduce((sum, project) => sum + project.spent, 0))} unspent`}
        icon={CircleDollarSign}
        accent="bg-[#d19b35]"
        delay="stagger-2"
      />
      <KpiCard
        label="Average progress"
        value={`${averageProgress}%`}
        detail={`${onTrackCount} of ${stats.total || 0} on track`}
        icon={TrendingUp}
        accent="bg-[#2e7c67]"
        delay="stagger-3"
      />
      <KpiCard
        label="Needs attention"
        value={`${atRiskCount}`}
        detail={`${stats.highPriorityCount} high priority`}
        icon={AlertTriangle}
        accent="bg-[#d66254]"
        delay="stagger-4"
      />
    </section>
  );
}
