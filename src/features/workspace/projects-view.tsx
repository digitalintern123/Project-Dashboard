import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Plus, Search } from 'lucide-react';
import {
  healthOptions,
  locations,
  projectStatuses,
  type Category,
  type Health,
  type ProjectStatus,
} from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { leadName } from '@/data/users';
import { sortProjectsIncompleteFirst } from '@/lib/calculations';
import { PageHeader } from './page-header';
import { ProjectTable } from './project-table';

export function ProjectsView({ mine = false }: { mine?: boolean }) {
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
      const haystack =
        `${project.name} ${project.code} ${project.category} ${project.location} ${leadName(project.leadId)}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (health !== 'All' && project.health !== health) return false;
      if (location !== 'All' && project.location !== location) return false;
      if (category !== 'All' && project.category !== category) return false;
      if (status !== 'All' && (project.status || 'Yet to start') !== status) return false;
      return true;
    });
    return sortProjectsIncompleteFirst(filtered);
  }, [projects, mine, user?.id, search, health, location, category, status]);

  const hasFilters =
    Boolean(search) || health !== 'All' || location !== 'All' || category !== 'All' || status !== 'All';
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
        description={
          mine
            ? 'The projects you own, the milestones ahead, and the updates that need to move.'
            : 'Explore every Encalm project with the context needed for a useful first read.'
        }
        action={
          mine ? (
            <Link
              href="/new-project"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]"
            >
              <Plus size={15} /> New project
            </Link>
          ) : undefined
        }
      />
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap items-center">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project, code or lead"
            className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
          />
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
        >
          <option value="All">All categories ({projects.length})</option>
          <option value="Lounge">Lounges & Spas ({projects.filter((p) => p.category === 'Lounge').length})</option>
          <option value="Kitchen">Central Kitchens ({projects.filter((p) => p.category === 'Kitchen').length})</option>
          <option value="Other">Operations & Support ({projects.filter((p) => p.category === 'Other').length})</option>
          <option value="Encalm Eats">
            Encalm Eats ({projects.filter((p) => p.category === 'Encalm Eats').length})
          </option>
          <option value="Hotel">Airport Hotels ({projects.filter((p) => p.category === 'Hotel').length})</option>
        </select>
        <select
          value={location}
          onChange={(event) => setLocation(event.target.value as typeof location)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
        >
          <option value="All">All locations</option>
          {locations.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
        >
          <option value="All">All statuses</option>
          {projectStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={health}
          onChange={(event) => setHealth(event.target.value as typeof health)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold"
        >
          <option value="All">All health</option>
          {healthOptions.map((item) => (
            <option key={item}>{item}</option>
          ))}
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
        <span>
          Showing {rows.length} of {projects.length} authentic facilities
        </span>
        <Link href="/area-sheet" className="font-bold text-[#173e49] hover:text-[#2e7c67] hover:underline">
          View Master Project Area Sheet &rarr;
        </Link>
      </div>
      <ProjectTable rows={rows} />
    </>
  );
}
