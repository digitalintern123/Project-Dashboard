import { useState } from 'react';
import type { Category, Health, Location, ProjectStatus } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { todayLongLabel } from '@/lib/date';
import { DashboardHero } from './dashboard-hero';
import { HealthOverview } from './health-overview';
import { KpiStrip } from './kpi-strip';
import { PortfolioRegister } from './portfolio-register';
import { PortfolioSidebar } from './portfolio-sidebar';
import { PortfolioToolbar } from './portfolio-toolbar';
import { useDashboardData } from './use-dashboard-data';

export default function Dashboard() {
  const { projects, user, role } = useAppState();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<'All' | Location>('All');
  const [category, setCategory] = useState<'All' | Category>('All');
  const [health, setHealth] = useState<'All' | Health>('All');
  const [status, setStatus] = useState<'All' | ProjectStatus>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [portfolioExpanded, setPortfolioExpanded] = useState(false);

  const { filteredProjects, stats, atRisk, upcoming, myProjectCount, nearCompletionProject, healthGradient } =
    useDashboardData({ projects, userId: user?.id, query, location, category, health, status });

  const clearFilters = () => {
    setQuery('');
    setLocation('All');
    setCategory('All');
    setHealth('All');
    setStatus('All');
  };
  const hasFilters = Boolean(query) || location !== 'All' || category !== 'All' || health !== 'All' || status !== 'All';

  return (
    <div className="mx-auto max-w-[1540px] px-5 pb-14 pt-8 md:px-10 md:pt-10">
      <DashboardHero
        firstName={user?.name?.split(' ')[0] ?? 'there'}
        role={role}
        total={stats.total}
        myProjectCount={myProjectCount}
        atRiskCount={atRisk.length}
      />

      <KpiStrip projects={projects} stats={stats} atRiskCount={atRisk.length} />

      <HealthOverview stats={stats} projectCount={projects.length} healthGradient={healthGradient} atRisk={atRisk} />

      <section className={`mt-8 grid gap-5 ${portfolioExpanded ? 'grid-cols-1' : 'lg:grid-cols-[1.35fr_.65fr]'}`}>
        <div className="min-w-0">
          <PortfolioToolbar
            projects={projects}
            shownCount={filteredProjects.length}
            query={query}
            setQuery={setQuery}
            location={location}
            setLocation={setLocation}
            category={category}
            setCategory={setCategory}
            health={health}
            setHealth={setHealth}
            status={status}
            setStatus={setStatus}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            hasFilters={hasFilters}
            clearFilters={clearFilters}
          />
          <PortfolioRegister
            filteredProjects={filteredProjects}
            portfolioExpanded={portfolioExpanded}
            setPortfolioExpanded={setPortfolioExpanded}
          />
        </div>
        <PortfolioSidebar
          upcoming={upcoming}
          nearCompletionProject={nearCompletionProject}
          portfolioExpanded={portfolioExpanded}
        />
      </section>

      <footer className="mt-12 flex flex-col justify-between gap-2 border-t border-border/70 pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground sm:flex-row">
        <span>Encalm Hospitality · Project control office</span>
        <span>Portfolio view · {todayLongLabel()}</span>
      </footer>
    </div>
  );
}
