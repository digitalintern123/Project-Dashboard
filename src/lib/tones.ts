import type { Health, ProjectStatus } from '@/data/projects';

/** Pill colours for project health. */
export const healthTone: Record<Health, string> = {
  'On track': 'bg-[#e4f1ec] text-[#2e7c67]',
  'At risk': 'bg-[#f8edcf] text-[#9a711f]',
  Delayed: 'bg-[#fae5e1] text-[#b2473d]',
  'Not started': 'bg-[#eef0ed] text-[#69716b]',
};

/** Pill colours for project status. */
export const statusTone: Record<ProjectStatus, string> = {
  'Yet to start': 'bg-[#eef0ed] text-[#69716b]',
  'In Design': 'bg-[#e8f1f5] text-[#2c6e8a]',
  'In Tendering': 'bg-[#fef4e6] text-[#b37418]',
  'Under Construction': 'bg-[#fff0eb] text-[#c2583f]',
  Operational: 'bg-[#e4f1ec] text-[#2e7c67]',
  'On Hold': 'bg-[#fae5e1] text-[#b2473d]',
};
