import { Link } from 'wouter';
import { ArrowUpRight, MapPin, SlidersHorizontal } from 'lucide-react';
import { formatCrore, type Project } from '@/data/projects';
import { statusTone } from '@/lib/tones';
import { categoryIcons } from './constants';
import { HealthPill, ProgressBar } from './project-badges';
import { projectProgressTone } from '@/lib/progress-tone';

export function ProjectRow({ project, index }: { project: Project; index: number }) {
  // Fall back for categories outside the known list (older data or imports).
  const Icon = categoryIcons[project.category] ?? SlidersHorizontal;
  return (
    <Link
      href={`/project/${project.id}`}
      data-testid={`link-project-${project.id}`}
      className={`fade-up stagger-${Math.min(index + 1, 5)} group grid grid-cols-[minmax(180px,1.2fr)_105px_95px_110px_90px_90px_105px_24px] items-center gap-3 border-b border-border/70 px-5 py-3.5 last:border-0 hover:bg-[#fcf5e5]`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0ec] text-[#2e7c67]">
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-bold text-foreground">{project.name}</span>
          <span className="mt-1 flex items-center gap-1.5 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            <MapPin size={10} />
            {project.location} <span className="text-border">/</span> {project.code}
          </span>
        </span>
      </span>
      <span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}
        >
          {project.status || 'Yet to start'}
        </span>
      </span>
      <span>
        <HealthPill health={project.health} />
      </span>
      <span>
        <ProgressBar value={project.progress} tone={projectProgressTone(project)} compact />
      </span>
      <span className="text-[12px] font-semibold text-foreground">{formatCrore(project.aop)}</span>
      <span className="text-[12px] font-semibold text-foreground">{formatCrore(project.spent)}</span>
      <span>
        <span className="block text-[11px] font-semibold text-foreground">{project.targetLabel}</span>
        <span className="mt-1 block font-mono text-[9px] text-muted-foreground">{project.paxKeys || 'target'}</span>
      </span>
      <ArrowUpRight
        size={15}
        className="text-muted-foreground/45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  // Fall back for categories outside the known list (older data or imports).
  const Icon = categoryIcons[project.category] ?? SlidersHorizontal;
  return (
    <Link
      href={`/project/${project.id}`}
      data-testid={`card-project-${project.id}`}
      className={`fade-up stagger-${Math.min(index + 1, 5)} block rounded-2xl border border-border bg-card p-4 shadow-sm shadow-[#173e49]/[.03] hover:-translate-y-0.5 hover:border-[#d9c585] hover:shadow-lg hover:shadow-[#173e49]/[.06]`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0ec] text-[#2e7c67]">
            <Icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold">{project.name}</span>
            <span className="mt-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
              <MapPin size={10} /> {project.location}
            </span>
          </span>
        </span>
        <ArrowUpRight size={16} className="text-muted-foreground/50" />
      </span>
      <span className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}
          >
            {project.status || 'Yet to start'}
          </span>
          <HealthPill health={project.health} />
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{project.targetLabel}</span>
      </span>
      <span className="mt-4 block">
        <ProgressBar value={project.progress} tone={projectProgressTone(project)} />
      </span>
      <span className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
        <span className="text-[10px] text-muted-foreground">
          AOP <strong className="ml-1 text-foreground">{formatCrore(project.aop)}</strong>
        </span>
        <span className="text-[10px] text-muted-foreground">
          Spent <strong className="ml-1 text-foreground">{formatCrore(project.spent)}</strong>
        </span>
      </span>
    </Link>
  );
}
