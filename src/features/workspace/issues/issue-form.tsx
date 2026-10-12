import { issueCategories, type Project } from '@/data/projects';
import type { IssueDraft, SetIssueDraftField } from './types';

type IssueFormProps = {
  project: Project;
  draft: IssueDraft;
  onFieldChange: SetIssueDraftField;
  onSave: () => void;
  onCancel: () => void;
};

/** Inline form to log a new issue against a specific project. */
export function IssueForm({ project, draft, onFieldChange, onSave, onCancel }: IssueFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="mb-6 space-y-3 rounded-2xl border border-[#eadcb1] bg-[#fff8e9] p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-extrabold text-[#9a711f]">Log issue for {project.name}</p>
        <button type="button" onClick={onCancel} className="text-[11px] text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          required
          value={draft.title}
          onChange={(e) => onFieldChange('title', e.target.value)}
          placeholder="Issue or risk title *"
          className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
        />
        <select
          value={draft.category}
          onChange={(e) => onFieldChange('category', e.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
        >
          {issueCategories.map((cat) => (
            <option key={cat} value={cat}>
              Category: {cat}
            </option>
          ))}
        </select>
        <select
          value={draft.stage}
          onChange={(e) => onFieldChange('stage', e.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
        >
          {project.phases.map((ph, idx) => (
            <option key={`${ph.name}-${idx}`} value={ph.name}>
              Stage: {ph.name}
            </option>
          ))}
        </select>
        <select
          value={draft.severity}
          onChange={(e) => onFieldChange('severity', e.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
        >
          <option value="High">Severity: High (Critical decision)</option>
          <option value="Medium">Severity: Medium (Standard risk)</option>
          <option value="Low">Severity: Low (Minor tracking)</option>
        </select>
        <input
          value={draft.owner}
          onChange={(e) => onFieldChange('owner', e.target.value)}
          placeholder="Owner / Responsible person"
          className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Arise date</span>
            <input
              type="date"
              value={draft.issueAriseDate}
              onChange={(e) => onFieldChange('issueAriseDate', e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Target closure</span>
            <input
              type="date"
              value={draft.targetClosureDate}
              onChange={(e) => onFieldChange('targetClosureDate', e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-2 text-[10px]"
            />
          </label>
        </div>
      </div>

      <textarea
        required
        value={draft.detail}
        onChange={(e) => onFieldChange('detail', e.target.value)}
        placeholder="Describe the issue, root cause, and current situation *"
        rows={2}
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[11px]"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <input
          value={draft.impactSchedule}
          onChange={(e) => onFieldChange('impactSchedule', e.target.value)}
          placeholder="Schedule impact (e.g. +7 days)"
          className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
        />
        <input
          value={draft.impactCost}
          onChange={(e) => onFieldChange('impactCost', e.target.value)}
          placeholder="Cost impact (e.g. ₹5 Lakhs)"
          className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
        />
        <input
          value={draft.impactScope}
          onChange={(e) => onFieldChange('impactScope', e.target.value)}
          placeholder="Scope impact"
          className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
        />
        <input
          value={draft.action}
          onChange={(e) => onFieldChange('action', e.target.value)}
          placeholder="Immediate next action"
          className="h-9 rounded-lg border border-border bg-white px-2 text-[10px]"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="rounded-lg bg-[#173e49] px-4 py-2 text-[10px] font-bold text-white">
          Save issue
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
