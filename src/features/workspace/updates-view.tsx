import { Link } from 'wouter';
import { Plus } from 'lucide-react';
import { useAppState } from '@/state/app-state';
import { initialsOf } from '@/data/users';
import { PageHeader } from './page-header';

export function UpdatesView() {
  const { projects, canEdit } = useAppState();
  const updates = projects
    .flatMap((project) => project.updates.map((update) => ({ ...update, project })))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader
        eyebrow="Project updates"
        title="Update feed"
        description="A chronological read of the decisions, progress signals, and changes coming from project teams."
        action={
          canEdit ? (
            <Link
              href="/my-projects"
              className="inline-flex items-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]"
            >
              <Plus size={15} /> Post an update
            </Link>
          ) : undefined
        }
      />
      <div className="mt-8 max-w-[900px] space-y-3">
        {updates.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">
            No project updates posted yet.
          </p>
        )}
        {updates.slice(0, 15).map((update, index) => (
          <Link
            href={`/project/${update.project.id}`}
            key={`${update.project.id}-${update.date}-${update.author}-${index}`}
            className="flex gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-[#d9c585]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e4f1ec] text-[10px] font-bold text-[#2e7c67]">
              {initialsOf(update.author)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-[12px]">{update.project.name}</strong>
                <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  {update.date}
                </span>
              </span>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{update.text}</p>
              <span className="mt-3 block font-mono text-[9px] uppercase tracking-[.1em] text-[#2e7c67]">
                Updated by {update.author} · {update.role}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
