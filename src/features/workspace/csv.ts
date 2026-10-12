import type { Project } from '@/data/projects';
import { leadName } from '@/data/users';

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

export function buildPortfolioCsv(projects: Project[]): string {
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

export function downloadCsv(contents: string, filename: string): void {
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
