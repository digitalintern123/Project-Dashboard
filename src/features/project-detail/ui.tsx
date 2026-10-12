import { type ReactNode } from 'react';
import { Check, Target } from 'lucide-react';
import { type Project } from '@/data/projects';
import { clampPercent } from './helpers';

export function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  note: ReactNode;
  icon: typeof Target;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-[#f0c8c2] bg-[#fff6f5]'
      : tone === 'warning'
        ? 'border-[#eadcb1] bg-[#fbf1d8]'
        : tone === 'success'
          ? 'border-[#cbe4d9] bg-[#edf5f0]'
          : 'border-border bg-card';

  const textTone =
    tone === 'danger'
      ? 'text-[#b2473d]'
      : tone === 'warning'
        ? 'text-[#9a711f]'
        : tone === 'success'
          ? 'text-[#2e7c67]'
          : '';

  return (
    <div className={`rounded-2xl border p-4 flex flex-col justify-between transition-colors ${toneClasses}`}>
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">{label}</span>
          <Icon size={15} className={textTone || 'text-muted-foreground/60'} />
        </div>
        <p className={`mt-4 text-[23px] font-extrabold tracking-[-.04em] ${textTone}`}>{value}</p>
      </div>
      {typeof note === 'string' ? (
        <p className={`mt-1 text-[10px] ${textTone || 'text-muted-foreground'}`}>{note}</p>
      ) : (
        note
      )}
    </div>
  );
}

export function ProgressRing({ progress }: { progress: number }) {
  const safe = clampPercent(progress);
  return (
    <div
      className="relative grid size-[116px] shrink-0 place-items-center rounded-full"
      role="img"
      aria-label={`${safe}% complete`}
      style={{ background: `conic-gradient(#3d9a7e 0 ${safe}%, #dfe8e2 ${safe}% 100%)` }}
    >
      <div className="grid size-[88px] place-items-center rounded-full bg-card text-center">
        <span className="font-mono text-[23px] font-medium">{safe}%</span>
        <span className="font-mono text-[8px] uppercase tracking-[.12em] text-muted-foreground">complete</span>
      </div>
    </div>
  );
}

export function PhaseList({ project }: { project: Project }) {
  return (
    <div className="space-y-1">
      {project.phases.map((phase, index) => (
        <div key={`${phase.name}-${index}`} className="group flex items-center gap-3 rounded-xl p-3 hover:bg-[#f8f5ec]">
          <div
            className={`relative grid size-8 shrink-0 place-items-center rounded-full ${phase.status === 'complete' ? 'bg-[#e4f1ec] text-[#2e7c67]' : phase.status === 'active' ? 'bg-[#f8edcf] text-[#9a711f]' : 'bg-muted text-muted-foreground'}`}
          >
            {phase.status === 'complete' ? (
              <Check size={14} strokeWidth={3} />
            ) : phase.status === 'active' ? (
              <span className="size-2 rounded-full bg-[#d19b35]" />
            ) : (
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
            )}
            {index < project.phases.length - 1 && <span className="absolute left-1/2 top-8 h-4 w-px bg-border" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <p className={`text-[12px] font-bold ${phase.status === 'upcoming' ? 'text-muted-foreground' : ''}`}>
                {phase.name}
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">{phase.progress}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e7e7dc]">
              <div
                className={`h-full rounded-full ${phase.status === 'active' ? 'bg-[#d19b35]' : 'bg-[#3d9a7e]'}`}
                style={{ width: `${phase.progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{phase.owner}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailCard({
  title,
  eyebrow,
  icon: Icon,
  children,
  tone = 'card',
  action,
}: {
  title: string;
  eyebrow: string;
  icon: typeof Target;
  children: ReactNode;
  tone?: 'card' | 'gold' | 'green';
  action?: ReactNode;
}) {
  const toneClass =
    tone === 'gold'
      ? 'border-[#eadcb1] bg-[#fbf1d8]'
      : tone === 'green'
        ? 'border-[#d0e0d9] bg-[#edf5f0]'
        : 'border-border bg-card';
  return (
    <section className={`rounded-2xl border p-5 shadow-sm shadow-[#173e49]/[.03] md:p-6 ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-2 text-[19px] font-extrabold tracking-[-.03em]">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <Icon size={18} className="text-muted-foreground/60" />
        </div>
      </div>
      {children}
    </section>
  );
}

export function Info({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-[#f0c8c2] bg-[#fff6f5] text-[#b2473d]'
      : tone === 'warning'
        ? 'border-[#eadcb1] bg-[#fbf1d8] text-[#9a711f]'
        : tone === 'success'
          ? 'border-[#cbe4d9] bg-[#edf5f0] text-[#2e7c67]'
          : 'border-border bg-card';

  return (
    <div className={`rounded-xl border p-3 transition-colors ${toneClasses}`}>
      <span className="block font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</span>
      <span className="mt-2 block text-[11px] font-bold">{value}</span>
    </div>
  );
}

export function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: { dot: string; text: string };
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] font-semibold">{label}</span>
      <span className={`flex items-center gap-2 text-[10px] font-bold ${tone.text}`}>
        <span className={`size-2 rounded-full ${tone.dot}`} />
        {value}
      </span>
    </div>
  );
}
