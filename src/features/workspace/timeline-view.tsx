import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, Search } from 'lucide-react';
import { categories, locationOptions, type Category, type Location } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { healthTone } from '@/lib/tones';
import { leadName } from '@/data/users';
import { sortProjectsIncompleteFirst } from '@/lib/calculations';
import { PageHeader } from './page-header';
import { currentStage, effectiveStageStatus } from '@/lib/stage-status';
import { projectProgressTone } from '@/lib/progress-tone';

export function TimelineView() {
  const { projects } = useAppState();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<'All' | Location>('All');
  const [category, setCategory] = useState<'All' | Category>('All');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = projects.filter((p) => {
      const haystack = `${p.name} ${p.code} ${p.location} ${p.category} ${leadName(p.leadId)}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (location !== 'All' && p.location !== location) return false;
      if (category !== 'All' && p.category !== category) return false;
      return true;
    });
    return sortProjectsIncompleteFirst(result);
  }, [projects, search, location, category]);

  return (
    <>
      <PageHeader
        eyebrow="Execution"
        title="Project timeline"
        description="A live interactive view of delivery progress and stage execution across the portfolio."
      />

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project or lead..."
            className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
          />
        </label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value as typeof location)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
        >
          <option value="All">All locations</option>
          {locationOptions(projects).map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
        >
          <option value="All">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-7 space-y-4">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">
            No projects match this timeline filter.
          </p>
        ) : (
          filtered.map((project) => {
            const activePhase = currentStage(project.phases);
            return (
              <div
                key={project.id}
                className="group rounded-2xl border border-border bg-card p-5 transition hover:border-[#d9c585] hover:shadow-md"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/project/${project.id}`}
                        className="text-[14px] font-bold text-foreground hover:text-[#2e7c67]"
                      >
                        {project.name}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${healthTone[project.health]}`}>
                        {project.health}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                      {project.code} · {project.location} · {project.category} · Lead: {leadName(project.leadId)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Target</p>
                      <p className="text-[11px] font-bold">{project.targetLabel}</p>
                    </div>
                    <div className="w-28">
                      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div
                        className="mt-1 h-2 overflow-hidden rounded-full bg-[#e7e7dc]"
                        title={projectProgressTone(project).reason}
                      >
                        <div
                          data-tone={projectProgressTone(project).key}
                          className={`h-full rounded-full ${projectProgressTone(project).bar} transition-all`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                    <Link
                      href={`/project/${project.id}`}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Stage Pipeline */}
                <div className="mt-5 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                    <span>Delivery stages pipeline ({project.phases.length} stages)</span>
                    <span>
                      Current: <strong className="text-foreground">{activePhase?.name || 'In planning'}</strong>
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {project.phases.map((phase, idx) => {
                      const isComplete = effectiveStageStatus(phase) === 'complete';
                      const isActive = effectiveStageStatus(phase) === 'active';
                      const isBlocked = phase.status === 'blocked';
                      return (
                        <div
                          key={phase.id || `${project.id}-phase-${idx}`}
                          className={`rounded-xl border p-2.5 text-[10px] ${
                            isComplete
                              ? 'border-[#cbe4d9] bg-[#edf5f0]'
                              : isActive
                                ? 'border-[#eadcb1] bg-[#fff8e9]'
                                : isBlocked
                                  ? 'border-[#f0c8c2] bg-[#fff5f2]'
                                  : 'border-border/60 bg-[#fbfaf6]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate font-bold text-foreground">{phase.name}</span>
                            <span className="font-mono text-[9px] text-muted-foreground">{phase.progress}%</span>
                          </div>
                          <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[.08em] text-muted-foreground">
                            {phase.owner}
                          </p>
                        </div>
                      );
                    })}
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
