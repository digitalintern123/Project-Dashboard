import { Activity, ChartBar as BarChart3, CircleDollarSign, SlidersHorizontal, Target, TrendingUp } from 'lucide-react';
import type { Category, Health } from '@/data/projects';

export const healthStyles: Record<Health, { dot: string; text: string; bg: string }> = {
  'On track': { dot: 'bg-[#3d9a7e]', text: 'text-[#2e7c67]', bg: 'bg-[#e4f1ec]' },
  'At risk': { dot: 'bg-[#d19b35]', text: 'text-[#9a711f]', bg: 'bg-[#f8edcf]' },
  Delayed: { dot: 'bg-[#d66254]', text: 'text-[#b2473d]', bg: 'bg-[#fae5e1]' },
  'Not started': { dot: 'bg-[#8c938d]', text: 'text-[#69716b]', bg: 'bg-[#eef0ed]' },
};

export const categoryIcons: Record<Category, typeof BarChart3> = {
  Hotel: Target,
  Lounge: Activity,
  Kitchen: CircleDollarSign,
  'Encalm Eats': TrendingUp,
  Other: SlidersHorizontal,
};
