import type { AreaSheetItem, Location, Project } from '@/data/projects';

export type AreaSection = AreaSheetItem['section'];

/** One facility row in the Project Area Sheet, derived from a project. */
export interface SheetItem {
  project: Project;
  slNo: number;
  section: AreaSection;
  location: Location;
  name: string;
  code: string;
  status: string;
  areaSqft: number | null;
  areaSqm: number | null;
  rawArea: string;
}

export interface SheetFilters {
  search: string;
  selectedLocation: 'All' | Location;
  selectedSection: 'All' | AreaSection;
  selectedStatus: string;
}

export interface SheetMetrics {
  totalFacilities: number;
  totalSqft: number;
  totalSqm: number;
  loungeSqft: number;
  kitchenSqft: number;
  hotelSqft: number;
  operationalCount: number;
  pipelineCount: number;
}

// Format projects into typed area sheet items
export function buildSheetItems(projects: Project[]): SheetItem[] {
  return projects
    .map((p, idx): SheetItem => {
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
      let section: AreaSection = 'LOUNGES';
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
}

export function filterSheetItems(
  sheetItems: SheetItem[],
  { search, selectedLocation, selectedSection, selectedStatus }: SheetFilters,
): SheetItem[] {
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
}

// Aggregate Metrics
export function computeSheetMetrics(sheetItems: SheetItem[]): SheetMetrics {
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
}

/** Builds the CSV for the given rows and triggers a browser download. Throws on failure. */
export function downloadSheetCsv(filtered: SheetItem[]): void {
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
}
