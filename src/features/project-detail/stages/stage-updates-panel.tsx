import { useMemo, useState } from 'react';
import { MessageSquareText, Plus } from 'lucide-react';
import { type Project } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { todayLabel } from '@/lib/date';
import { initialsOf, users as defaultUsers, type User } from '@/data/users';
import { TagUserPopover } from '@/components/tag-user-popover';
import { MentionTextarea } from '@/components/mention-textarea';
import { resolveTypedMentions } from '@/lib/mention-match';
import { DetailCard } from '../ui';
import { currentStage } from '@/lib/stage-status';

export function StageUpdatesPanel({
  project,
  editable,
  onAdd,
}: {
  project: Project;
  editable: boolean;
  onAdd: (update: {
    text: string;
    date: string;
    author: string;
    role: string;
    stage: string;
    kind: 'Progress' | 'Decision' | 'Risk' | 'General';
    taggedUsers?: string[];
  }) => void;
}) {
  const { user, users: directory, leads } = useAppState();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [stage, setStage] = useState(currentStage(project.phases)?.name ?? project.phases[0]?.name ?? '');
  const [kind, setKind] = useState<'Progress' | 'Decision' | 'Risk' | 'General'>('Progress');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);

  // Everyone who can be @mentioned, one entry per id.
  const people = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of [...defaultUsers, ...(directory ?? []), ...(leads ?? [])])
      map.set(u.id, { ...map.get(u.id), ...u });
    return [...map.values()];
  }, [directory, leads]);
  // Typed @names count only when the full name is unique; shared names must be picked.
  const typed = useMemo(() => resolveTypedMentions(text, people, taggedUsers), [text, people, taggedUsers]);
  const pick = (id: string) => setTaggedUsers((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || typed.ambiguous.length > 0) return;

    onAdd({
      text: text.trim(),
      date: todayLabel(),
      author: user?.name ?? 'Project Lead',
      role: user?.title ?? 'Project Lead',
      stage,
      kind,
      taggedUsers: [...new Set([...taggedUsers, ...typed.ids])],
    });

    setText('');
    setTaggedUsers([]);
    setAdding(false);
  };

  return (
    <DetailCard title="Stage updates" eyebrow="Field notes & decisions" icon={MessageSquareText}>
      <div className="mt-7 space-y-6">
        {project.updates.map((update, index) => (
          <div key={`${update.date}-${update.author}-${index}`} className="relative flex gap-4">
            {index < project.updates.length - 1 && (
              <span className="absolute left-[15px] top-9 h-[calc(100%+12px)] w-px bg-border" />
            )}
            <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-border bg-[#f7f4ec] text-[9px] font-bold text-[#2e7c67]">
              {initialsOf(update.author)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-bold">{update.author}</span>
                <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  {update.role}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/70">{update.date}</span>
                <span className="rounded-full bg-[#e4f1ec] px-2 py-1 font-mono text-[8px] uppercase tracking-[.08em] text-[#2e7c67]">
                  {update.kind ?? 'General'}
                </span>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{update.stage ?? 'General project update'}</p>
              <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">{update.text}</p>
            </div>
          </div>
        ))}
      </div>

      {editable &&
        (adding ? (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-3 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] p-3.5"
          >
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
              >
                {project.phases.map((phase, index) => (
                  <option key={`${phase.name}-${index}`}>{phase.name}</option>
                ))}
              </select>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
                className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
              >
                <option>Progress</option>
                <option>Decision</option>
                <option>Risk</option>
                <option>General</option>
              </select>
            </div>

            <MentionTextarea
              required
              aria-label="Update note"
              value={text}
              onChange={setText}
              users={people}
              onMentionSelect={(u) => pick(u.id)}
              dropdownDirection="bottom"
              rows={3}
              placeholder="What changed in this stage? Type @name to tag and email someone..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[11px]"
            />
            {typed.ambiguous.map((group) => (
              <div
                key={group.name}
                role="group"
                aria-label={`Which ${group.name}?`}
                className="rounded-lg border border-[#eadcb1] bg-[#fdf8ec] p-2 text-[10px] text-[#7a5914]"
              >
                <div className="font-bold">Which {group.name}? Several people share this name.</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {group.candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c.id)}
                      className="rounded-md bg-white px-2 py-1 hover:bg-[#f3ead2]"
                    >
                      {c.name} <span className="font-mono text-[9px] text-muted-foreground">{c.email || c.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#cbe4d9]/50">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Notify / Tag:
                </span>
                <TagUserPopover
                  taggedUsers={taggedUsers}
                  onChange={setTaggedUsers}
                  canTag={true}
                  label="Tag & Email Member"
                  entityType="Update"
                  entityTitle={`${kind} Update: ${stage}`}
                  entityContext={text.slice(0, 100)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={typed.ambiguous.length > 0}
                  className="rounded-lg bg-[#173e49] disabled:opacity-40 px-3.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#205160]"
                >
                  Post update
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-6 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-3 py-2 text-[10px] font-bold text-[#2e7c67] hover:bg-[#d8ede3]"
          >
            <Plus size={13} className="mr-1 inline" /> Add stage update
          </button>
        ))}
    </DetailCard>
  );
}
