import { useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { formatCrore, formatShortDate, getProjectTemplate, type Phase, type Project } from '@/data/projects';
import { calculateWeightedProgress } from '@/lib/calculations';
import { TagUserPopover } from '@/components/tag-user-popover';
import { DetailCard } from '../ui';
import { StageEditorForm } from './stage-editor-form';

export function StageTimelinePanel({
  project,
  editable,
  canTag = true,
  onSave,
  onAdd,
  onRemove,
  onMove,
}: {
  project: Project;
  editable: boolean;
  canTag?: boolean;
  onSave: (index: number, patch: Partial<Phase>) => void;
  onAdd: (phase: Phase) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [plannedFinish, setPlannedFinish] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [weight, setWeight] = useState('');
  const weighted = calculateWeightedProgress(project.phases);

  return (
    <div className="w-full">
      <DetailCard
        title="Stage control plan"
        eyebrow={`${project.phases.length} stages · ${project.templateId ? getProjectTemplate(project.templateId).label : 'Project-specific workflow'}`}
        icon={CalendarDays}
      >
        <div className="mt-8 space-y-4">
          {project.phases.map((phase, index) => {
            const stageInfo = weighted.stages[index];
            return (
              <div
                key={`${phase.id ?? phase.name}-${index}`}
                className="relative rounded-xl border border-border bg-[#fbfaf6] p-4"
              >
                <div className="flex gap-3">
                  <span
                    className={`relative grid size-7 shrink-0 place-items-center rounded-full ${
                      phase.status === 'complete'
                        ? 'bg-[#3d9a7e] text-white'
                        : phase.status === 'active'
                          ? 'bg-[#d6a95d] text-[#173e49]'
                          : phase.status === 'blocked'
                            ? 'bg-[#fae5e1] text-[#b2473d]'
                            : 'bg-[#eef0ed] text-muted-foreground'
                    }`}
                  >
                    {phase.status === 'complete' ? (
                      <Check size={12} />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong className="text-[12px]">{phase.name}</strong>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {phase.status === 'complete'
                            ? 'Complete'
                            : phase.status === 'active'
                              ? 'Current stage'
                              : phase.status === 'blocked'
                                ? 'Blocked'
                                : 'Not started'}{' '}
                          · Owner {phase.owner}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${stageInfo?.isCustomWeight ? 'bg-[#f8edcf] text-[#9a711f]' : 'bg-[#eef0ed] text-muted-foreground'}`}
                        >
                          Weight {stageInfo?.weightPercent ?? 0}%
                        </span>
                        <span className="inline-block rounded-full bg-[#e4f1ec] px-2 py-0.5 font-mono text-[9px] font-bold text-[#2e7c67]">
                          +{stageInfo?.contribution ?? 0}% to overall
                        </span>
                        <span className="font-mono text-[10px] font-bold text-foreground">{phase.progress}%</span>
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7e7dc]">
                      <span
                        className={`block h-full rounded-full ${
                          phase.status === 'active'
                            ? 'bg-[#d19b35]'
                            : phase.status === 'blocked'
                              ? 'bg-[#d66254]'
                              : 'bg-[#3d9a7e]'
                        }`}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>

                    {(phase.workCompleted ||
                      phase.nextAction ||
                      phase.decisionRequired ||
                      phase.plannedStart ||
                      phase.plannedFinish) && (
                      <div className="mt-3 grid gap-2 text-[10px] text-muted-foreground md:grid-cols-2">
                        {phase.workCompleted && (
                          <p>
                            <strong className="text-foreground">Completed:</strong> {phase.workCompleted}
                          </p>
                        )}
                        {phase.nextAction && (
                          <p>
                            <strong className="text-foreground">Next:</strong> {phase.nextAction}
                          </p>
                        )}
                        {phase.decisionRequired && (
                          <p className="text-[#b2473d]">
                            <strong>Decision:</strong> {phase.decisionRequired}
                          </p>
                        )}
                        {(phase.plannedStart || phase.plannedFinish) && (
                          <p>
                            <strong className="text-foreground">Timeline:</strong>{' '}
                            {phase.plannedStart ? formatShortDate(phase.plannedStart) : ''}
                            {phase.plannedStart && phase.plannedFinish ? ' – ' : ''}
                            {phase.plannedFinish ? formatShortDate(phase.plannedFinish) : ''}
                            {stageInfo?.durationDays !== null ? ` (${stageInfo?.durationDays}d)` : ''}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {phase.budget != null && (
                        <span className="rounded-md border border-[#cbe4d9] bg-[#edf5f0] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2e7c67]">
                          Budget: {formatCrore(phase.budget)}
                        </span>
                      )}
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        Assigned:
                      </span>
                      <TagUserPopover
                        taggedUsers={phase.taggedUsers}
                        onChange={(newTagged) => onSave(index, { taggedUsers: newTagged })}
                        canTag={canTag}
                        saveTags={editable}
                        label="Tag Member"
                        projectId={project.id}
                        entityType="Stage"
                        entityId={phase.id}
                        entityTitle={phase.name}
                        entityContext={phase.workCompleted || phase.nextAction}
                      />
                    </div>

                    {editable && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                          className="rounded-lg border border-[#cbe4d9] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#2e7c67]"
                        >
                          {editingIndex === index ? 'Close editor' : 'Update stage'}
                        </button>
                        <button
                          type="button"
                          aria-label="Move stage up"
                          disabled={index === 0}
                          onClick={() => onMove(index, -1)}
                          className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground disabled:opacity-30"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move stage down"
                          disabled={index === project.phases.length - 1}
                          onClick={() => onMove(index, 1)}
                          className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground disabled:opacity-30"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${phase.name}`}
                          disabled={project.phases.length <= 1}
                          title={project.phases.length <= 1 ? 'A project must keep at least one stage' : undefined}
                          onClick={() => {
                            if (window.confirm(`Remove the stage "${phase.name}"? This cannot be undone.`))
                              onRemove(index);
                          }}
                          className="rounded-lg border border-[#f0c8c2] bg-white p-1.5 text-[#b2473d] disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    {editingIndex === index && (
                      <StageEditorForm
                        phase={phase}
                        onCancel={() => setEditingIndex(null)}
                        onSave={(patch) => {
                          onSave(index, patch);
                          setEditingIndex(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {editable &&
          (adding ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) return;
                onAdd({
                  id: `${project.id}-phase-${Date.now()}`,
                  name: name.trim(),
                  owner: owner.trim() || 'Unassigned',
                  status: 'upcoming',
                  progress: 0,
                  plannedStart: plannedStart || undefined,
                  plannedFinish: plannedFinish || undefined,
                  weight: weight.trim() !== '' && !isNaN(Number(weight)) ? Number(weight) : undefined,
                });
                setName('');
                setOwner('');
                setPlannedStart('');
                setPlannedFinish('');
                setWeight('');
                setAdding(false);
              }}
              className="mt-5 grid gap-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4 md:grid-cols-5"
            >
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="New stage name *"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Owner"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                type="date"
                value={plannedStart}
                onChange={(event) => setPlannedStart(event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                title="Planned start"
              />
              <input
                type="date"
                value={plannedFinish}
                onChange={(event) => setPlannedFinish(event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
                title="Planned finish"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder="Weight % (opt)"
                  className="h-10 w-24 rounded-lg border border-border bg-white px-2 text-[11px]"
                />
                <button type="submit" className="rounded-lg bg-[#173e49] px-3 py-2 text-[10px] font-bold text-white">
                  Add
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-[#f7f4ec] px-3 py-2 text-[10px] font-bold"
            >
              <Plus size={13} /> Add custom stage
            </button>
          ))}
      </DetailCard>
    </div>
  );
}
