import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { categories, formatCrore, healthOptions, locations, type Category, type Health, type Location, type Project } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { greetingForNow, parseIsoDate, todayLongLabel } from '@/lib/date';

const healthStyles: Record<Health, { dot: string; text: string; bg: string }> = {
  'On track': { dot: 'bg-[#3d9a7e]', text: 'text-[#2e7c67]', bg: 'bg-[#e4f1ec]' },
  'At risk': { dot: 'bg-[#d19b35]', text: 'text-[#9a711f]', bg: 'bg-[#f8edcf]' },
  Delayed: { dot: 'bg-[#d66254]', text: 'text-[#b2473d]', bg: 'bg-[#fae5e1]' },
  'Not started': { dot: 'bg-[#8c938d]', text: 'text-[#69716b]', bg: 'bg-[#eef0ed]' },
};

const categoryIcons: Record<Category, typeof BarChart3> = {
  Hotel: Target,
  Lounge: Activity,
  Kitchen: CircleDollarSign,
  'Encalm Eats': TrendingUp,
  Other: SlidersHorizontal,
};

function HealthPill({ health }: { health: Health }) {
  const style = healthStyles[health];
  return <span data-testid={`status-health-${health.toLowerCase().replaceAll(' ', '-')}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}><span className={`size-1.5 rounded-full ${style.dot}`} />{health}</span>;
}

function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const safe = clampPercent(value);
  return <div className={`flex items-center gap-2 ${compact ? 'min-w-[100px]' : ''}`}><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e4d9]"><div className="h-full rounded-full bg-[#3d9a7e] transition-all duration-500" style={{ width: `${safe}%` }} /></div><span className="font-mono text-[10px] font-medium text-muted-foreground">{safe}%</span></div>;
}

/** Progress arrives from free-text edits and saved payloads, so clamp it. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function KpiCard({ label, value, detail, icon: Icon, accent, delay }: { label: string; value: string; detail: string; icon: typeof Activity; accent: string; delay: string }) {
  return <div className={`fade-up ${delay} group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm shadow-[#173e49]/[.03]`}>
    <div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[40px] ${accent} opacity-10 transition-transform duration-500 group-hover:scale-125`} />
    <div className="flex items-start justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p><Icon size={17} className="text-muted-foreground/60" /></div>
    <div className="mt-5 flex items-end justify-between gap-2"><p data-testid={`text-kpi-${label.toLowerCase().replaceAll(' ', '-')}`} className="text-[27px] font-extrabold tracking-[-0.045em] text-foreground">{value}</p><p className="mb-1 text-right text-[10px] font-semibold text-[#3d9a7e]">{detail}</p></div>
  </div>;
}

function AttentionItem({ project }: { project: Project }) {
  const style = healthStyles[project.health];
  return <Link href={`/project/${project.id}`} data-testid={`link-attention-${project.id}`} className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 p-3.5 hover:-translate-y-0.5 hover:border-[#d9c585] hover:bg-card">
    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${style.bg} ${style.text}`}><AlertTriangle size={15} /></span>
    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-bold text-foreground">{project.name}</span><ArrowUpRight size={14} className="shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{project.issues[0]?.title ?? 'Schedule review required'}</span><span className={`mt-2 inline-block font-mono text-[9px] uppercase tracking-[0.12em] ${style.text}`}>{project.location} · {project.health}</span></span>
  </Link>;
}

function ProjectRow({ project, index }: { project: Project; index: number }) {
  const Icon = categoryIcons[project.category];
  return <Link href={`/project/${project.id}`} data-testid={`link-project-${project.id}`} className={`fade-up stagger-${Math.min(index + 1, 5)} group grid grid-cols-[minmax(220px,1.5fr)_110px_130px_110px_120px_120px_30px] items-center gap-4 border-b border-border/70 px-5 py-4 last:border-0 hover:bg-[#fcf5e5]`}>
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0ec] text-[#2e7c67]"><Icon size={16} /></span>
      <span className="min-w-0"><span className="block truncate text-[12px] font-bold text-foreground">{project.name}</span><span className="mt-1 flex items-center gap-1.5 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"><MapPin size={10} />{project.location} <span className="text-border">/</span> {project.code}</span></span>
    </span>
    <span><HealthPill health={project.health} /></span>
    <span><ProgressBar value={project.progress} compact /></span>
    <span className="text-[12px] font-semibold text-foreground">{formatCrore(project.aop)}</span>
    <span className="text-[12px] font-semibold text-foreground">{formatCrore(project.spent)}</span>
    <span><span className="block text-[11px] font-semibold text-foreground">{project.targetLabel}</span><span className="mt-1 block text-[10px] text-muted-foreground">target</span></span>
    <ArrowUpRight size={15} className="text-muted-foreground/45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </Link>;
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const Icon = categoryIcons[project.category];
  return <Link href={`/project/${project.id}`} data-testid={`card-project-${project.id}`} className={`fade-up stagger-${Math.min(index + 1, 5)} block rounded-2xl border border-border bg-card p-4 shadow-sm shadow-[#173e49]/[.03] hover:-translate-y-0.5 hover:border-[#d9c585] hover:shadow-lg hover:shadow-[#173e49]/[.06]`}>
    <span className="flex items-start justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0ec] text-[#2e7c67]"><Icon size={16} /></span><span className="min-w-0"><span className="block truncate text-[13px] font-bold">{project.name}</span><span className="mt-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground"><MapPin size={10} /> {project.location}</span></span></span><ArrowUpRight size={16} className="text-muted-foreground/50" /></span>
    <span className="mt-4 flex items-center justify-between"><HealthPill health={project.health} /><span className="font-mono text-[10px] text-muted-foreground">{project.targetLabel}</span></span>
    <span className="mt-4 block"><ProgressBar value={project.progress} /></span>
    <span className="mt-4 flex items-center justify-between border-t border-border/70 pt-3"><span className="text-[10px] text-muted-foreground">AOP <strong className="ml-1 text-foreground">{formatCrore(project.aop)}</strong></span><span className="text-[10px] text-muted-foreground">Spent <strong className="ml-1 text-foreground">{formatCrore(project.spent)}</strong></span></span>
  </Link>;
}

export default function Dashboard() {
  const { projects, user, role } = useAppState();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<'All' | Location>('All');
  const [category, setCategory] = useState<'All' | Category>('All');
  const [health, setHealth] = useState<'All' | Health>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [portfolioExpanded, setPortfolioExpanded] = useState(false);
  const [portfolioHeight, setPortfolioHeight] = useState(380);

  // `projects` was missing from these deps, so newly created or edited
  // projects never appeared until a full remount.
  const filteredProjects = useMemo(() => projects.filter((project) => {
    const haystack = `${project.name} ${project.location} ${project.category} ${project.code}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (location === 'All' || project.location === location) && (category === 'All' || project.category === category) && (health === 'All' || project.health === health);
  }), [projects, query, location, category, health]);

  const stats = useMemo(() => {
    const total = projects.length;
    const onTrackCount = projects.filter((project) => project.health === 'On track').length;
    const atRiskCount = projects.filter((project) => project.health === 'At risk').length;
    const delayedCount = projects.filter((project) => project.health === 'Delayed').length;
    const notStartedCount = total - onTrackCount - atRiskCount - delayedCount;
    const totalAop = projects.reduce((sum, project) => sum + (Number.isFinite(project.aop) ? project.aop : 0), 0);
    // Guard the divide: an empty portfolio previously rendered "NaN%".
    const averageProgress = total
      ? Math.round(projects.reduce((sum, project) => sum + clampPercent(project.progress), 0) / total)
      : 0;
    const locationCount = new Set(projects.map((project) => project.location)).size;
    const highPriorityCount = projects.filter((project) => project.issues.some((issue) => issue.severity === 'High')).length;
    return { total, onTrackCount, atRiskCount, delayedCount, notStartedCount, totalAop, averageProgress, locationCount, highPriorityCount };
  }, [projects]);

  const atRisk = useMemo(() => projects.filter((project) => project.health !== 'On track'), [projects]);
  const upcoming = useMemo(() => [...projects].sort((a, b) => a.nextMilestoneDate.localeCompare(b.nextMilestoneDate)).slice(0, 4), [projects]);
  const myProjectCount = useMemo(() => projects.filter((project) => project.lead === user?.name).length, [projects, user?.name]);

  // The donut used to be a hardcoded gradient that did not track the data.
  const healthGradient = useMemo(() => buildHealthGradient(stats), [stats]);

  const clearFilters = () => { setQuery(''); setLocation('All'); setCategory('All'); setHealth('All'); };
  const hasFilters = Boolean(query) || location !== 'All' || category !== 'All' || health !== 'All';
  const { onTrackCount, atRiskCount, delayedCount, totalAop, averageProgress } = stats;

  return <div className="mx-auto max-w-[1540px] px-5 pb-14 pt-8 md:px-10 md:pt-10">
    <section className="fade-up flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
      <div>
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a711f]"><span className="size-1.5 rounded-full bg-[#d19b35]" /> {todayLongLabel()}</div>
        <h1 className="max-w-[720px] font-serif text-[39px] leading-[.98] tracking-[-0.045em] text-[#173e49] md:text-[52px]">{greetingForNow()}, {user?.name?.split(' ')[0] ?? 'there'}.<br /><span className="text-[#3d9a7e]">{role === 'lead' ? 'Your projects are in view.' : 'The portfolio is in view.'}</span></h1>
        <p className="mt-4 max-w-[570px] text-[13px] leading-6 text-muted-foreground">{role === 'lead' ? `A working view of ${myProjectCount} ${myProjectCount === 1 ? 'project' : 'projects'} you manage, plus the updates that need your attention.` : `A composed read on ${stats.total} active projects across Encalm Hospitality. ${atRisk.length} ${atRisk.length === 1 ? 'decision needs' : 'decisions need'} your attention this week.`}</p>
      </div>
      <div className="flex items-center gap-2"><span className="grid size-10 place-items-center rounded-xl bg-[#e4f1ec] text-[#2e7c67]"><Activity size={18} /></span><span><span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Portfolio pulse</span><span className="mt-1 block text-[13px] font-bold text-[#2e7c67]">Steady, with movement</span></span></div>
    </section>

    <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Active projects" value={`${stats.total}`} detail={`Across ${stats.locationCount} ${stats.locationCount === 1 ? 'location' : 'locations'}`} icon={BarChart3} accent="bg-[#3d9a7e]" delay="stagger-1" />
      <KpiCard label="Portfolio AOP" value={formatCrore(totalAop)} detail={`${formatCrore(totalAop - projects.reduce((sum, project) => sum + project.spent, 0))} unspent`} icon={CircleDollarSign} accent="bg-[#d19b35]" delay="stagger-2" />
      <KpiCard label="Average progress" value={`${averageProgress}%`} detail={`${onTrackCount} of ${stats.total || 0} on track`} icon={TrendingUp} accent="bg-[#2e7c67]" delay="stagger-3" />
      <KpiCard label="Needs attention" value={`${atRisk.length}`} detail={`${stats.highPriorityCount} high priority`} icon={AlertTriangle} accent="bg-[#d66254]" delay="stagger-4" />
    </section>

    <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-[#173e49]/[.03] md:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Portfolio health</p><h2 className="mt-2 text-[19px] font-extrabold tracking-[-.03em]">Where management time goes</h2></div><span className="rounded-full bg-[#e4f1ec] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] text-[#2e7c67]">Live view</span></div>
        <div className="mt-7 grid gap-7 md:grid-cols-[.75fr_1.25fr] md:items-center">
          <div className="relative mx-auto grid size-40 place-items-center rounded-full" role="img" aria-label={`${onTrackCount} on track, ${atRiskCount} at risk, ${delayedCount} delayed`} style={{ background: healthGradient }}><div className="grid size-[118px] place-items-center rounded-full bg-card text-center"><span className="font-mono text-[27px] font-medium text-foreground">{averageProgress}%</span><span className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">avg. complete</span></div></div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1"><div className="flex items-center justify-between border-b border-border/70 pb-3"><span className="flex items-center gap-2 text-[12px] font-semibold"><span className="size-2 rounded-full bg-[#3d9a7e]" />On track</span><span className="font-mono text-[12px] font-medium">{onTrackCount} <span className="text-muted-foreground">/ {projects.length}</span></span></div><div className="flex items-center justify-between border-b border-border/70 pb-3"><span className="flex items-center gap-2 text-[12px] font-semibold"><span className="size-2 rounded-full bg-[#d19b35]" />At risk</span><span className="font-mono text-[12px] font-medium">{atRiskCount} <span className="text-muted-foreground">/ {projects.length}</span></span></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[12px] font-semibold"><span className="size-2 rounded-full bg-[#d66254]" />Delayed</span><span className="font-mono text-[12px] font-medium">{delayedCount} <span className="text-muted-foreground">/ {projects.length}</span></span></div></div>
        </div>
      </div>
      <div className="rounded-2xl border border-[#eadcb1] bg-[#fbf1d8] p-5 shadow-sm shadow-[#d19b35]/[.08] md:p-6">
        <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#9a711f]">Management attention</p><h2 className="mt-2 text-[19px] font-extrabold tracking-[-.03em] text-[#173e49]">{atRisk.length ? `${Math.min(atRisk.length, 3)} ${Math.min(atRisk.length, 3) === 1 ? 'thing' : 'things'} to unblock` : 'Nothing blocked'}</h2></div><AlertTriangle size={18} className="text-[#b78625]" /></div>
        <div className="mt-5 space-y-2.5">{atRisk.length ? atRisk.slice(0, 3).map((project) => <AttentionItem key={project.id} project={project} />) : <p className="rounded-xl border border-[#eadcb1] bg-white/60 p-4 text-[11px] leading-5 text-[#8e681c]">Every project is reporting on track. Nothing needs a decision this week.</p>}</div>
      </div>
    </section>

    <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="min-w-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Project portfolio</p><span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] text-muted-foreground">{filteredProjects.length} shown</span></div><h2 className="mt-2 text-[22px] font-extrabold tracking-[-.04em]">All work in motion</h2></div><div className="flex items-center gap-2"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground focus-within:border-[#c9a04e] sm:w-56 sm:flex-none"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} data-testid="input-search-projects" placeholder="Search projects" className="min-w-0 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70" /></label><button type="button" data-testid="button-toggle-filters" onClick={() => setShowFilters((value) => !value)} className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-bold ${showFilters || hasFilters ? 'border-[#c9a04e] bg-[#fbf1d8] text-[#8e681c]' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}><Filter size={14} /> <span className="hidden sm:inline">Filters</span></button></div></div>
        {showFilters && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 fade-up"><div className="mr-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground"><SlidersHorizontal size={13} /> Refine</div><select value={location} onChange={(event) => setLocation(event.target.value as 'All' | Location)} data-testid="select-location-filter" className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"><option value="All">All locations</option>{locations.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value as 'All' | Category)} data-testid="select-category-filter" className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"><option value="All">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={health} onChange={(event) => setHealth(event.target.value as 'All' | Health)} data-testid="select-health-filter" className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"><option value="All">All health</option>{healthOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>{hasFilters && <button type="button" data-testid="button-clear-filters" onClick={clearFilters} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#b2473d] hover:bg-[#fae5e1]">Clear <X size={12} /></button>}</div>}
        <div className="mt-4 hidden max-h-[560px] overflow-y-auto rounded-2xl border border-border bg-card shadow-sm shadow-[#173e49]/[.03] md:block" style={{ maxHeight: portfolioExpanded ? undefined : `${portfolioHeight}px` } as CSSProperties}>
          <div className="flex items-center justify-between gap-4 border-b border-border bg-[#f7f4ec] px-5 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Portfolio register</span>
            <div className="flex items-center gap-3">
              <label className="hidden items-center gap-2 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground lg:flex">
                <SlidersHorizontal size={12} />
                <input aria-label="Table height" type="range" min="280" max="560" step="20" value={portfolioHeight} onChange={(event) => setPortfolioHeight(Number(event.target.value))} className="h-1 w-20 accent-[#3d9a7e]" />
              </label>
              <button type="button" onClick={() => setPortfolioExpanded((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted" aria-expanded={portfolioExpanded}>
                {portfolioExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                {portfolioExpanded ? 'Compact' : 'Expand'}
              </button>
            </div>
          </div>
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(220px,1.5fr)_110px_130px_110px_120px_120px_30px] gap-4 border-b border-border bg-[#f7f4ec] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground"><span>Project</span><span>Health</span><span>Progress</span><span>AOP</span><span>Spent</span><span>Target date</span><span /></div>{filteredProjects.length ? filteredProjects.map((project, index) => <ProjectRow key={project.id} project={project} index={index} />) : <div className="p-10 text-center text-[12px] text-muted-foreground">No projects match this view. Try a broader search.</div>}
        </div>
        <div className="mt-4 grid gap-3 md:hidden">{filteredProjects.length ? filteredProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />) : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">No projects match this view.</div>}</div>
      </div>
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-[#173e49]/[.03]"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Next up</p><h2 className="mt-2 text-[18px] font-extrabold tracking-[-.03em]">Upcoming milestones</h2></div><CalendarDays size={18} className="text-muted-foreground/60" /></div><div className="mt-5 space-y-4">{upcoming.map((project) => <Link href={`/project/${project.id}`} data-testid={`link-milestone-${project.id}`} key={project.id} className="group flex gap-3"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#f7f4ec] text-[#9a711f]"><Clock3 size={14} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-bold">{project.nextMilestone}</span><ArrowUpRight size={13} className="shrink-0 text-muted-foreground/45 group-hover:text-foreground" /></span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{project.name}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[.1em] text-[#9a711f]">{milestoneWindowLabel(project.nextMilestoneDate)}</span></span></Link>)}</div></div>
        <div className="rounded-2xl border border-[#d0e0d9] bg-[#edf5f0] p-5"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#2e7c67]">Near completion</p><h2 className="mt-2 text-[18px] font-extrabold tracking-[-.03em] text-[#173e49]">Opening sequence</h2></div><CheckCircle2 size={18} className="text-[#3d9a7e]" /></div><p className="mt-4 text-[11px] leading-5 text-[#517167]">T1 Concourse Club is entering readiness. One opening walk remains before the launch team takes the lead.</p><div className="mt-5 flex items-center justify-between"><div className="flex -space-x-2"><span className="grid size-7 place-items-center rounded-full border-2 border-[#edf5f0] bg-[#d6a95d] text-[9px] font-bold text-[#173e49]">KB</span><span className="grid size-7 place-items-center rounded-full border-2 border-[#edf5f0] bg-[#c7dcd2] text-[9px] font-bold text-[#173e49]">NS</span><span className="grid size-7 place-items-center rounded-full border-2 border-[#edf5f0] bg-[#edd4b9] text-[9px] font-bold text-[#173e49]">+4</span></div><Link href="/project/delhi-t1-concourse" data-testid="link-near-completion" className="flex items-center gap-1 text-[11px] font-bold text-[#2e7c67] hover:text-[#173e49]">Open project <ArrowUpRight size={13} /></Link></div></div>
      </div>
    </section>

    <footer className="mt-12 flex flex-col justify-between gap-2 border-t border-border/70 pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground sm:flex-row"><span>Encalm Hospitality · Project control office</span><span>Portfolio view · {todayLongLabel()}</span></footer>
  </div>;
}

/** Builds the donut gradient from live counts instead of fixed stops. */
function buildHealthGradient(stats: { total: number; onTrackCount: number; atRiskCount: number; delayedCount: number; notStartedCount: number }): string {
  if (stats.total === 0) return '#e4e4d9';

  const segments: [string, number][] = [
    ['#3d9a7e', stats.onTrackCount],
    ['#d19b35', stats.atRiskCount],
    ['#d66254', stats.delayedCount],
    ['#8c938d', stats.notStartedCount],
  ];

  const stops: string[] = [];
  let cursor = 0;
  for (const [colour, count] of segments) {
    if (count <= 0) continue;
    const end = cursor + (count / stats.total) * 100;
    stops.push(`${colour} ${cursor}% ${end}%`);
    cursor = end;
  }

  return `conic-gradient(${stops.join(', ')})`;
}

/** Describes how soon a milestone falls, relative to today. */
function milestoneWindowLabel(isoDate: string): string {
  const target = parseIsoDate(isoDate);
  if (!target) return 'Date not set';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - startOfToday.getTime()) / 86400000);

  if (days < 0) return 'Overdue';
  if (days <= 7) return 'This week';
  if (days <= 30) return 'Next 30 days';
  return 'Later';
}
