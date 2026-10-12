import { Activity } from 'lucide-react';
import { greetingForNow, todayLongLabel } from '@/lib/date';
import type { AppRole } from '@/state/app-state';

interface DashboardHeroProps {
  firstName: string;
  role: AppRole | null;
  total: number;
  myProjectCount: number;
  atRiskCount: number;
}

export function DashboardHero({ firstName, role, total, myProjectCount, atRiskCount }: DashboardHeroProps) {
  return (
    <section className="fade-up flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
      <div>
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a711f]">
          <span className="size-1.5 rounded-full bg-[#d19b35]" /> {todayLongLabel()}
        </div>
        <h1 className="max-w-[720px] font-serif text-[39px] leading-[.98] tracking-[-0.045em] text-[#173e49] md:text-[52px]">
          {greetingForNow()}, {firstName}.<br />
          <span className="text-[#3d9a7e]">
            {role === 'lead' ? 'Your projects are in view.' : 'The portfolio is in view.'}
          </span>
        </h1>
        <p className="mt-4 max-w-[570px] text-[13px] leading-6 text-muted-foreground">
          {total === 0
            ? role === 'lead'
              ? 'Your portfolio is clean and ready. Click "New project" to create your first project and begin tracking stages, milestones, and issues.'
              : 'Your portfolio is currently empty. Project leads can add new projects to start tracking delivery and health.'
            : role === 'lead'
              ? `A working view of ${myProjectCount} ${myProjectCount === 1 ? 'project' : 'projects'} you manage, plus the updates that need your attention.`
              : `A composed read on ${total} active projects across Encalm Hospitality. ${atRiskCount} ${atRiskCount === 1 ? 'decision needs' : 'decisions need'} your attention this week.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl bg-[#e4f1ec] text-[#2e7c67]">
          <Activity size={18} />
        </span>
        <span>
          <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Portfolio pulse
          </span>
          <span className="mt-1 block text-[13px] font-bold text-[#2e7c67]">Steady, with movement</span>
        </span>
      </div>
    </section>
  );
}
