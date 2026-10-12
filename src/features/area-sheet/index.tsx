import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAppState } from '@/state/app-state';
import type { Location } from '@/data/projects';
import { useToast } from '@/hooks/use-toast';
import { AreaSectionTable, type AreaSectionConfig } from './area-section-table';
import { AreaSheetHeader } from './area-sheet-header';
import { AreaSheetToolbar } from './area-sheet-toolbar';
import { AreaSummaryCards } from './area-summary-cards';
import { downloadSheetCsv, type AreaSection } from './sheet-items';
import { useAreaSheetData } from './use-area-sheet-data';

// Section 1: Lounges & Wellness Facilities
const loungesConfig: AreaSectionConfig = {
  dotClassName: 'bg-[#2e7c67]',
  title: 'LOUNGES & WELLNESS FACILITIES (SL 1–42)',
  countBadgeClassName: 'rounded-full bg-[#edf5f0] px-2 py-0.5 text-[10px] font-bold text-[#2e7c67]',
  countNoun: 'facilities',
  nameColumnLabel: 'Project List (Facility Name)',
  nameLinkClassName: 'font-bold text-foreground hover:text-[#2e7c67] hover:underline',
  showPaxKeys: false,
  subtotalLabel: 'Lounges & Wellness Subtotal',
  subtotalClassName: 'text-[#2e7c67]',
};

// Section 2: Office, Kitchen & Misc Works
const miscConfig: AreaSectionConfig = {
  dotClassName: 'bg-[#9a711f]',
  title: 'OFFICE, KITCHEN & MISC WORKS (SL 39–62)',
  countBadgeClassName: 'rounded-full bg-[#fbf1d8] px-2 py-0.5 text-[10px] font-bold text-[#9a711f]',
  countNoun: 'facilities',
  nameColumnLabel: 'Project List (Facility Name)',
  nameLinkClassName: 'font-bold text-foreground hover:text-[#9a711f] hover:underline',
  showPaxKeys: false,
  subtotalLabel: 'Office, Kitchen & Misc Subtotal',
  subtotalClassName: 'text-[#9a711f]',
};

// Section 3: Hotels (PDF 1 & 2)
const hotelsConfig: AreaSectionConfig = {
  dotClassName: 'bg-[#173e49]',
  title: 'AIRPORT BUSINESS HOTELS (PDF 1 & PDF 2)',
  countBadgeClassName: 'rounded-full bg-[#edf5f0] px-2 py-0.5 text-[10px] font-bold text-[#173e49]',
  countNoun: 'hotels',
  nameColumnLabel: 'Hotel Property',
  nameLinkClassName: 'font-bold text-[#173e49] hover:text-[#2e7c67] hover:underline',
  showPaxKeys: true,
  subtotalLabel: 'Hotels Subtotal',
  subtotalClassName: 'text-[#173e49]',
};

export default function AreaSheet() {
  const { projects } = useAppState();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<'All' | Location>('All');
  const [selectedSection, setSelectedSection] = useState<'All' | AreaSection>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const { sheetItems, filtered, metrics, lounges, misc, hotels } = useAreaSheetData(projects, {
    search,
    selectedLocation,
    selectedSection,
    selectedStatus,
  });

  // Export CSV
  const handleExportCSV = () => {
    try {
      downloadSheetCsv(filtered);

      toast({
        title: 'Area Sheet Exported',
        description: 'Complete Project Area Sheet downloaded as CSV.',
      });
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Could not generate CSV file.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-8 px-5 py-8 md:px-10 max-w-7xl mx-auto">
      {/* Header */}
      <AreaSheetHeader onExportCsv={handleExportCSV} />

      {/* KPI Cards */}
      <AreaSummaryCards metrics={metrics} />

      {/* Filter Toolbar */}
      <AreaSheetToolbar
        search={search}
        setSearch={setSearch}
        selectedSection={selectedSection}
        setSelectedSection={setSelectedSection}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
      />

      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>
          Showing {filtered.length} of {sheetItems.length} authentic facilities
        </span>
        <span className="hidden sm:inline">Source: Project Area Sheet Master Blueprint</span>
      </div>

      {/* Render Tables Grouped by Section */}
      <div className="space-y-10">
        {(selectedSection === 'All' || selectedSection === 'LOUNGES') && lounges.length > 0 && (
          <AreaSectionTable items={lounges} config={loungesConfig} />
        )}

        {(selectedSection === 'All' || selectedSection === 'OFFICE, KITCHEN & MISC WORKS') && misc.length > 0 && (
          <AreaSectionTable items={misc} config={miscConfig} />
        )}

        {(selectedSection === 'All' || selectedSection === 'HOTELS') && hotels.length > 0 && (
          <AreaSectionTable items={hotels} config={hotelsConfig} />
        )}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <FileSpreadsheet size={36} className="mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-[15px] font-bold text-foreground">No Facilities Match Filter</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Try adjusting your search keywords, location filter, or section category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
