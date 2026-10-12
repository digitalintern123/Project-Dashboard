import { useMemo } from 'react';
import type { Project } from '@/data/projects';
import {
  buildSheetItems,
  computeSheetMetrics,
  filterSheetItems,
  type SheetFilters,
  type SheetItem,
  type SheetMetrics,
} from './sheet-items';

export interface AreaSheetData {
  sheetItems: SheetItem[];
  filtered: SheetItem[];
  metrics: SheetMetrics;
  lounges: SheetItem[];
  misc: SheetItem[];
  hotels: SheetItem[];
}

export function useAreaSheetData(
  projects: Project[],
  { search, selectedLocation, selectedSection, selectedStatus }: SheetFilters,
): AreaSheetData {
  const sheetItems = useMemo(() => buildSheetItems(projects), [projects]);

  // Filtered items
  const filtered = useMemo(
    () => filterSheetItems(sheetItems, { search, selectedLocation, selectedSection, selectedStatus }),
    [sheetItems, search, selectedLocation, selectedSection, selectedStatus],
  );

  const metrics = useMemo(() => computeSheetMetrics(sheetItems), [sheetItems]);

  // Group filtered items by authentic PDF section
  const lounges = useMemo(() => filtered.filter((i) => i.section === 'LOUNGES'), [filtered]);
  const misc = useMemo(() => filtered.filter((i) => i.section === 'OFFICE, KITCHEN & MISC WORKS'), [filtered]);
  const hotels = useMemo(() => filtered.filter((i) => i.section === 'HOTELS'), [filtered]);

  return { sheetItems, filtered, metrics, lounges, misc, hotels };
}
