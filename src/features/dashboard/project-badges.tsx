import type { Health } from '@/data/projects';
import { healthStyles } from './constants';
import { clampPercent } from './helpers';

export function HealthPill({ health }: { health: Health }) {
  const style = healthStyles[health];
  return (
    <span
      data-testid={`status-health-${health.toLowerCase().replaceAll(' ', '-')}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {health}
    </span>
  );
}

export function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const safe = clampPercent(value);
  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-[100px]' : ''}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e4d9]">
        <div className="h-full rounded-full bg-[#3d9a7e] transition-all duration-500" style={{ width: `${safe}%` }} />
      </div>
      <span className="font-mono text-[10px] font-medium text-muted-foreground">{safe}%</span>
    </div>
  );
}
