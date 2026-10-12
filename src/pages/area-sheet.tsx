import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Building2,
  Activity,
  CircleDollarSign,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  MapPin,
  Maximize2,
} from 'lucide-react';
import { useAppState } from '@/state/app-state';
import { locations, type Project, type Location } from '@/data/projects';
import { useToast } from '@/hooks/use-toast';

export default function AreaSheet() {
  const { projects } = useAppState();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<'All' | Location>('All');
  const [selectedSection, setSelectedSection] = useState<'All' | 'LOUNGES' | 'OFFICE, KITCHEN & MISC WORKS' | 'HOTELS'>(
    'All',
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Format projects into typed area sheet items
  const sheetItems = useMemo(() => {
    return projects
      .map((p, idx) => {
        const spec = p.specification;
        const sheet = spec?.areaSheet;

        // Extract numeric sqft and sqm
        let sqft: number | null = sheet?.areaSqft ?? null;
        let sqm: number | null = sheet?.areaSqm ?? null;

        if (sqft === null && p.area) {
          const sqftMatch = p.area.match(/([0-9,]+)\s*SQ\.FT/i);
          if (sqftMatch) sqft = parseInt(sqftMatch[1].replace(/,/g, ''), 10);
        }
        if (sqm === null && p.area) {
          const sqmMatch = p.area.match(/([0-9,]+)\s*SQ\.M/i);
          if (sqmMatch) sqm = parseInt(sqmMatch[1].replace(/,/g, ''), 10);
        }

        // Determine authentic section and SL No from sheet or category
        let section: 'LOUNGES' | 'OFFICE, KITCHEN & MISC WORKS' | 'HOTELS' = 'LOUNGES';
        let slNo = sheet?.slNo ?? idx + 1;

        if (sheet?.section) {
          section = sheet.section;
        } else if (p.category === 'Hotel') {
          section = 'HOTELS';
          slNo = p.id === 'vizag-hotel-suites' ? 1 : 2;
        } else if (p.category === 'Kitchen' || p.category === 'Other' || p.category === 'Encalm Eats') {
          section = 'OFFICE, KITCHEN & MISC WORKS';
        }

        const sheetStatus =
          sheet?.status ||
          (p.status === 'Operational'
            ? 'Operational / Handed-over'
            : p.status === 'Under Construction'
              ? 'Under Construction'
              : (p.status as string) === 'On Hold'
                ? 'HOLD'
                : p.status || 'Operational / Handed-over');

        return {
          project: p,
          slNo,
          section,
          location: p.location,
          name: p.name,
          code: p.code,
          status: sheetStatus,
          areaSqft: sqft,
          areaSqm: sqm,
          rawArea: p.area || (sqft ? `${sqft.toLocaleString()} SQ.FT.` : '—'),
        };
      })
      .sort((a, b) => a.slNo - b.slNo);
  }, [projects]);

  // Filtered items
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sheetItems.filter((item) => {
      if (selectedLocation !== 'All' && item.location !== selectedLocation) return false;
      if (selectedSection !== 'All' && item.section !== selectedSection) return false;
      if (selectedStatus !== 'All' && item.status !== selectedStatus) return false;

      if (term) {
        const haystack = `${item.name} ${item.code} ${item.location} ${item.status} ${item.slNo}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sheetItems, search, selectedLocation, selectedSection, selectedStatus]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalSqft = 0;
    let totalSqm = 0;
    let loungeSqft = 0;
    let kitchenSqft = 0;
    let hotelSqft = 0;
    let operationalCount = 0;
    let pipelineCount = 0;

    sheetItems.forEach((item) => {
      if (item.areaSqft) {
        totalSqft += item.areaSqft;
        if (item.section === 'LOUNGES') loungeSqft += item.areaSqft;
        else if (item.section === 'OFFICE, KITCHEN & MISC WORKS') kitchenSqft += item.areaSqft;
        else if (item.section === 'HOTELS') hotelSqft += item.areaSqft;
      }
      if (item.areaSqm) totalSqm += item.areaSqm;

      if (item.status.includes('Operational')) operationalCount++;
      else pipelineCount++;
    });

    return {
      totalFacilities: sheetItems.length,
      totalSqft,
      totalSqm,
      loungeSqft,
      kitchenSqft,
      hotelSqft,
      operationalCount,
      pipelineCount,
    };
  }, [sheetItems]);

  // Group filtered items by authentic PDF section
  const lounges = useMemo(() => filtered.filter((i) => i.section === 'LOUNGES'), [filtered]);
  const misc = useMemo(() => filtered.filter((i) => i.section === 'OFFICE, KITCHEN & MISC WORKS'), [filtered]);
  const hotels = useMemo(() => filtered.filter((i) => i.section === 'HOTELS'), [filtered]);

  // Export CSV
  const handleExportCSV = () => {
    try {
      const rows: string[][] = [];
      rows.push(['ENCALM HOSPITALITY - PROJECT AREA SHEET']);
      rows.push(['Generated Date', new Date().toLocaleDateString('en-GB')]);
      rows.push(['Total Facilities in Export', String(filtered.length)]);
      rows.push([]);
      rows.push([
        'SL No',
        'Section',
        'Location',
        'Project List (Facility)',
        'Project Status',
        'Area (SQ.FT.)',
        'Area (SQ.M.)',
      ]);

      filtered.forEach((item) => {
        rows.push([
          String(item.slNo),
          item.section,
          item.location,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${item.status}"`,
          item.areaSqft ? String(item.areaSqft) : '',
          item.areaSqm ? String(item.areaSqm) : '',
        ]);
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Encalm_Project_Area_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

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

  const statusBadge = (status: string) => {
    if (status.includes('Operational')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f1ec] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#2e7c67]">
          <span className="size-1.5 rounded-full bg-[#3d9a7e]" />
          Operational / Handed-over
        </span>
      );
    }
    if (status.includes('Under Construction')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f8edcf] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#9a711f]">
          <span className="size-1.5 rounded-full bg-[#d19b35]" />
          Under Construction
        </span>
      );
    }
    if (status.includes('HOLD')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fae5e1] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#b2473d]">
          <span className="size-1.5 rounded-full bg-[#d66254]" />
          HOLD
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0ed] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#69716b]">
        <span className="size-1.5 rounded-full bg-[#8c938d]" />
        Yet to start
      </span>
    );
  };

  return (
    <div className="space-y-8 px-5 py-8 md:px-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#edf5f0] text-[#2e7c67]">
              <FileSpreadsheet size={15} />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#9a711f]">
              Official Master Register · Source: 3rd PDF
            </p>
          </div>
          <h1 className="mt-3 font-serif text-[38px] leading-none tracking-[-.05em] text-[#173e49] md:text-[48px]">
            Project Area Sheet
          </h1>
          <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-muted-foreground">
            Complete facility register from the authentic master <strong>Project Area Sheet</strong>: 66 operational and
            under-construction lounges, wellness spas, central production kitchens, and infrastructure facilities, plus
            2 airport hotels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-4 py-2.5 text-[11px] font-bold text-[#2e7c67] hover:bg-[#dfeee5] transition shadow-xs"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[11px] font-bold text-foreground hover:bg-muted transition shadow-xs"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              Total Portfolio
            </span>
            <Building2 size={16} className="text-muted-foreground/60" />
          </div>
          <p className="mt-4 text-[28px] font-extrabold tracking-[-.04em] text-foreground">{metrics.totalFacilities}</p>
          <p className="mt-1 font-mono text-[10px] text-[#2e7c67]">
            {metrics.operationalCount} Operational · {metrics.pipelineCount} Pipeline
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              Total Built-Up Area
            </span>
            <Maximize2 size={16} className="text-muted-foreground/60" />
          </div>
          <p className="mt-4 text-[24px] font-extrabold tracking-[-.04em] text-foreground">
            {metrics.totalSqft.toLocaleString()}{' '}
            <span className="text-[14px] font-bold text-muted-foreground">SQ.FT.</span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Approx. {metrics.totalSqm.toLocaleString()} SQ.M.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              Lounges & Wellness
            </span>
            <Activity size={16} className="text-[#2e7c67]" />
          </div>
          <p className="mt-4 text-[24px] font-extrabold tracking-[-.04em] text-[#173e49]">
            {metrics.loungeSqft.toLocaleString()}{' '}
            <span className="text-[14px] font-bold text-muted-foreground">SQ.FT.</span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-[#2e7c67]">42 Facilities across Delhi, Hyd, Goa, Vizag</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              Kitchen & Misc Facilities
            </span>
            <CircleDollarSign size={16} className="text-[#9a711f]" />
          </div>
          <p className="mt-4 text-[24px] font-extrabold tracking-[-.04em] text-[#9a711f]">
            {metrics.kitchenSqft.toLocaleString()}{' '}
            <span className="text-[14px] font-bold text-muted-foreground">SQ.FT.</span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">24 Commissary, Kitchen & Back-Office Units</p>
        </div>
      </div>

      {/* Filter Toolbar */}
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
          onChange={(e) => setSelectedSection(e.target.value as any)}
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
          onChange={(e) => setSelectedLocation(e.target.value as any)}
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

      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>
          Showing {filtered.length} of {sheetItems.length} authentic facilities
        </span>
        <span className="hidden sm:inline">Source: Project Area Sheet Master Blueprint</span>
      </div>

      {/* Render Tables Grouped by Section */}
      <div className="space-y-10">
        {/* Section 1: Lounges & Wellness Facilities */}
        {(selectedSection === 'All' || selectedSection === 'LOUNGES') && lounges.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#2e7c67]" />
                <h2 className="text-[15px] font-bold tracking-tight text-foreground">
                  LOUNGES & WELLNESS FACILITIES (SL 1–42)
                </h2>
                <span className="rounded-full bg-[#edf5f0] px-2 py-0.5 text-[10px] font-bold text-[#2e7c67]">
                  {lounges.length} facilities
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                Subtotal: {lounges.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                      <th className="py-3 pl-4 pr-2 w-16 text-center">SL No</th>
                      <th className="px-3 py-3 w-28">Location</th>
                      <th className="px-3 py-3 min-w-[240px]">Project List (Facility Name)</th>
                      <th className="px-3 py-3 w-48">Project Status</th>
                      <th className="px-3 py-3 text-right w-36">Area (SQ.FT.)</th>
                      <th className="px-3 py-3 text-right w-32 hidden md:table-cell">Area (SQ.M.)</th>
                      <th className="py-3 pl-2 pr-4 text-right w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lounges.map((item) => (
                      <tr key={item.project.id} className="hover:bg-[#fbf9f4] transition">
                        <td className="py-3 pl-4 pr-2 font-mono text-[10px] font-bold text-center text-muted-foreground">
                          {item.slNo}
                        </td>
                        <td className="px-3 py-3 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={10} className="text-muted-foreground" />
                            {item.location}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/project/${item.project.id}`}
                            className="font-bold text-foreground hover:text-[#2e7c67] hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="ml-2 font-mono text-[9px] text-muted-foreground">{item.code}</span>
                        </td>
                        <td className="px-3 py-3">{statusBadge(item.status)}</td>
                        <td className="px-3 py-3 text-right font-mono text-[11px] font-bold text-foreground">
                          {item.areaSqft ? item.areaSqft.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                          {item.areaSqm ? item.areaSqm.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right">
                          <Link
                            href={`/project/${item.project.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-bold hover:bg-[#edf5f0] hover:text-[#2e7c67] transition"
                          >
                            View <ArrowUpRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                      <td colSpan={4} className="py-3 pl-4 pr-3">
                        Lounges & Wellness Subtotal
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] text-[#2e7c67]">
                        {lounges.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
                        {lounges.reduce((acc, i) => acc + (i.areaSqm || 0), 0).toLocaleString()} SQ.M.
                      </td>
                      <td className="py-3 pr-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Section 2: Office, Kitchen & Misc Works */}
        {(selectedSection === 'All' || selectedSection === 'OFFICE, KITCHEN & MISC WORKS') && misc.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#9a711f]" />
                <h2 className="text-[15px] font-bold tracking-tight text-foreground">
                  OFFICE, KITCHEN & MISC WORKS (SL 39–62)
                </h2>
                <span className="rounded-full bg-[#fbf1d8] px-2 py-0.5 text-[10px] font-bold text-[#9a711f]">
                  {misc.length} facilities
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                Subtotal: {misc.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                      <th className="py-3 pl-4 pr-2 w-16 text-center">SL No</th>
                      <th className="px-3 py-3 w-28">Location</th>
                      <th className="px-3 py-3 min-w-[240px]">Project List (Facility Name)</th>
                      <th className="px-3 py-3 w-48">Project Status</th>
                      <th className="px-3 py-3 text-right w-36">Area (SQ.FT.)</th>
                      <th className="px-3 py-3 text-right w-32 hidden md:table-cell">Area (SQ.M.)</th>
                      <th className="py-3 pl-2 pr-4 text-right w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {misc.map((item) => (
                      <tr key={item.project.id} className="hover:bg-[#fbf9f4] transition">
                        <td className="py-3 pl-4 pr-2 font-mono text-[10px] font-bold text-center text-muted-foreground">
                          {item.slNo}
                        </td>
                        <td className="px-3 py-3 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={10} className="text-muted-foreground" />
                            {item.location}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/project/${item.project.id}`}
                            className="font-bold text-foreground hover:text-[#9a711f] hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="ml-2 font-mono text-[9px] text-muted-foreground">{item.code}</span>
                        </td>
                        <td className="px-3 py-3">{statusBadge(item.status)}</td>
                        <td className="px-3 py-3 text-right font-mono text-[11px] font-bold text-foreground">
                          {item.areaSqft ? item.areaSqft.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                          {item.areaSqm ? item.areaSqm.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right">
                          <Link
                            href={`/project/${item.project.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-bold hover:bg-[#edf5f0] hover:text-[#2e7c67] transition"
                          >
                            View <ArrowUpRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                      <td colSpan={4} className="py-3 pl-4 pr-3">
                        Office, Kitchen & Misc Subtotal
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] text-[#9a711f]">
                        {misc.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
                        {misc.reduce((acc, i) => acc + (i.areaSqm || 0), 0).toLocaleString()} SQ.M.
                      </td>
                      <td className="py-3 pr-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Hotels (PDF 1 & 2) */}
        {(selectedSection === 'All' || selectedSection === 'HOTELS') && hotels.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#173e49]" />
                <h2 className="text-[15px] font-bold tracking-tight text-foreground">
                  AIRPORT BUSINESS HOTELS (PDF 1 & PDF 2)
                </h2>
                <span className="rounded-full bg-[#edf5f0] px-2 py-0.5 text-[10px] font-bold text-[#173e49]">
                  {hotels.length} hotels
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                Subtotal: {hotels.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                      <th className="py-3 pl-4 pr-2 w-16 text-center">SL No</th>
                      <th className="px-3 py-3 w-28">Location</th>
                      <th className="px-3 py-3 min-w-[240px]">Hotel Property</th>
                      <th className="px-3 py-3 w-48">Project Status</th>
                      <th className="px-3 py-3 text-right w-36">Area (SQ.FT.)</th>
                      <th className="px-3 py-3 text-right w-32 hidden md:table-cell">Area (SQ.M.)</th>
                      <th className="py-3 pl-2 pr-4 text-right w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {hotels.map((item) => (
                      <tr key={item.project.id} className="hover:bg-[#fbf9f4] transition">
                        <td className="py-3 pl-4 pr-2 font-mono text-[10px] font-bold text-center text-muted-foreground">
                          {item.slNo}
                        </td>
                        <td className="px-3 py-3 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={10} className="text-muted-foreground" />
                            {item.location}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/project/${item.project.id}`}
                            className="font-bold text-[#173e49] hover:text-[#2e7c67] hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="ml-2 font-mono text-[9px] text-muted-foreground">
                            {item.code} · {item.project.paxKeys}
                          </span>
                        </td>
                        <td className="px-3 py-3">{statusBadge(item.status)}</td>
                        <td className="px-3 py-3 text-right font-mono text-[11px] font-bold text-foreground">
                          {item.areaSqft ? item.areaSqft.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                          {item.areaSqm ? item.areaSqm.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right">
                          <Link
                            href={`/project/${item.project.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-bold hover:bg-[#edf5f0] hover:text-[#2e7c67] transition"
                          >
                            View <ArrowUpRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                      <td colSpan={4} className="py-3 pl-4 pr-3">
                        Hotels Subtotal
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] text-[#173e49]">
                        {hotels.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
                        {hotels.reduce((acc, i) => acc + (i.areaSqm || 0), 0).toLocaleString()} SQ.M.
                      </td>
                      <td className="py-3 pr-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
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
