import { useMemo, useState, useRef, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Download,
  FileBarChart,
  Filter,
  Flag,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  Camera,
  Upload,
  Sparkles,
  Building2,
  MapPin,
} from 'lucide-react';
import { categories, formatCrore, healthOptions, locations, projectStatuses, issueCategories, type Category, type Health, type Project, type ProjectStatus, type IssueCategory, type IssueStatus, type ProjectIssue, type SitePhoto, type PhotoCategory, photoCategories, type ArchitecturalAreaProgram } from '@/data/projects';
import { AreaProgramEditorModal, emptyAreaProgram } from '@/components/project-area-program';
import { useAppState } from '@/state/app-state';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { CRORE } from '@/data/projects';
import { formatFullDate, isValidIsoDate, todayIso, todayLabel } from '@/lib/date';
import { initialsOf, leadName } from '@/data/users';
import { formatRatio, getCommercialSummary, getPortfolioCommercialSummary, sortProjectsIncompleteFirst } from '@/lib/calculations';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { PhotoUploadDialog } from '@/components/photo-upload-dialog';
import { getIssueStatusTheme, issueStatusOptions } from '@/lib/issue-theme';

export type WorkspaceView = 'projects' | 'my-projects' | 'timeline' | 'milestones' | 'issues' | 'commercial' | 'updates' | 'photos' | 'reports' | 'new-project' | 'team';

const healthTone: Record<Health, string> = { 'On track': 'bg-[#e4f1ec] text-[#2e7c67]', 'At risk': 'bg-[#f8edcf] text-[#9a711f]', Delayed: 'bg-[#fae5e1] text-[#b2473d]', 'Not started': 'bg-[#eef0ed] text-[#69716b]' };

export const statusTone: Record<ProjectStatus, string> = {
  'Yet to start': 'bg-[#eef0ed] text-[#69716b]',
  'In Design': 'bg-[#e8f1f5] text-[#2c6e8a]',
  'In Tendering': 'bg-[#fef4e6] text-[#b37418]',
  'Under Construction': 'bg-[#fff0eb] text-[#c2583f]',
  'Operational': 'bg-[#e4f1ec] text-[#2e7c67]',
  'On Hold': 'bg-[#fae5e1] text-[#b2473d]',
};

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#9a711f]">{eyebrow}</p><h1 className="mt-3 font-serif text-[42px] leading-none tracking-[-.05em] text-[#173e49] md:text-[52px]">{title}</h1><p className="mt-4 max-w-[620px] text-[13px] leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function ProjectTable({ rows }: { rows: Project[] }) {
  const { deleteProject, role } = useAppState();
  const { toast } = useToast();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <>
      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground whitespace-nowrap">
                <th className="py-3.5 pl-5 pr-3 min-w-[220px]">Project</th>
                <th className="px-3 py-3.5 w-28">Location</th>
                <th className="px-3 py-3.5 w-36">Status</th>
                <th className="px-3 py-3.5 w-32">Area</th>
                <th className="px-3 py-3.5 w-36">Lead</th>
                <th className="px-3 py-3.5 w-36">Progress</th>
                <th className="px-3 py-3.5 w-28">Target</th>
                <th className="px-3 py-3.5 w-28">Health</th>
                <th className="py-3.5 pl-2 pr-5 text-right w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[12px] text-muted-foreground">
                    No projects match this view. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                rows.map((project) => (
                  <tr
                    key={project.id}
                    className="transition hover:bg-[#fcfaf5]"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <Link href={`/project/${project.id}`} className="group inline-block">
                        <span className="block text-[12px] font-bold text-foreground group-hover:text-[#2e7c67] group-hover:underline transition">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">
                          {project.code}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <MapPin size={11} className="text-muted-foreground/70" />
                        {project.location}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}>
                        {project.status || 'Yet to start'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap font-mono text-[10px] font-bold text-foreground" title={project.area || '—'}>
                      {project.area ? (
                        project.area.includes('SQ.FT.')
                          ? project.area.split('/')[1]?.trim() || project.area
                          : project.area
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap font-medium text-foreground">
                      {leadName(project.leadId)}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5 min-w-[100px]">
                        <div className="h-1.5 w-16 rounded-full bg-[#e7e7dc] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2e7c67] transition-all"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-foreground">
                          {project.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap font-medium text-muted-foreground">
                      {project.targetLabel}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${healthTone[project.health]}`}>
                        {project.health}
                      </span>
                    </td>
                    <td className="py-3.5 pl-2 pr-5 text-right whitespace-nowrap">
                      {role === 'coordinator' ? (
                        <button
                          type="button"
                          title={`Delete ${project.name}`}
                          onClick={() => setProjectToDelete(project)}
                          className="inline-grid size-7 place-items-center rounded-lg text-muted-foreground/60 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span className="inline-block size-7" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-700">
                <Trash2 size={20} />
              </span>
              <h3 className="text-[17px] font-bold text-foreground">Delete Project</h3>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Are you sure you want to permanently delete <strong className="font-semibold text-foreground">"{projectToDelete.name}"</strong>? This will remove all associated stages, milestones, and issues from the database.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProjectToDelete(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const success = await deleteProject(projectToDelete.id);
                    if (success) {
                      toast({
                        title: 'Project deleted',
                        description: `"${projectToDelete.name}" was permanently removed.`,
                      });
                      setProjectToDelete(null);
                    } else {
                      toast({
                        variant: 'destructive',
                        title: 'Delete failed',
                        description: 'Could not delete project from database.',
                      });
                    }
                  } catch (err: any) {
                    toast({
                      variant: 'destructive',
                      title: 'Delete failed',
                      description: err.message || 'An error occurred.',
                    });
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[11px] font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProjectsView({ mine = false }: { mine?: boolean }) {
  const { projects, user } = useAppState();
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<'All' | Health>('All');
  const [location, setLocation] = useState<'All' | (typeof locations)[number]>('All');
  const [category, setCategory] = useState<'All' | Category>('All');
  const [status, setStatus] = useState<'All' | ProjectStatus>('All');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      if (mine && project.leadId !== user?.id) return false;
      const haystack = `${project.name} ${project.code} ${project.category} ${project.location} ${leadName(project.leadId)}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (health !== 'All' && project.health !== health) return false;
      if (location !== 'All' && project.location !== location) return false;
      if (category !== 'All' && project.category !== category) return false;
      if (status !== 'All' && (project.status || 'Yet to start') !== status) return false;
      return true;
    });
    return sortProjectsIncompleteFirst(filtered);
  }, [projects, mine, user?.id, search, health, location, category, status]);

  const hasFilters = Boolean(search) || health !== 'All' || location !== 'All' || category !== 'All' || status !== 'All';
  const clearFilters = () => {
    setSearch('');
    setHealth('All');
    setLocation('All');
    setCategory('All');
    setStatus('All');
  };

  return (
    <>
      <PageHeader
        eyebrow={mine ? 'Project lead workspace' : 'Project register'}
        title={mine ? 'My projects' : 'All projects'}
        description={mine ? 'The projects you own, the milestones ahead, and the updates that need to move.' : 'Explore every Encalm project with the context needed for a useful first read.'}
        action={mine ? <Link href="/new-project" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]"><Plus size={15} /> New project</Link> : undefined}
      />
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap items-center">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, code or lead" className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold">
          <option value="All">All categories ({projects.length})</option>
          <option value="Lounge">Lounges & Spas ({projects.filter((p) => p.category === 'Lounge').length})</option>
          <option value="Kitchen">Central Kitchens ({projects.filter((p) => p.category === 'Kitchen').length})</option>
          <option value="Other">Operations & Support ({projects.filter((p) => p.category === 'Other').length})</option>
          <option value="Encalm Eats">Encalm Eats ({projects.filter((p) => p.category === 'Encalm Eats').length})</option>
          <option value="Hotel">Airport Hotels ({projects.filter((p) => p.category === 'Hotel').length})</option>
        </select>
        <select value={location} onChange={(event) => setLocation(event.target.value as typeof location)} className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold">
          <option value="All">All locations</option>
          {locations.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold">
          <option value="All">All statuses</option>
          {projectStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={health} onChange={(event) => setHealth(event.target.value as typeof health)} className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold">
          <option value="All">All health</option>
          {healthOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-10 rounded-xl border border-[#fae5e1] bg-[#fae5e1]/50 px-3 text-[11px] font-bold text-[#b2473d] hover:bg-[#fae5e1] transition"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>Showing {rows.length} of {projects.length} authentic facilities</span>
        <Link href="/area-sheet" className="font-bold text-[#173e49] hover:text-[#2e7c67] hover:underline">
          View Master Project Area Sheet &rarr;
        </Link>
      </div>
      <ProjectTable rows={rows} />
    </>
  );
}

function TimelineView() {
  const { projects } = useAppState();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<'All' | (typeof locations)[number]>('All');
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
          {locations.map((loc) => (
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
            const activePhase = project.phases.find((ph) => ph.status === 'active');
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
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e7e7dc]">
                        <div
                          className="h-full rounded-full bg-[#3d9a7e] transition-all"
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
                      const isComplete = phase.status === 'complete';
                      const isActive = phase.status === 'active';
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

function MilestonesView() {
  const { projects, role, canEdit, canEditProject, approveMilestone, completeMilestone } = useAppState();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'All' | 'Approval' | 'Upcoming' | 'Late' | 'Complete'>('All');

  const allMilestones = useMemo(() => {
    return projects
      .flatMap((project) =>
        project.milestones.map((milestone) => ({
          ...milestone,
          id: (milestone as any).id || `${project.id}-${milestone.title}`,
          project,
        }))
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
                      {isComplete ? <Check size={16} strokeWidth={3} /> : isLate ? <AlertTriangle size={16} /> : <Flag size={16} />}
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

function IssuesView() {
  const { projects, canEdit, canEditProject, updateIssue, addIssue } = useAppState();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Open' | 'Resolved'>('All');
  const [scope, setScope] = useState<'with-issues' | 'all'>('with-issues');
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({});
  const [addingForProjectId, setAddingForProjectId] = useState<string | null>(null);

  const [newDraft, setNewDraft] = useState({
    title: '',
    detail: '',
    category: 'Design' as IssueCategory,
    severity: 'Medium' as 'High' | 'Medium' | 'Low',
    stage: '',
    owner: '',
    dueDate: '',
    issueAriseDate: todayLabel(),
    targetClosureDate: '',
    impactCost: '',
    impactSchedule: '',
    impactScope: '',
    action: '',
  });

  const setDraftField = (key: keyof typeof newDraft, value: string) =>
    setNewDraft((cur) => ({ ...cur, [key]: value }));

  // Aggregate and filter issues per project
  const projectIssueData = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects.map((project) => {
      const allProjectIssues = project.issues.map((issue, issueIndex) => ({
        ...issue,
        project,
        issueIndex,
      }));

      const filteredIssues = allProjectIssues.filter((issue) => {
        if (filter === 'Critical' && issue.severity !== 'High') return false;
        if (filter === 'Open' && (issue.status === 'Resolved' || issue.status === 'Closed')) return false;
        if (filter === 'Resolved' && issue.status !== 'Resolved' && issue.status !== 'Closed') return false;

        if (term) {
          const matchProject = `${project.name} ${project.code} ${project.location} ${leadName(project.leadId)}`.toLowerCase().includes(term);
          const matchIssue = `${issue.title} ${issue.detail} ${issue.owner} ${issue.category ?? ''} ${issue.stage ?? ''}`.toLowerCase().includes(term);
          if (!matchProject && !matchIssue) return false;
        }

        return true;
      });

      const totalProjectIssuesCount = project.issues.length;
      const criticalCount = project.issues.filter((i) => i.severity === 'High').length;
      const openCount = project.issues.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed').length;
      const resolvedCount = project.issues.filter((i) => i.status === 'Resolved' || i.status === 'Closed').length;

      const projectMatchesSearch = term
        ? `${project.name} ${project.code} ${project.location} ${leadName(project.leadId)}`.toLowerCase().includes(term)
        : true;

      return {
        project,
        allProjectIssues,
        filteredIssues,
        totalProjectIssuesCount,
        criticalCount,
        openCount,
        resolvedCount,
        projectMatchesSearch,
      };
    });
  }, [projects, search, filter]);

  // Portfolio-level summary counts
  const portfolioCounts = useMemo(() => {
    let total = 0;
    let critical = 0;
    let open = 0;
    let resolved = 0;
    let projectsWithIssues = 0;

    for (const p of projects) {
      if (p.issues.length > 0) projectsWithIssues++;
      for (const i of p.issues) {
        total++;
        if (i.severity === 'High') critical++;
        if (i.status !== 'Resolved' && i.status !== 'Closed') open++;
        if (i.status === 'Resolved' || i.status === 'Closed') resolved++;
      }
    }
    return { total, critical, open, resolved, projectsWithIssues };
  }, [projects]);

  // Filter and sort project cards to display (incomplete facilities with issues first)
  const displayedProjects = useMemo(() => {
    const list = projectIssueData.filter((item) => {
      if (search.trim()) {
        return item.projectMatchesSearch || item.filteredIssues.length > 0;
      }
      if (scope === 'with-issues') {
        return item.filteredIssues.length > 0;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      // 1. Projects with matching issues come before projects with none
      if (a.filteredIssues.length > 0 && b.filteredIssues.length === 0) return -1;
      if (a.filteredIssues.length === 0 && b.filteredIssues.length > 0) return 1;

      // 2. Incomplete projects come before completed ones
      const aIncomplete = (a.project.progress ?? 0) < 100 && a.project.status !== 'Operational';
      const bIncomplete = (b.project.progress ?? 0) < 100 && b.project.status !== 'Operational';
      if (aIncomplete && !bIncomplete) return -1;
      if (!aIncomplete && bIncomplete) return 1;

      // 3. Higher critical count first
      if (b.criticalCount !== a.criticalCount) {
        return b.criticalCount - a.criticalCount;
      }

      return a.project.name.localeCompare(b.project.name);
    });
  }, [projectIssueData, search, scope]);

  // Determine if a project is expanded
  const isProjectExpanded = (projectId: string, hasMatchingIssues: boolean) => {
    if (projectId in userToggled) {
      return !!userToggled[projectId];
    }
    // Default open if project has matching issues
    return hasMatchingIssues;
  };

  const toggleProject = (projectId: string, currentState: boolean) => {
    setUserToggled((prev) => ({ ...prev, [projectId]: !currentState }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of displayedProjects) {
      next[item.project.id] = true;
    }
    setUserToggled(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of displayedProjects) {
      next[item.project.id] = false;
    }
    setUserToggled(next);
  };

  const handleStatusChange = (projectId: string, issueIndex: number, newStatus: string) => {
    if (!canEditProject(projectId)) {
      toast({
        title: 'Action not allowed',
        description: 'You can only update issues for projects allotted to you.',
        variant: 'destructive',
      });
      return;
    }
    updateIssue(projectId, issueIndex, { status: newStatus as any });
    toast({
      title: 'Issue Status Updated',
      description: `Issue updated to "${newStatus}".`,
    });
  };

  const handleOpenAddForm = (project: Project) => {
    if (!canEditProject(project)) {
      toast({
        title: 'Action not allowed',
        description: 'You can only log issues for projects allotted to you.',
        variant: 'destructive',
      });
      return;
    }
    setAddingForProjectId(project.id);
    setUserToggled((prev) => ({ ...prev, [project.id]: true }));
    setNewDraft({
      title: '',
      detail: '',
      category: 'Design',
      severity: 'Medium',
      stage: project.phases.find((ph) => ph.status === 'active')?.name ?? project.phases[0]?.name ?? '',
      owner: '',
      dueDate: '',
      issueAriseDate: todayLabel(),
      targetClosureDate: '',
      impactCost: '',
      impactSchedule: '',
      impactScope: '',
      action: '',
    });
  };

  const handleSaveNewIssue = (projectId: string) => {
    if (!canEditProject(projectId)) {
      toast({
        variant: 'destructive',
        title: 'Action not allowed',
        description: 'You can only log issues for projects allotted to you.',
      });
      return;
    }

    if (!newDraft.title.trim() || !newDraft.detail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Required fields missing',
        description: 'Please provide both an issue title and description.',
      });
      return;
    }

    addIssue(projectId, {
      ...newDraft,
      owner: newDraft.owner.trim() || 'Project Lead',
      status: 'Open',
      dateRaised: newDraft.issueAriseDate || todayLabel(),
      issueAriseDate: newDraft.issueAriseDate || todayLabel(),
      dueDate: newDraft.targetClosureDate || newDraft.dueDate,
      targetClosureDate: newDraft.targetClosureDate || newDraft.dueDate,
    });

    setAddingForProjectId(null);
    toast({
      title: 'Issue Logged',
      description: `Added "${newDraft.title}" to project register.`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Execution Register"
        title="Issues & risks"
        description="A project-centric register of the blockers, decisions, and risks that can change project outcomes."
      />

      {/* Filter and Control Bar */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project, code, lead, issue title or owner..."
              className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
            />
          </label>

          {/* Project View Scope Toggle */}
          <div className="flex rounded-xl border border-border bg-background p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setScope('with-issues')}
              className={`rounded-lg px-3 py-1.5 transition ${
                scope === 'with-issues' ? 'bg-[#173e49] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Projects with issues ({portfolioCounts.projectsWithIssues})
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded-lg px-3 py-1.5 transition ${
                scope === 'all' ? 'bg-[#173e49] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All projects ({projects.length})
            </button>
          </div>
        </div>

        {/* Issue Status Tabs & Quick Expand/Collapse Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(['All', 'Critical', 'Open', 'Resolved'] as const).map((tab) => (
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
                {tab === 'Critical' ? 'Critical (High)' : tab}
                <span className="ml-1.5 font-mono text-[9px] opacity-70">
                  (
                  {tab === 'All'
                    ? portfolioCounts.total
                    : tab === 'Critical'
                      ? portfolioCounts.critical
                      : tab === 'Open'
                        ? portfolioCounts.open
                        : portfolioCounts.resolved}
                  )
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted hover:text-foreground"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted hover:text-foreground"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* Primary Project List with Issues Sub-Sections */}
      <div className="mt-7 space-y-5">
        {displayedProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <ShieldAlert size={28} className="mx-auto text-muted-foreground/60" />
            <h3 className="mt-3 text-[14px] font-extrabold text-foreground">No projects match this issues filter</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Try switching to "All projects" or choosing a different filter tab above.
            </p>
          </div>
        ) : (
          displayedProjects.map((item) => {
            const { project, filteredIssues } = item;
            const expanded = isProjectExpanded(project.id, filteredIssues.length > 0);
            const highSeverityIssues = filteredIssues.filter((i) => i.severity === 'High');
            const standardIssues = filteredIssues.filter((i) => i.severity !== 'High');
            const isAdding = addingForProjectId === project.id;

            return (
              <div
                key={project.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-[#d9c585]"
              >
                {/* Project Header Bar */}
                <div
                  className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center bg-card hover:bg-[#fcf5e5]/50 transition cursor-pointer select-none"
                  onClick={() => toggleProject(project.id, expanded)}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={expanded ? 'Collapse project' : 'Expand project'}
                      className="mt-1 grid size-7 place-items-center rounded-lg border border-border bg-background text-muted-foreground"
                    >
                      {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/project/${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[14px] font-extrabold text-foreground hover:text-[#2e7c67] hover:underline"
                        >
                          {project.name}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}>
                          {project.status || 'Yet to start'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${healthTone[project.health]}`}>
                          {project.health}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                        {project.code} · {project.location} · {project.category} · Lead: {leadName(project.leadId)}
                      </p>
                    </div>
                  </div>

                  {/* Right Header Metrics & Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      {item.criticalCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fae5e1] px-2.5 py-1 font-bold text-[#b2473d]">
                          <ShieldAlert size={11} /> {item.criticalCount} Critical
                        </span>
                      )}
                      {item.openCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f8edcf] px-2.5 py-1 font-bold text-[#9a711f]">
                          <AlertTriangle size={11} /> {item.openCount} Open
                        </span>
                      )}
                      <span className="rounded-full bg-[#eef0ed] px-2.5 py-1 font-bold text-muted-foreground">
                        {item.totalProjectIssuesCount} {item.totalProjectIssuesCount === 1 ? 'issue' : 'issues'}
                      </span>
                    </div>

                    {canEditProject(project) && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddForm(project)}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#d6a95d] px-3 py-1.5 text-[10px] font-bold text-[#173e49] hover:bg-[#e2bd73]"
                      >
                        <Plus size={12} /> Log issue
                      </button>
                    )}

                    <Link
                      href={`/project/${project.id}`}
                      className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      View project <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>

                {/* Sub-Section: Issues and Risks within Project */}
                {expanded && (
                  <div className="border-t border-border/70 bg-[#fbfaf6]/70 p-5 md:p-6">
                    {/* Inline Form to Add an Issue to this specific Project */}
                    {isAdding && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveNewIssue(project.id);
                        }}
                        className="mb-6 space-y-3 rounded-2xl border border-[#eadcb1] bg-[#fff8e9] p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-extrabold text-[#9a711f]">Log issue for {project.name}</p>
                          <button
                            type="button"
                            onClick={() => setAddingForProjectId(null)}
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            required
                            value={newDraft.title}
                            onChange={(e) => setDraftField('title', e.target.value)}
                            placeholder="Issue or risk title *"
                            className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                          />
                          <select
                            value={newDraft.category}
                            onChange={(e) => setDraftField('category', e.target.value)}
                            className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                          >
                            {issueCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                Category: {cat}
                              </option>
                            ))}
                          </select>
                          <select
                            value={newDraft.stage}
                            onChange={(e) => setDraftField('stage', e.target.value)}
                            className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                          >
                            {project.phases.map((ph, idx) => (
                              <option key={`${ph.name}-${idx}`} value={ph.name}>
                                Stage: {ph.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={newDraft.severity}
                            onChange={(e) => setDraftField('severity', e.target.value)}
                            className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                          >
                            <option value="High">Severity: High (Critical decision)</option>
                            <option value="Medium">Severity: Medium (Standard risk)</option>
                            <option value="Low">Severity: Low (Minor tracking)</option>
                          </select>
                          <input
                            value={newDraft.owner}
                            onChange={(e) => setDraftField('owner', e.target.value)}
                            placeholder="Owner / Responsible person"
                            className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Arise date</span>
                              <input
                                type="date"
                                value={newDraft.issueAriseDate}
                                onChange={(e) => setDraftField('issueAriseDate', e.target.value)}
                                className="h-10 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Target closure</span>
                              <input
                                type="date"
                                value={newDraft.targetClosureDate}
                                onChange={(e) => setDraftField('targetClosureDate', e.target.value)}
                                className="h-10 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
                              />
                            </label>
                          </div>
                        </div>

                        <textarea
                          required
                          value={newDraft.detail}
                          onChange={(e) => setDraftField('detail', e.target.value)}
                          placeholder="Describe the issue, root cause, and current situation *"
                          rows={2}
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[11px]"
                        />

                        <div className="grid gap-3 md:grid-cols-4">
                          <input
                            value={newDraft.impactSchedule}
                            onChange={(e) => setDraftField('impactSchedule', e.target.value)}
                            placeholder="Schedule impact (e.g. +7 days)"
                            className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
                          />
                          <input
                            value={newDraft.impactCost}
                            onChange={(e) => setDraftField('impactCost', e.target.value)}
                            placeholder="Cost impact (e.g. ₹5 Lakhs)"
                            className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
                          />
                          <input
                            value={newDraft.impactScope}
                            onChange={(e) => setDraftField('impactScope', e.target.value)}
                            placeholder="Scope impact"
                            className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
                          />
                          <input
                            value={newDraft.action}
                            onChange={(e) => setDraftField('action', e.target.value)}
                            placeholder="Immediate next action"
                            className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button type="submit" className="rounded-lg bg-[#173e49] px-4 py-2 text-[10px] font-bold text-white">
                            Save issue
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingForProjectId(null)}
                            className="rounded-lg border border-border bg-white px-3 py-2 text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {filteredIssues.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-white/70 p-6 text-center">
                        <p className="text-[11px] text-muted-foreground">
                          No issues or risks matching "{filter}" for {project.name}.
                        </p>
                        {canEditProject(project) && !isAdding && (
                          <button
                            type="button"
                            onClick={() => handleOpenAddForm(project)}
                            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#eadcb1] bg-[#fff8e9] px-3 py-1.5 text-[10px] font-bold text-[#9a711f]"
                          >
                            <Plus size={11} /> Log an issue for this project
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Sub-Section 1: Critical Issues (High Severity) */}
                        {highSeverityIssues.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 place-items-center rounded-lg bg-[#fae5e1] text-[#b2473d]">
                                <ShieldAlert size={14} />
                              </span>
                              <h4 className="text-[12px] font-extrabold text-[#b2473d] uppercase tracking-[.06em]">
                                Critical Issues & Blockers ({highSeverityIssues.length})
                              </h4>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              {highSeverityIssues.map((issue) => {
                                const statusTheme = getIssueStatusTheme(issue.status, 'High');
                                return (
                                <div
                                  key={`${project.id}-${issue.id ?? issue.title}-${issue.issueIndex}`}
                                  className={`rounded-xl border p-4 shadow-sm transition-colors duration-200 ${statusTheme.cardClass}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full bg-[#fae5e1] px-2 py-0.5 font-mono text-[8px] uppercase font-bold text-[#b2473d]">
                                          High Severity
                                        </span>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase font-bold ${statusTheme.badgeClass}`}>
                                          <span className="size-1.5 rounded-full" style={{ backgroundColor: statusTheme.dotColor }} />
                                          {issue.status || 'Open'}
                                        </span>
                                        {issue.category && (
                                          <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] text-muted-foreground border border-border/70">
                                            {issue.category}
                                          </span>
                                        )}
                                        {issue.stage && (
                                          <span className="font-mono text-[9px] text-muted-foreground">
                                            Stage: <strong className="text-foreground">{issue.stage}</strong>
                                          </span>
                                        )}
                                      </div>
                                      <h5 className="mt-2 text-[12px] font-bold text-foreground">{issue.title}</h5>
                                    </div>
                                  </div>

                                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{issue.detail}</p>

                                  {(issue.impactSchedule || issue.impactCost || issue.impactScope || issue.action) && (
                                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-2 text-[10px]">
                                      {issue.impactSchedule && (
                                        <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[#b2473d] border border-border/60">
                                          Schedule: {issue.impactSchedule}
                                        </span>
                                      )}
                                      {issue.impactCost && (
                                        <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[#b2473d] border border-border/60">
                                          Cost: {issue.impactCost}
                                        </span>
                                      )}
                                      {issue.action && (
                                        <span className="rounded-md bg-white/90 px-2 py-0.5 text-muted-foreground border border-border">
                                          Action: <strong className="text-foreground">{issue.action}</strong>
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 font-mono text-[9px]">
                                    <div className="text-muted-foreground">
                                      <span>Owner: <strong className="text-foreground">{issue.owner || 'Unassigned'}</strong></span>
                                      {(issue.targetClosureDate || issue.dueDate) && (
                                        <span className="ml-2">
                                          Target: <strong className="text-foreground">{issue.targetClosureDate || issue.dueDate}</strong>
                                        </span>
                                      )}
                                    </div>

                                    {canEditProject(project) ? (
                                      <select
                                        value={issue.status || 'Open'}
                                        onChange={(e) => handleStatusChange(project.id, issue.issueIndex, e.target.value)}
                                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer transition-colors shadow-sm ${statusTheme.selectClass}`}
                                      >
                                        {issueStatusOptions.map((opt) => (
                                          <option key={opt.status} value={opt.status} className="bg-white text-foreground">
                                            {opt.prefix} {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className={`rounded-full px-2 py-0.5 font-bold ${statusTheme.badgeClass}`}>
                                        {issue.status || 'Open'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Sub-Section 2: Standard Issues & Risks (Medium / Low Severity) */}
                        {standardIssues.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 place-items-center rounded-lg bg-[#f8edcf] text-[#9a711f]">
                                <AlertTriangle size={14} />
                              </span>
                              <h4 className="text-[12px] font-extrabold text-[#9a711f] uppercase tracking-[.06em]">
                                Standard Issues & Risks ({standardIssues.length})
                              </h4>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              {standardIssues.map((issue) => {
                                const statusTheme = getIssueStatusTheme(issue.status, issue.severity || 'Medium');
                                return (
                                <div
                                  key={`${project.id}-${issue.id ?? issue.title}-${issue.issueIndex}`}
                                  className={`rounded-xl border p-4 shadow-sm transition-colors duration-200 ${statusTheme.cardClass}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase font-bold ${
                                            issue.severity === 'Medium' ? 'bg-[#f8edcf] text-[#9a711f]' : 'bg-[#eef0ed] text-muted-foreground'
                                          }`}
                                        >
                                          {issue.severity || 'Medium'} Severity
                                        </span>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase font-bold ${statusTheme.badgeClass}`}>
                                          <span className="size-1.5 rounded-full" style={{ backgroundColor: statusTheme.dotColor }} />
                                          {issue.status || 'Open'}
                                        </span>
                                        {issue.category && (
                                          <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] text-muted-foreground border border-border/70">
                                            {issue.category}
                                          </span>
                                        )}
                                        {issue.stage && (
                                          <span className="font-mono text-[9px] text-muted-foreground">
                                            Stage: <strong className="text-foreground">{issue.stage}</strong>
                                          </span>
                                        )}
                                      </div>
                                      <h5 className="mt-2 text-[12px] font-bold text-foreground">{issue.title}</h5>
                                    </div>
                                  </div>

                                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{issue.detail}</p>

                                  {(issue.impactSchedule || issue.impactCost || issue.impactScope || issue.action) && (
                                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-2 text-[10px]">
                                      {issue.impactSchedule && (
                                        <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[#9a711f] border border-border/70">
                                          Schedule: {issue.impactSchedule}
                                        </span>
                                      )}
                                      {issue.impactCost && (
                                        <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[#9a711f] border border-border/70">
                                          Cost: {issue.impactCost}
                                        </span>
                                      )}
                                      {issue.action && (
                                        <span className="rounded-md bg-white/90 px-2 py-0.5 text-muted-foreground border border-border/70">
                                          Action: <strong className="text-foreground">{issue.action}</strong>
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 font-mono text-[9px]">
                                    <div className="text-muted-foreground">
                                      <span>Owner: <strong className="text-foreground">{issue.owner || 'Unassigned'}</strong></span>
                                      {(issue.targetClosureDate || issue.dueDate) && (
                                        <span className="ml-2">
                                          Target: <strong className="text-foreground">{issue.targetClosureDate || issue.dueDate}</strong>
                                        </span>
                                      )}
                                    </div>

                                    {canEditProject(project) ? (
                                      <select
                                        value={issue.status || 'Open'}
                                        onChange={(e) => handleStatusChange(project.id, issue.issueIndex, e.target.value)}
                                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer transition-colors shadow-sm ${statusTheme.selectClass}`}
                                      >
                                        {issueStatusOptions.map((opt) => (
                                          <option key={opt.status} value={opt.status} className="bg-white text-foreground">
                                            {opt.prefix} {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className={`rounded-full px-2 py-0.5 font-bold ${statusTheme.badgeClass}`}>
                                        {issue.status || 'Open'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function CommercialView() {
  const { projects, role, canEdit } = useAppState();
  const portfolio = getPortfolioCommercialSummary(projects);
  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Budget & AOP"
        description="Portfolio-level capital position, with a project view of Approved Budget (AOP), Committed Cost, Projected Cost, and Spent Till Date."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Approved Budget (AOP)</p>
            <p className="mt-4 text-[27px] font-extrabold">{formatCrore(portfolio.totalAop)}</p>
          </div>
          <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
            <div>{formatCrore(portfolio.totalAwarded)} committed</div>
            <div>{formatCrore(portfolio.totalSpent)} spent</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Committed / Awarded</p>
            <p className="mt-4 text-[27px] font-extrabold">{formatCrore(portfolio.totalAwarded)}</p>
          </div>
          <p className="mt-2 text-[10px] text-[#2e7c67]">{formatRatio(portfolio.awardRatePct)} commitment rate</p>
        </div>
        <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
          portfolio.totalProjectedCost > portfolio.totalAop ? 'border-[#f0c8c2] bg-[#fff6f5]' : 'border-border bg-card'
        }`}>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Projected Cost</p>
            <p className={`mt-4 text-[27px] font-extrabold ${
              portfolio.totalProjectedCost > portfolio.totalAop ? 'text-[#b2473d]' : ''
            }`}>{formatCrore(portfolio.totalProjectedCost)}</p>
          </div>
          <p className={`mt-2 text-[10px] font-bold ${
            portfolio.totalProjectedCost > portfolio.totalAop ? 'text-[#b2473d]' : 'text-muted-foreground'
          }`}>
            Variance: {portfolio.totalProjectedCost >= portfolio.totalAop ? '+' : ''}{formatCrore(portfolio.totalProjectedCost - portfolio.totalAop)}
            {portfolio.totalProjectedCost > portfolio.totalAop && ' (Over Budget)'}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Spent Till Date</p>
            <p className="mt-4 text-[27px] font-extrabold">{formatCrore(portfolio.totalSpent)}</p>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{formatRatio(portfolio.spentRatePct)} of awarded</p>
        </div>
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(180px,1.2fr)_110px_110px_110px_110px_110px_90px_80px] gap-3 border-b border-border bg-[#f7f4ec] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground md:grid">
          <span>Project</span>
          <span>Approved (AOP)</span>
          <span>Committed</span>
          <span>Projected</span>
          <span>Spent</span>
          <span>Cost Variance</span>
          <span>Status</span>
          <span>Access</span>
        </div>
        {projects.length === 0 && (
          <p className="px-5 py-10 text-center text-[12px] text-muted-foreground">No projects found. Create a project to view commercials.</p>
        )}
        {sortProjectsIncompleteFirst(projects).map((project) => {
          const commercial = getCommercialSummary(project);
          return (
            <div
              key={project.id}
              className={`grid gap-2 border-b border-border/70 px-5 py-4 md:grid-cols-[minmax(180px,1.2fr)_110px_110px_110px_110px_110px_90px_80px] md:items-center transition-colors ${
                commercial.overBudget ? 'bg-[#fffbfb] hover:bg-[#fff5f5]' : 'hover:bg-muted/30'
              }`}
            >
              <Link href={`/project/${project.id}`} className="text-[12px] font-bold hover:text-[#2e7c67] flex items-center gap-1.5">
                {commercial.overBudget && (
                  <span title="Over Budget" className="inline-block size-2 rounded-full bg-[#d66254] shrink-0" />
                )}
                <span className="truncate">{project.name}</span>
              </Link>
              <span className="text-[11px] font-mono">{formatCrore(commercial.aop)}</span>
              <span className={`text-[11px] font-mono ${commercial.overAwarded ? 'font-bold text-[#b2473d]' : ''}`}>
                {formatCrore(commercial.awarded)}
                {commercial.overAwarded && (
                  <span className="block text-[8px] uppercase font-bold tracking-wider text-[#b2473d]">Over AOP</span>
                )}
              </span>
              <span className={`text-[11px] font-mono font-semibold ${commercial.overBudget ? 'font-bold text-[#b2473d]' : ''}`}>
                {formatCrore(commercial.projectedCost)}
                {commercial.overBudget && (
                  <span className="block text-[8px] uppercase font-bold tracking-wider text-[#b2473d]">Overrun</span>
                )}
              </span>
              <span className={`text-[11px] font-mono ${commercial.overSpent ? 'font-bold text-[#b2473d]' : ''}`}>
                {formatCrore(commercial.spent)}
                {commercial.overSpent && (
                  <span className="block text-[8px] uppercase font-bold tracking-wider text-[#b2473d]">Over Awarded</span>
                )}
              </span>
              <div>
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-mono font-bold ${
                  commercial.costVariance > 0
                    ? 'bg-[#fae5e1] text-[#b2473d]'
                    : commercial.costVariance < 0
                      ? 'bg-[#edf5f0] text-[#2e7c67]'
                      : 'text-muted-foreground'
                }`}>
                  {commercial.costVariance > 0 ? `+${formatCrore(commercial.costVariance)}` : formatCrore(commercial.costVariance)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">{project.status || 'Yet to start'}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">{canEdit ? 'Editable' : 'View only'}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function UpdatesView() {
  const { projects, role, canEdit } = useAppState();
  const updates = projects.flatMap((project) => project.updates.map((update) => ({ ...update, project }))).sort((a, b) => b.date.localeCompare(a.date));
  return <><PageHeader eyebrow="Project updates" title="Update feed" description="A chronological read of the decisions, progress signals, and changes coming from project teams." action={canEdit ? <Link href="/my-projects" className="inline-flex items-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]"><Plus size={15} /> Post an update</Link> : undefined} /><div className="mt-8 max-w-[900px] space-y-3">{updates.length === 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">No project updates posted yet.</p>}{updates.slice(0, 15).map((update, index) => <Link href={`/project/${update.project.id}`} key={`${update.project.id}-${update.date}-${update.author}-${index}`} className="flex gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-[#d9c585]"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e4f1ec] text-[10px] font-bold text-[#2e7c67]">{initialsOf(update.author)}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-[12px]">{update.project.name}</strong><span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{update.date}</span></span><p className="mt-2 text-[12px] leading-5 text-muted-foreground">{update.text}</p><span className="mt-3 block font-mono text-[9px] uppercase tracking-[.1em] text-[#2e7c67]">Updated by {update.author} · {update.role}</span></span></Link>)}</div></>;
}

function ReportsView() {
  const { projects, addProject } = useAppState();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => {
    const total = projects.length;
    const delayed = projects.filter((project) => project.health === 'Delayed').length;
    const atRisk = projects.filter((project) => project.health === 'At risk').length;
    const averageProgress = total
      ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total)
      : 0;
    const openMilestones = projects.reduce(
      (sum, project) => sum + project.milestones.filter((milestone) => milestone.status !== 'complete').length,
      0,
    );
    const totalAop = projects.reduce((sum, project) => sum + project.aop, 0);
    return { total, delayed, atRisk, averageProgress, openMilestones, totalAop };
  }, [projects]);

  const exportCsv = () => {
    if (projects.length === 0) {
      toast({ title: 'Nothing to export', description: 'There are no projects in this view.' });
      return;
    }
    try {
      downloadCsv(buildPortfolioCsv(projects), `encalm-portfolio-${todayIso()}.csv`);
      toast({ title: 'Export ready', description: `${projects.length} projects written to CSV.` });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Your browser blocked the download. Check its download settings.',
      });
    }
  };

  const exportJsonBackup = () => {
    if (projects.length === 0) {
      toast({ title: 'Nothing to backup', description: 'There are no projects to backup.' });
      return;
    }
    const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `encalm-projects-backup-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup downloaded', description: `Full portfolio backup saved as JSON.` });
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error('Invalid backup file format');
        let count = 0;
        for (const p of imported) {
          if (p?.name && p?.location) {
            await addProject(p);
            count++;
          }
        }
        toast({ title: 'Backup restored', description: `Restored ${count} projects successfully.` });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Restore failed', description: err.message || 'Could not parse JSON file.' });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const cards: { label: string; value: string; icon: typeof TrendingUp }[] = [
    { label: 'Portfolio summary', value: `${summary.total} active projects`, icon: TrendingUp },
    { label: 'Project health', value: `${summary.atRisk} at risk · ${summary.delayed} delayed`, icon: ShieldAlert },
    { label: 'Project progress', value: `${summary.averageProgress}% average`, icon: Target },
    { label: 'Delayed projects', value: `${summary.delayed} need recovery plans`, icon: AlertTriangle },
    { label: 'Open milestones', value: `${summary.openMilestones} control points ahead`, icon: CalendarDays },
    { label: 'Commercial summary', value: `${formatCrore(summary.totalAop)} total AOP`, icon: CircleDollarSign },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Reports & Backup"
        title="Project reports & Data Persistence"
        description="Reporting views for portfolio reviews and full data backup & restore."
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{label}</span>
              <Icon size={17} className="text-muted-foreground/60" />
            </div>
            <p className="mt-5 text-[18px] font-extrabold">{value}</p>
            <button
              type="button"
              onClick={exportCsv}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-[#f7f4ec] px-3 py-2.5 text-[10px] font-bold hover:bg-[#fbf1d8]"
            >
              <FileBarChart size={14} /> Export as CSV
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[11px] font-extrabold text-white hover:bg-[#204f59]"
        >
          <Download size={15} /> Export full portfolio (CSV)
        </button>

        <button
          type="button"
          onClick={exportJsonBackup}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#fbf1d8]"
        >
          <Download size={15} /> Download Full Backup (JSON)
        </button>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleImportFile}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-4 py-3 text-[11px] font-extrabold text-[#2e7c67] hover:bg-[#dff0e7]"
        >
          <Plus size={15} /> Restore from Backup (JSON)
        </button>
      </div>
    </>
  );
}

function NewProjectView() {
  const { addProject, user, canEdit, role, leads } = useAppState();
  const { toast } = useToast();
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [includeAdvancedAreaProgram, setIncludeAdvancedAreaProgram] = useState(false);
  const [areaProgram, setAreaProgram] = useState<ArchitecturalAreaProgram>(emptyAreaProgram);
  const [isDetailedTableModalOpen, setIsDetailedTableModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    location: 'Delhi' as Project['location'],
    category: 'Lounge' as Category,
    projectType: 'Premium Lounge',
    leadId: (role === 'lead' ? user?.id : leads[0]?.id) || user?.id || '',
    status: 'Yet to start' as ProjectStatus,
    startDate: todayIso(),
    targetDate: '',
    progress: '0',
    aop: '50',
    awarded: '0',
    projectedCost: '50',
    area: '',
    paxKeys: '',
    scope: '',
  });

  const progressNum = Math.max(0, Math.min(100, Number(form.progress) || 0));

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (!canEdit) {
    return <><PageHeader eyebrow="Project workspace" title="Create new project" description="Creating projects is restricted to Project Leads and Coordinators." /><div className="mt-8 flex max-w-[620px] items-start gap-3 rounded-2xl border border-[#eadcb1] bg-[#fbf1d8] p-5"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#9a711f]" /><p className="text-[12px] leading-6 text-[#8e681c]">You are signed in with read-only portfolio access. Project creation is managed by the Project Coordinator or Leads.</p></div></>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const found: string[] = [];
    const name = form.name.trim();
    const aopCrore = Number(form.aop);
    const awardedCrore = Number(form.awarded);
    const projectedCrore = Number(form.projectedCost || form.aop);

    if (!name) found.push('Project name is required.');
    if (!isValidIsoDate(form.startDate)) found.push('Enter a valid start date.');
    if (!isValidIsoDate(form.targetDate)) found.push('Enter a valid target completion date.');
    if (!Number.isFinite(aopCrore) || aopCrore < 0) found.push('Approved Budget (AOP) must be a number of 0 or more.');
    if (!Number.isFinite(awardedCrore) || awardedCrore < 0) found.push('Committed/Awarded amount must be a number of 0 or more.');
    if (!Number.isFinite(projectedCrore) || projectedCrore < 0) found.push('Projected Cost must be a number of 0 or more.');
    if (
      isValidIsoDate(form.startDate) &&
      isValidIsoDate(form.targetDate) &&
      form.targetDate < form.startDate
    ) {
      found.push('Target completion must fall on or after the start date.');
    }

    if (found.length) {
      setErrors(found);
      return;
    }
    setErrors([]);

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `${form.location.toLowerCase()}-${slug || 'project'}-${Date.now()}`;

    const created = await addProject({
      id,
      name,
      location: form.location,
      category: form.category,
      code: `${form.location.slice(0, 3).toUpperCase()}-NEW-${new Date().getFullYear() % 100}`,
      health: progressNum > 0 ? 'On track' : 'Not started',
      status: form.status,
      progress: progressNum,
      targetDate: form.targetDate,
      targetLabel: formatFullDate(form.targetDate),
      aop: aopCrore * CRORE,
      awarded: awardedCrore * CRORE,
      spent: 0,
      projectedCost: projectedCrore * CRORE,
      area: form.area.trim(),
      paxKeys: form.paxKeys.trim(),
      nextMilestone: 'Project brief',
      nextMilestoneDate: form.startDate,
      leadId: form.leadId || user?.id || '',
      startDate: form.startDate,
      specification: {
        projectType: form.projectType,
        area: form.area,
        capacity: form.paxKeys,
        units: '',
        terminal: form.location,
        floor: '',
        scope: form.scope,
        areaProgram: includeAdvancedAreaProgram ? areaProgram : undefined,
      },
      phases: [
        { name: 'Brief & scope', status: 'active', progress: 0, owner: 'PMO' },
        { name: 'Design development', status: 'upcoming', progress: 0, owner: 'Design' },
        { name: 'Procurement', status: 'upcoming', progress: 0, owner: 'Sourcing' },
        { name: 'Execution', status: 'upcoming', progress: 0, owner: 'Projects' },
        { name: 'Handover', status: 'upcoming', progress: 0, owner: 'Operations' },
      ],
      milestones: [],
      issues: [],
      updates: [],
    });

    if (!created) {
      setErrors(['The project could not be saved. Refresh and try again.']);
      return;
    }

    setCreatedName(name);
    toast({ title: 'Project created', description: `${name} is now in the portfolio.` });
  };

  if (createdName) return <div className="mx-auto max-w-[760px] py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e4f1ec] text-[#2e7c67]"><CheckCircle2 size={25} /></span><p className="mt-6 font-mono text-[10px] uppercase tracking-[.16em] text-[#2e7c67]">Project created</p><h1 className="mt-3 font-serif text-[44px] leading-none tracking-[-.05em] text-[#173e49]">{createdName} is ready for updates.</h1><p className="mx-auto mt-4 max-w-[480px] text-[13px] leading-6 text-muted-foreground">The project is saved and synced with the portfolio database.</p><Link href="/projects" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[11px] font-bold text-white">View all projects <ArrowUpRight size={15} /></Link></div>;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio creation"
        title="Create new project"
        description="Capture the core project metrics, status lifecycle, commercial budget, and assign a Project Lead."
      />
      <form onSubmit={submit} noValidate className="mt-8 max-w-[1000px] space-y-5">
        {errors.length > 0 && (
          <div role="alert" className="rounded-2xl border border-[#f0c8c2] bg-[#fff5f2] p-4">
            <p className="text-[11px] font-extrabold text-[#b2473d]">Fix the following before creating the project</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-[#b2473d]">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
          <div className="border-b border-border/70 pb-4">
            <h2 className="text-[18px] font-extrabold">1. Basic Information & Ownership</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-2 block text-[11px] font-bold">Project Name *</span>
              <input
                required
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="e.g. Terminal 3 Premium Lounge"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
              />
            </label>

            {role === 'coordinator' && leads.length > 0 && (
              <label className="md:col-span-2">
                <span className="mb-2 block text-[11px] font-bold text-[#664b14]">Allot to Project Lead *</span>
                <select
                  value={form.leadId}
                  onChange={(event) => set('leadId', event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#d6a95d] bg-white px-3 text-[12px] font-bold text-[#173e49]"
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.title}) — {l.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="mb-2 block text-[11px] font-bold">Location *</span>
              <select
                value={form.location}
                onChange={(event) => set('location', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
              >
                {locations.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Category *</span>
              <select
                value={form.category}
                onChange={(event) => set('category', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Initial Progress (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={form.progress}
                onChange={(event) => set('progress', event.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none"
              />
            </label>
            <div>
              <span className="mb-2 block text-[11px] font-bold">
                Project Status *
              </span>
              <select
                value={form.status}
                onChange={(event) => set('status', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold"
              >
                {projectStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Start Date *</span>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(event) => set('startDate', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Project Completion Date (Target) *</span>
              <input
                type="date"
                required
                min={form.startDate}
                value={form.targetDate}
                onChange={(event) => set('targetDate', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
          <h2 className="text-[18px] font-extrabold">2. Area, Capacity & Commercials</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-[11px] font-bold">Area</span>
              <input
                value={form.area}
                onChange={(event) => set('area', event.target.value)}
                placeholder="e.g. 24,000 sqft"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Pax / Keys</span>
              <input
                value={form.paxKeys}
                onChange={(event) => set('paxKeys', event.target.value)}
                placeholder="e.g. 180 Pax / 45 Keys"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Approved Budget (AOP in ₹ Cr) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.aop}
                onChange={(event) => set('aop', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none font-bold"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-bold">Committed Cost / Awarded (₹ Cr)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.awarded}
                onChange={(event) => set('awarded', event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none font-bold"
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-2 block text-[11px] font-bold">Projected Cost (₹ Cr)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.projectedCost}
                onChange={(event) => set('projectedCost', event.target.value)}
                placeholder="Leave blank to match Approved Budget"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none font-bold text-[#173e49]"
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-2 block text-[11px] font-bold">Scope Description</span>
              <textarea
                value={form.scope}
                onChange={(event) => set('scope', event.target.value)}
                rows={3}
                placeholder="Describe the core project scope..."
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[12px] outline-none"
              />
            </label>
          </div>
        </section>

        {/* Section 3: Architectural Space Program (Advanced Specifications) */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-[#9a711f]" />
                <h2 className="text-[18px] font-extrabold text-[#173e49]">
                  3. Architectural Space Program (Advanced Specifications)
                </h2>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Optional comprehensive architectural breakdown: Plot area, Total BUA, floor stacking, keys/bays, FOH public areas with pax, floor-wise BUA table, and room matrix.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-[12px] font-bold text-foreground hover:bg-muted/50 transition shrink-0 select-none">
              <input
                type="checkbox"
                checked={includeAdvancedAreaProgram}
                onChange={(e) => setIncludeAdvancedAreaProgram(e.target.checked)}
                className="size-4 rounded text-[#173e49] focus:ring-[#9a711f] accent-[#173e49]"
              />
              <span>Enable Advanced Specifications</span>
            </label>
          </div>

          {includeAdvancedAreaProgram ? (
            <div className="mt-6 space-y-6">
              {/* Site & BUA Metrics */}
              <div>
                <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#9a711f]">
                  Site & Built-Up Area (BUA)
                </h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Plot Area (SQ.M.)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={areaProgram.summary.plotAreaSqm || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: {
                            ...prev.summary,
                            plotAreaSqm: val,
                            plotAreaSqft: Math.round(val * 10.7639),
                          },
                        }));
                      }}
                      placeholder="e.g. 8160"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      = {(areaProgram.summary.plotAreaSqft || 0).toLocaleString()} SQ.FT.
                    </span>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Site Area (Acres)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={areaProgram.summary.plotAreaAcres || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, plotAreaAcres: val },
                        }));
                      }}
                      placeholder="e.g. 2.0"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Total BUA (SQ.M.)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={areaProgram.summary.builtUpAreaSqm || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const sqft = Math.round(val * 10.7639);
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: {
                            ...prev.summary,
                            builtUpAreaSqm: val,
                            builtUpAreaSqft: sqft,
                          },
                        }));
                        if (!form.area || form.area.includes('SQ.M.')) {
                          set('area', `${val.toLocaleString()} SQ.M. / ${sqft.toLocaleString()} SQ.FT.`);
                        }
                      }}
                      placeholder="e.g. 14970"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      = {(areaProgram.summary.builtUpAreaSqft || 0).toLocaleString()} SQ.FT.
                    </span>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Floor Stacking / Level Breakdown
                    </span>
                    <input
                      type="text"
                      value={areaProgram.summary.numberOfFloorsDescription}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, numberOfFloorsDescription: val },
                        }));
                      }}
                      placeholder="e.g. B + G + 1 + Service + 2nd-6th Floor"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
                    />
                  </label>
                </div>
              </div>

              {/* Room Inventory & Stacking */}
              <div>
                <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#9a711f]">
                  Keys, Bays & Transportation
                </h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Total Room Keys
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={areaProgram.summary.totalRoomKeys || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, totalRoomKeys: val },
                        }));
                        if (!form.paxKeys || form.paxKeys.includes('Keys')) {
                          set('paxKeys', `${val} Keys / ${areaProgram.summary.totalBays || val} Bays`);
                        }
                      }}
                      placeholder="e.g. 156"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Total Room Bays
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={areaProgram.summary.totalBays || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, totalBays: val },
                        }));
                        if (!form.paxKeys || form.paxKeys.includes('Bays')) {
                          set('paxKeys', `${areaProgram.summary.totalRoomKeys || 0} Keys / ${val} Bays`);
                        }
                      }}
                      placeholder="e.g. 168"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Standard Room Size (SQ.M.)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={areaProgram.summary.standardRoomSizeSqm || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, standardRoomSizeSqm: val },
                        }));
                      }}
                      placeholder="e.g. 27"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Number of Elevators
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={areaProgram.summary.numberOfElevators || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, numberOfElevators: val },
                        }));
                      }}
                      placeholder="e.g. 4"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Elevator / Core Notes
                    </span>
                    <input
                      type="text"
                      value={areaProgram.summary.elevatorRemarks}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, elevatorRemarks: val },
                        }));
                      }}
                      placeholder="e.g. 2 Passenger Elevators + 2 Service Lifts"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-[11px] font-bold text-foreground">
                      Special Amenities / Scope Remarks
                    </span>
                    <input
                      type="text"
                      value={areaProgram.summary.generalRemarks}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAreaProgram((prev) => ({
                          ...prev,
                          summary: { ...prev.summary, generalRemarks: val },
                        }));
                      }}
                      placeholder="e.g. Banquet, ADD, Lounge Bar, Gym, Pool & 4 Presidential Suites"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
                    />
                  </label>
                </div>
              </div>

              {/* Detailed Breakdown Tables Action Card */}
              <div className="rounded-xl border border-[#eadcb1] bg-[#fffbf2] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-[14px] font-extrabold text-[#173e49]">
                      Detailed Breakdown Tables (FOH Pax, Floor BUA & Room Matrix)
                    </h4>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Add row-by-row entries for Ground/2nd Floor public spaces (Banquet, ADD, Lounge Bar, etc.) with Pax capacities, floor-wise BUA allocations, and room inventory across guest floors.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#eadcb1] px-2.5 py-1 text-[#8f691b] font-semibold">
                        {areaProgram.fohAreas.groundFloor.length + areaProgram.fohAreas.secondFloor.length} FOH Areas
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#eadcb1] px-2.5 py-1 text-[#8f691b] font-semibold">
                        {areaProgram.floorWiseBua.items.length} Floor BUA Rows
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#eadcb1] px-2.5 py-1 text-[#8f691b] font-semibold">
                        {areaProgram.roomConfiguration.items.length} Guest Floor Rows
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDetailedTableModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-2.5 text-[12px] font-bold text-white shadow hover:bg-[#205160] transition shrink-0"
                  >
                    <SlidersHorizontal size={14} />
                    Open Detailed Tables Editor
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
              <p className="text-[12px] text-muted-foreground">
                Advanced Architectural Space Program is currently disabled for this project. Check the box above to enter plot area, BUA, floor stacking, keys, bays, and detailed space allocation tables.
              </p>
            </div>
          )}
        </section>

        {isDetailedTableModalOpen && (
          <AreaProgramEditorModal
            initialProgram={areaProgram}
            onClose={() => setIsDetailedTableModalOpen(false)}
            onSave={(updated) => {
              setAreaProgram(updated);
              setIncludeAdvancedAreaProgram(true);
              if (updated.summary.builtUpAreaSqm) {
                set('area', `${updated.summary.builtUpAreaSqm.toLocaleString()} SQ.M. / ${updated.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.`);
              }
              if (updated.summary.totalRoomKeys) {
                set('paxKeys', `${updated.summary.totalRoomKeys} Keys / ${updated.summary.totalBays} Bays`);
              }
              setIsDetailedTableModalOpen(false);
              toast({
                title: 'Space Program Tables Updated',
                description: 'Floor breakdown, FOH capacities, and room matrices have been saved to this draft.',
              });
            }}
          />
        )}

        <div className="flex justify-end">
          <button type="submit" className="rounded-xl bg-[#d6a95d] px-5 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]">
            Create project
          </button>
        </div>
      </form>
    </>
  );
}

function TeamView() {
  const { leads, projects, createLead, allotProject, role } = useAppState();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('Project Lead');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [allottingProjectId, setAllottingProjectId] = useState<string | null>(null);

  const handleResetPassword = async (lead: { id: string; name: string }) => {
    if (!window.confirm(`Reset the password for ${lead.name}? They will have to choose a new one at next sign-in.`)) return;
    try {
      const res = await api.auth.resetPassword(lead.id);
      window.prompt(`Temporary password for ${lead.name}. Copy it now and share it securely; it will not be shown again.`, res.temporaryPassword);
    } catch (err: any) {
      toast({ title: 'Password reset failed', description: err.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleCreateLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please provide a name, email, and password.');
      return;
    }
    if (password.trim().length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('The temporary password must be at least 10 characters and include letters and numbers.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await createLead({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        title: title.trim() || 'Project Lead',
      });
      if (res.success && res.lead) {
        toast({
          title: 'Project Lead Created',
          description: `Account created for ${res.lead.name}. They sign in with ${res.lead.email} and must set a new password at first sign-in.`,
        });
        setName('');
        setEmail('');
        setPassword('');
        setTitle('Project Lead');
      } else {
        setError(res.error || 'Failed to create lead account');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllot = async (projectId: string, leadId: string) => {
    setAllottingProjectId(projectId);
    const res = await allotProject(projectId, leadId);
    setAllottingProjectId(null);
    if (res.success) {
      const lead = leads.find((l) => l.id === leadId);
      const project = projects.find((p) => p.id === projectId);
      toast({
        title: 'Project Allotted',
        description: `${project?.name || 'Project'} assigned to ${lead?.name || 'lead'}.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Allotment failed',
        description: res.error || 'Could not allot project',
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Project Coordinator Workspace"
        title="Team & Project Allotment"
        description="Create Project Leads with real credentials, assign and allot projects, and manage portfolio ownership."
      />

      <div className="mt-8 grid gap-7 lg:grid-cols-[1.05fr_1.95fr]">
        {/* Left Column: Create Project Lead */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#ebdcb9] text-[#664b14]">
                <UserPlus size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-extrabold text-[#173e49]">Create Project Lead</h2>
                <p className="text-[11px] text-muted-foreground">Add a new Project Lead to the system</p>
              </div>
            </div>

            <form onSubmit={handleCreateLead} className="mt-5 space-y-4">
              {error && (
                <p className="rounded-xl bg-[#fae5e1] p-3 text-[11px] font-bold text-[#b2473d]">
                  {error}
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Full Name *</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Karan Verma"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#d6a95d]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Email Address *</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. karan.verma@encalm.com"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#d6a95d]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Initial Password *</span>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Temporary password (10+ chars, letters and numbers)"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-mono outline-none focus:border-[#d6a95d]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Role Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Project Lead"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#d6a95d]"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[12px] font-extrabold text-[#173e49] hover:bg-[#e2bd73] transition disabled:opacity-50"
              >
                <UserPlus size={15} /> {submitting ? 'Creating Lead...' : 'Create Project Lead Account'}
              </button>
            </form>
          </section>

          {/* Active Leads Roster Card */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-extrabold text-[#173e49]">Active Project Leads ({leads.length})</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                Live Roster
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {leads.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No leads found in database.</p>
              ) : (
                leads.map((lead) => {
                  const assignedProjects = projects.filter((p) => p.leadId === lead.id);
                  return (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-border bg-background p-3.5 transition hover:border-[#eadcb1]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-full bg-[#173e49] text-[10px] font-bold text-white">
                            {lead.initials}
                          </span>
                          <div>
                            <p className="text-[12px] font-bold text-foreground">{lead.name}</p>
                            <p className="font-mono text-[9px] text-muted-foreground">{lead.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="rounded-full bg-[#eef0ed] px-2 py-0.5 font-mono text-[9px] font-bold text-muted-foreground">
                            {assignedProjects.length} {assignedProjects.length === 1 ? 'project' : 'projects'}
                          </span>
                          {role === 'coordinator' && (
                            <button
                              type="button"
                              onClick={() => handleResetPassword(lead)}
                              className="text-[9px] font-bold text-[#9a711f] hover:underline"
                            >
                              Reset password
                            </button>
                          )}
                        </div>
                      </div>

                      {assignedProjects.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                          {assignedProjects.map((p) => (
                            <Link
                              key={p.id}
                              href={`/project/${p.id}`}
                              className="rounded-md bg-card px-2 py-0.5 text-[9px] font-semibold text-muted-foreground hover:text-foreground border border-border hover:border-[#d6a95d]"
                            >
                              {p.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Project Allotment Matrix */}
        <div>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-[16px] font-extrabold text-[#173e49]">Project Allotment & Ownership</h2>
                <p className="text-[11px] text-muted-foreground">
                  Assign projects to leads. Changes are saved directly to the database.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">
                Total Projects: {projects.length}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {projects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">
                  No projects in portfolio.
                </p>
              ) : (
                projects.map((project) => {
                  const currentLead = leads.find((l) => l.id === project.leadId);
                  const isAllotting = allottingProjectId === project.id;

                  return (
                    <div
                      key={project.id}
                      className="rounded-xl border border-border bg-background p-4 transition hover:border-[#d6a95d]"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/project/${project.id}`}
                              className="text-[13px] font-extrabold text-foreground hover:text-[#2e7c67] hover:underline"
                            >
                              {project.name}
                            </Link>
                            <span className="rounded-full bg-[#eef0ed] px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                              {project.code}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}>
                              {project.status || 'Yet to start'}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                            {project.location} · {project.category} · Target: {project.targetLabel} · Progress: {project.progress}%
                          </p>
                        </div>

                        {/* Allotment Control */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="block font-mono text-[8px] uppercase tracking-[.1em] text-muted-foreground">
                              Assigned Lead
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-[#173e49]">
                              <span className="grid size-5 place-items-center rounded-full bg-[#ebdcb9] text-[9px] font-bold text-[#664b14]">
                                {currentLead ? currentLead.initials : initialsOf(leadName(project.leadId))}
                              </span>
                              {currentLead ? currentLead.name : leadName(project.leadId)}
                            </span>
                          </div>

                          <select
                            disabled={isAllotting}
                            value={project.leadId || ''}
                            onChange={(e) => handleAllot(project.id, e.target.value)}
                            className="h-9 rounded-xl border border-border bg-white px-2.5 text-[11px] font-bold text-[#173e49] outline-none focus:border-[#d6a95d] disabled:opacity-50"
                          >
                            <option value="" disabled>Select lead...</option>
                            {leads.map((l) => (
                              <option key={l.id} value={l.id}>
                                Allot to {l.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function SitePhotographsView() {
  const { projects, canEditProject, role, addPhoto, addMultiplePhotos, deletePhoto } = useAppState();
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ photo: SitePhoto; project: Project } | null>(null);
  const [uploadProject, setUploadProject] = useState<Project | null>(null);

  // Collect all projects that have site photos
  const projectsWithPhotos = useMemo(() => {
    return projects.filter((p) => p.photos && p.photos.length > 0);
  }, [projects]);

  // Flattened photos with project metadata
  const filteredItems = useMemo(() => {
    return projects
      .flatMap((p) => (p.photos || []).map((ph) => ({ photo: ph, project: p })))
      .filter(({ photo, project }) => {
        if (selectedLocation !== 'all' && project.location !== selectedLocation) return false;
        if (selectedCategory !== 'all' && photo.category !== selectedCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchProject = project.name.toLowerCase().includes(q) || project.code.toLowerCase().includes(q);
          const matchCaption = photo.caption.toLowerCase().includes(q);
          const matchStage = (photo.stage || '').toLowerCase().includes(q);
          if (!matchProject && !matchCaption && !matchStage) return false;
        }
        return true;
      });
  }, [projects, selectedLocation, selectedCategory, search]);

  const canUploadAny = role === 'coordinator' || (role === 'lead' && projects.some((p) => canEditProject(p)));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Visual Portfolio Intelligence"
        title="Site Photographs"
        description="Physical construction, MEP progress, and fit-out verification photos uploaded from project sites across all Encalm properties."
        action={
          canUploadAny && projects.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const defaultProj = projects.find((p) => canEditProject(p)) || projects[0];
                setUploadProject(defaultProj);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[12px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
            >
              <Upload size={14} />
              Upload Site Photograph
            </button>
          ) : undefined
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Portfolio Coverage</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight">
            {projectsWithPhotos.length} / {projects.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Projects with verified site photographs</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Active Photographs</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#2e7c67]">
            {filteredItems.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Verified progress photos on server</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Gallery Multi-Upload</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#2e7c67]">
            Active
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Multiple photos supported per project</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Location filter */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-[11px] outline-none"
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-[11px] outline-none"
          >
            <option value="all">All Photo Categories</option>
            {photoCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search project or caption..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-[11px] outline-none"
          />
        </div>
      </div>

      {/* Photographs Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(({ photo, project }) => (
            <div
              key={photo.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Image Container with Hover Overlay */}
                <div
                  onClick={() => setLightboxPhoto({ photo, project })}
                  className="relative aspect-video w-full overflow-hidden bg-black/5 cursor-pointer"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="rounded-xl bg-black/80 px-3.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm shadow flex items-center gap-1.5">
                      <Camera size={13} /> View High-Res
                    </span>
                  </div>
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {photo.category && (
                      <span className="rounded-full bg-[#173e49]/80 backdrop-blur-sm px-2.5 py-0.5 text-[9px] font-bold text-white">
                        {photo.category}
                      </span>
                    )}
                    {photo.stage && (
                      <span className="rounded-full bg-white/80 backdrop-blur-sm px-2.5 py-0.5 text-[9px] font-bold text-[#173e49]">
                        {photo.stage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a711f]">
                      {project.code} • {project.location}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {photo.takenDate ? formatFullDate(photo.takenDate) : 'Current'}
                    </span>
                  </div>

                  <Link href={`/project/${project.id}`}>
                    <h3 className="text-[15px] font-bold text-foreground hover:text-[#9a711f] transition cursor-pointer">
                      {project.name}
                    </h3>
                  </Link>

                  <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                    "{photo.caption}"
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="border-t border-border/70 px-4 py-3 bg-muted/20 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground text-[10px]">
                  By: <strong>{photo.uploadedBy}</strong>
                </span>
                <Link
                  href={`/project/${project.id}`}
                  className="font-bold text-[#173e49] hover:underline inline-flex items-center gap-1"
                >
                  View project →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border p-14 text-center">
          <Camera size={40} className="mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-[17px] font-bold text-foreground">No Site Photographs Found</h3>
          <p className="mt-2 text-[12px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            {search || selectedLocation !== 'all' || selectedCategory !== 'all'
              ? 'No photographs match your current filter settings. Try adjusting your search query or location filters.'
              : 'No project has uploaded a verified site photograph yet. Site leads can upload progress photos directly from their projects.'}
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto.photo}
          photos={filteredItems.map((item) => item.photo)}
          projectName={lightboxPhoto.project.name}
          projectCode={lightboxPhoto.project.code}
          canDelete={canEditProject(lightboxPhoto.project)}
          onClose={() => setLightboxPhoto(null)}
          onDelete={async (photoId) => {
            const ok = await deletePhoto(lightboxPhoto.project.id, photoId);
            if (ok) {
              toast({ title: 'Photograph deleted', description: 'The site photograph was permanently removed from the server.' });
            }
          }}
        />
      )}

      {/* Upload Dialog Modal */}
      {uploadProject && (
        <PhotoUploadDialog
          projectId={uploadProject.id}
          projectName={uploadProject.name}
          stages={uploadProject.phases}
          existingPhotoUrl={uploadProject.photos?.[0]?.url}
          onClose={() => setUploadProject(null)}
          onUploadBatch={async (photos) => {
            try {
              await addMultiplePhotos(uploadProject.id, photos);
              toast({
                title: `${photos.length} photograph${photos.length > 1 ? 's' : ''} uploaded`,
                description: 'Successfully added to project site gallery.',
              });
            } catch (err: any) {
              toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: err?.message || 'Failed to upload photographs.',
              });
              throw err;
            }
          }}
          onUpload={async (data) => {
            try {
              await addPhoto(uploadProject.id, data);
              toast({
                title: 'Site photograph added',
                description: 'New photograph uploaded to project site gallery.',
              });
            } catch (err: any) {
              toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: err?.message || 'Failed to upload photograph.',
              });
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}

export default function Workspace({ view }: { view: WorkspaceView }) {
  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-14 pt-8 md:px-10 md:pt-10">
      {view === 'projects' && <ProjectsView />}
      {view === 'my-projects' && <ProjectsView mine />}
      {view === 'timeline' && <TimelineView />}
      {view === 'milestones' && <MilestonesView />}
      {view === 'issues' && <IssuesView />}
      {view === 'commercial' && <CommercialView />}
      {view === 'updates' && <UpdatesView />}
      {view === 'photos' && <SitePhotographsView />}
      {view === 'reports' && <ReportsView />}
      {view === 'new-project' && <NewProjectView />}
      {view === 'team' && <TeamView />}
    </div>
  );
}

const CSV_COLUMNS = [
  'Project',
  'Code',
  'Location',
  'Category',
  'Status',
  'Lead',
  'Health',
  'Progress %',
  'Area',
  'Pax / Keys',
  'Approved Budget AOP (INR)',
  'Committed Awarded (INR)',
  'Spent (INR)',
  'Projected Cost (INR)',
  'Target Completion Date',
  'Next milestone',
] as const;

/**
 * Escapes a CSV cell. The leading-character guard stops spreadsheet apps from
 * evaluating a project name like `=cmd()` as a formula (CSV injection).
 */
function csvCell(value: string | number): string {
  const text = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

function buildPortfolioCsv(projects: Project[]): string {
  const rows = projects.map((project) =>
    [
      project.name,
      project.code,
      project.location,
      project.category,
      project.status || 'Yet to start',
      leadName(project.leadId),
      project.health,
      project.progress,
      project.area || '',
      project.paxKeys || '',
      project.aop,
      project.awarded,
      project.spent,
      project.projectedCost ?? project.aop,
      project.targetDate,
      project.nextMilestone,
    ]
      .map(csvCell)
      .join(','),
  );

  return `\uFEFF${CSV_COLUMNS.map(csvCell).join(',')}\n${rows.join('\n')}`;
}

function downloadCsv(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
