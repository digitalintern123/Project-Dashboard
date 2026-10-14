import { MapPin, Mail, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import { projectStatuses, type Project, type ProjectStatus } from '@/data/projects';
import { leadName } from '@/data/users';
import { statusTone } from '@/lib/tones';
import { type AppRole } from '@/state/app-state';
import { healthStyles } from './styles';

export function ProjectHeader({
  project,
  role,
  canEdit,
  activePhase,
  onStatusChange,
  onOpenEmail,
  onToggleEdit,
  onRequestDelete,
}: {
  project: Project;
  role: AppRole | null;
  canEdit: boolean;
  activePhase: string;
  onStatusChange: (status: ProjectStatus) => void;
  onOpenEmail: () => void;
  onToggleEdit: () => void;
  onRequestDelete: () => void;
}) {
  const health = healthStyles[project.health];
  return (
    <section className="fade-up mt-8 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">
          <span>{project.code}</span>
          <span className="text-border">/</span>
          <span className="flex items-center gap-1">
            <MapPin size={11} /> {project.location}
          </span>
          <span className="text-border">/</span>
          <span>{project.category}</span>
        </div>
        <h1 className="mt-4 max-w-[780px] font-serif text-[42px] leading-[.98] tracking-[-.045em] text-[#173e49] md:text-[58px]">
          {project.name}
        </h1>
        <p className="mt-4 max-w-[600px] text-[13px] leading-6 text-muted-foreground">
          A clear line of sight from brief to opening. Current delivery stage:{' '}
          <strong className="font-bold text-foreground">{activePhase}</strong>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#173e49]" />
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              Project status
            </span>
            {canEdit ? (
              <select
                aria-label="Change project status"
                value={project.status || 'Yet to start'}
                onChange={(e) => onStatusChange(e.target.value as ProjectStatus)}
                className={`mt-1 cursor-pointer rounded-lg border border-border/80 px-2 py-0.5 text-[11px] font-extrabold outline-none transition hover:opacity-90 ${statusTone[project.status || 'Yet to start']}`}
              >
                {projectStatuses.map((st) => (
                  <option key={st} value={st} className="bg-white text-foreground font-semibold">
                    {st}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold ${statusTone[project.status || 'Yet to start']}`}
              >
                {project.status || 'Yet to start'}
              </span>
            )}
          </div>
        </div>

        <div className={`flex shrink-0 items-center gap-3 rounded-2xl border ${health.border} ${health.bg} px-4 py-3`}>
          <span className={`grid size-9 place-items-center rounded-xl ${health.bg} ${health.text}`}>
            <span className={`size-2.5 rounded-full ${health.dot}`} />
          </span>
          <span>
            <span className={`block font-mono text-[9px] uppercase tracking-[.14em] ${health.text}`}>
              Current health
            </span>
            <span className={`mt-1 block text-[13px] font-extrabold ${health.text}`}>{project.health}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenEmail}
          className="flex items-center gap-2 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-3.5 py-3 text-[10px] font-extrabold text-[#2e7c67] hover:bg-[#dfeee5] transition shadow-xs"
          title="Share executive update email or inspect delivery outbox"
        >
          <Mail size={14} /> Email Update
        </button>

        {canEdit ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleEdit}
              className="flex items-center gap-2 rounded-xl bg-[#d6a95d] px-3.5 py-3 text-[10px] font-extrabold text-[#173e49] hover:bg-[#e2bd73] transition"
            >
              <Pencil size={14} /> Edit project
            </button>
            {role === 'coordinator' && (
              <button
                type="button"
                onClick={onRequestDelete}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition"
                title="Delete this project"
              >
                <Trash2 size={14} /> Delete project
              </button>
            )}
          </div>
        ) : (
          <span className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
            <ShieldAlert size={13} className="text-[#9a711f]" />
            {role === 'hod'
              ? 'View only · HOD Oversight'
              : role === 'viewer'
                ? 'View only'
                : `View only · Allotted to ${leadName(project.leadId)}`}
          </span>
        )}
      </div>
    </section>
  );
}
