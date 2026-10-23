import { useState } from 'react';
import { CRORE, type Phase } from '@/data/projects';
import { todayLabel } from '@/lib/date';
import { stageStatuses } from '../styles';

export function StageEditorForm({
  phase,
  onCancel,
  onSave,
}: {
  phase: Phase;
  onCancel: () => void;
  onSave: (patch: Partial<Phase>) => void;
}) {
  const [draft, setDraft] = useState({
    name: phase.name,
    owner: phase.owner,
    status: phase.status,
    progress: String(phase.progress),
    weight: phase.weight !== undefined ? String(phase.weight) : '',
    budget: phase.budget !== undefined ? String(phase.budget / CRORE) : '',
    plannedStart: phase.plannedStart ?? '',
    plannedFinish: phase.plannedFinish ?? '',
    actualFinish: phase.actualFinish ?? '',
    workCompleted: phase.workCompleted ?? '',
    nextAction: phase.nextAction ?? '',
    decisionRequired: phase.decisionRequired ?? '',
  });
  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => {
      const next = { ...current, [key]: value };
      // Keep Status and Progress in step; Blocked is a deliberate call and is left alone.
      if (key === 'progress' && current.status !== 'blocked') {
        const progress = Number(value) || 0;
        if (progress >= 100) next.status = 'complete';
        else if (progress > 0 && (current.status === 'upcoming' || current.status === 'complete'))
          next.status = 'active';
      }
      if (key === 'status' && value === 'complete') next.progress = '100';
      return next;
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...draft,
          progress: Math.max(0, Math.min(100, Number(draft.progress) || 0)),
          weight:
            draft.weight !== '' && !isNaN(Number(draft.weight))
              ? Math.max(0, Math.min(100, Number(draft.weight)))
              : undefined,
          budget:
            draft.budget !== '' && !isNaN(Number(draft.budget)) ? Math.max(0, Number(draft.budget)) * CRORE : undefined,
          status: draft.status as Phase['status'],
          updatedAt: todayLabel(),
        });
      }}
      className="mt-4 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] p-4"
    >
      <div className="grid gap-3 md:grid-cols-6">
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Stage name</span>
          <input
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Owner</span>
          <input
            value={draft.owner}
            onChange={(event) => set('owner', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Status</span>
          <select
            value={draft.status}
            onChange={(event) => set('status', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          >
            {stageStatuses.map((status) => (
              <option key={status} value={status}>
                {status === 'active' ? 'In progress' : status === 'upcoming' ? 'Not started' : status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Progress %</span>
          <input
            type="number"
            min="0"
            max="100"
            value={draft.progress}
            onChange={(event) => set('progress', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold" title="Leave empty to auto-weight by timeline duration">
            Weight % (opt)
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            placeholder="Auto"
            value={draft.weight}
            onChange={(event) => set('weight', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold" title="Allocated budget for this stage in ₹ Crores">
            Budget (₹ Cr)
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 0.5"
            value={draft.budget}
            onChange={(event) => set('budget', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Planned start</span>
          <input
            type="date"
            value={draft.plannedStart}
            onChange={(event) => set('plannedStart', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Planned finish</span>
          <input
            type="date"
            value={draft.plannedFinish}
            onChange={(event) => set('plannedFinish', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Actual finish</span>
          <input
            type="date"
            value={draft.actualFinish}
            onChange={(event) => set('actualFinish', event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Work completed</span>
          <textarea
            value={draft.workCompleted}
            onChange={(event) => set('workCompleted', event.target.value)}
            rows={3}
            placeholder="What was completed in this stage?"
            className="w-full rounded-lg border border-border bg-white px-2 py-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold">Next action</span>
          <textarea
            value={draft.nextAction}
            onChange={(event) => set('nextAction', event.target.value)}
            rows={3}
            placeholder="What happens next?"
            className="w-full rounded-lg border border-border bg-white px-2 py-2 text-[11px]"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[10px] font-bold">Decision required</span>
        <textarea
          value={draft.decisionRequired}
          onChange={(event) => set('decisionRequired', event.target.value)}
          rows={2}
          placeholder="What decision or support is required from HOD?"
          className="w-full rounded-lg border border-border bg-white px-2 py-2 text-[11px]"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-lg bg-[#173e49] px-3 py-2 text-[10px] font-bold text-white">
          Save stage update
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-white px-3 py-2 text-[10px] font-bold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
