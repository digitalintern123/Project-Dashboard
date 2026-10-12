import { type Health, type Phase } from '@/data/projects';

export const healthStyles: Record<Health, { dot: string; text: string; bg: string; border: string }> = {
  'On track': { dot: 'bg-[#3d9a7e]', text: 'text-[#2e7c67]', bg: 'bg-[#e4f1ec]', border: 'border-[#cbe4d9]' },
  'At risk': { dot: 'bg-[#d19b35]', text: 'text-[#9a711f]', bg: 'bg-[#f8edcf]', border: 'border-[#eadcb1]' },
  Delayed: { dot: 'bg-[#d66254]', text: 'text-[#b2473d]', bg: 'bg-[#fae5e1]', border: 'border-[#f0c8c2]' },
  'Not started': { dot: 'bg-[#8c938d]', text: 'text-[#69716b]', bg: 'bg-[#eef0ed]', border: 'border-[#d9ded8]' },
};

export type Tab =
  'overview' | 'program' | 'progress' | 'timeline' | 'milestones' | 'photos' | 'commercial' | 'issues' | 'updates';

export const stageStatuses: Phase['status'][] = ['upcoming', 'active', 'blocked', 'complete'];
