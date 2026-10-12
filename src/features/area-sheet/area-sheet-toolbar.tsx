import type { Dispatch, SetStateAction } from 'react';
import { Search } from 'lucide-react';
import { locations, type Location } from '@/data/projects';
import type { AreaSection } from './sheet-items';

interface AreaSheetToolbarProps {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  selectedSection: 'All' | AreaSection;
  setSelectedSection: Dispatch<SetStateAction<'All' | AreaSection>>;
  selectedLocation: 'All' | Location;
  setSelectedLocation: Dispatch<SetStateAction<'All' | Location>>;
  selectedStatus: string;
  setSelectedStatus: Dispatch<SetStateAction<string>>;
}

export function AreaSheetToolbar({
  search,
  setSearch,
  selectedSection,
  setSelectedSection,
  selectedLocation,
  setSelectedLocation,
  selectedStatus,
  setSelectedStatus,
}: AreaSheetToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 sm:flex-row sm:flex-wrap items-center shadow-xs">
      {/* Search */}
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground w-full sm:w-auto">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search facility name, terminal, SL No..."
          className="min-w-0 flex-1 bg-transparent text-[11px] outline-none text-foreground"
        />
      </label>

      {/* Section Filter */}
      <select
        value={selectedSection}
        onChange={(e) => setSelectedSection(e.target.value as typeof selectedSection)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold text-foreground w-full sm:w-auto"
      >
        <option value="All">All Sections (68)</option>
        <option value="LOUNGES">Lounges & Wellness (42)</option>
        <option value="OFFICE, KITCHEN & MISC WORKS">Office, Kitchen & Misc (24)</option>
        <option value="HOTELS">Airport Hotels (2)</option>
      </select>

      {/* Location Filter */}
      <select
        value={selectedLocation}
        onChange={(e) => setSelectedLocation(e.target.value as typeof selectedLocation)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold text-foreground w-full sm:w-auto"
      >
        <option value="All">All Locations</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold text-foreground w-full sm:w-auto"
      >
        <option value="All">All Sheet Statuses</option>
        <option value="Operational / Handed-over">Operational / Handed-over</option>
        <option value="Under Construction">Under Construction</option>
        <option value="HOLD">HOLD</option>
        <option value="Yet to start">Yet to start</option>
      </select>
    </div>
  );
}
