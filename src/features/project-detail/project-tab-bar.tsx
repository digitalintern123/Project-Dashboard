import {
  Building2,
  CalendarDays,
  Camera,
  CircleDollarSign,
  Clock3,
  Layers3,
  MessageSquareText,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react';
import { type Project } from '@/data/projects';
import { type Tab } from './styles';

export function ProjectTabBar({
  project,
  tab,
  onSelectTab,
}: {
  project: Project;
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
}) {
  const photoCountBadge = project.photos && project.photos.length > 0 ? ` (${project.photos.length})` : '';
  const hasAreaProgram = Boolean(project.specification?.areaProgram) || project.category === 'Hotel';
  const tabs: [Tab, string, typeof Target][] = [
    ['overview', 'Overview', Layers3],
    ...(hasAreaProgram ? ([['program', 'Area Program', Building2]] as [Tab, string, typeof Target][]) : []),
    ['progress', 'Progress', TrendingUp],
    ['timeline', 'Timeline', Clock3],
    ['milestones', 'Milestones', CalendarDays],
    ['photos', `Site Photograph${photoCountBadge}`, Camera],
    ['commercial', 'Commercial', CircleDollarSign],
    ['issues', 'Issues & risks', ShieldAlert],
    ['updates', 'Updates', MessageSquareText],
  ];
  return (
    <div className="mt-9 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map(([value, label, Icon]) => (
        <button
          type="button"
          key={value}
          onClick={() => onSelectTab(value)}
          className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-[11px] font-bold ${tab === value ? 'text-[#173e49]' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Icon size={14} />
          {label}
          {tab === value && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#d19b35]" />}
        </button>
      ))}
    </div>
  );
}
