import type { Dispatch, SetStateAction } from 'react';
import { ListFilter as Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  healthOptions,
  locations,
  projectStatuses,
  type Category,
  type Health,
  type Location,
  type Project,
  type ProjectStatus,
} from '@/data/projects';

interface PortfolioToolbarProps {
  projects: Project[];
  shownCount: number;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  location: 'All' | Location;
  setLocation: Dispatch<SetStateAction<'All' | Location>>;
  category: 'All' | Category;
  setCategory: Dispatch<SetStateAction<'All' | Category>>;
  health: 'All' | Health;
  setHealth: Dispatch<SetStateAction<'All' | Health>>;
  status: 'All' | ProjectStatus;
  setStatus: Dispatch<SetStateAction<'All' | ProjectStatus>>;
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  hasFilters: boolean;
  clearFilters: () => void;
}

/** Portfolio heading, search box, filter toggle and the collapsible filter panel. */
export function PortfolioToolbar({
  projects,
  shownCount,
  query,
  setQuery,
  location,
  setLocation,
  category,
  setCategory,
  health,
  setHealth,
  status,
  setStatus,
  showFilters,
  setShowFilters,
  hasFilters,
  clearFilters,
}: PortfolioToolbarProps) {
  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Project portfolio</p>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
              {shownCount} shown
            </span>
          </div>
          <h2 className="mt-2 text-[22px] font-extrabold tracking-[-.04em]">All work in motion</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground focus-within:border-[#c9a04e] sm:w-56 sm:flex-none">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-testid="input-search-projects"
              placeholder="Search projects"
              className="min-w-0 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </label>
          <button
            type="button"
            data-testid="button-toggle-filters"
            onClick={() => setShowFilters((value) => !value)}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-bold ${showFilters || hasFilters ? 'border-[#c9a04e] bg-[#fbf1d8] text-[#8e681c]' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
          >
            <Filter size={14} /> <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 fade-up">
          <div className="mr-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">
            <SlidersHorizontal size={13} /> Refine
          </div>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value as 'All' | Location)}
            data-testid="select-location-filter"
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"
          >
            <option value="All">All locations</option>
            {locations.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as 'All' | Category)}
            data-testid="select-category-filter"
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"
          >
            <option value="All">All categories ({projects.length})</option>
            <option value="Lounge">Lounges & Spas ({projects.filter((p) => p.category === 'Lounge').length})</option>
            <option value="Kitchen">
              Central Kitchens ({projects.filter((p) => p.category === 'Kitchen').length})
            </option>
            <option value="Other">
              Operations & Support ({projects.filter((p) => p.category === 'Other').length})
            </option>
            <option value="Encalm Eats">
              Encalm Eats ({projects.filter((p) => p.category === 'Encalm Eats').length})
            </option>
            <option value="Hotel">Airport Hotels ({projects.filter((p) => p.category === 'Hotel').length})</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as 'All' | ProjectStatus)}
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"
          >
            <option value="All">All statuses</option>
            {projectStatuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={health}
            onChange={(event) => setHealth(event.target.value as 'All' | Health)}
            data-testid="select-health-filter"
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-semibold outline-none"
          >
            <option value="All">All health</option>
            {healthOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              data-testid="button-clear-filters"
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#b2473d] hover:bg-[#fae5e1]"
            >
              Clear <X size={12} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
