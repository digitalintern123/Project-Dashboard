import { useState, useMemo, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileText,
  FileSpreadsheet,
  Layers3,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  ReceiptText,
  ShieldAlert,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  CRORE,
  formatCrore,
  formatShortDate,
  getProjectTemplate,
  issueCategories,
  projectStatuses,
  locations,
  categories,
  type Health,
  type IssueCategory,
  type IssueStatus,
  type Phase,
  type Project,
  type ProjectIssue,
  type ProjectStatus,
  type SitePhoto,
  type Location,
  type Category,
} from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { formatFullDate, isValidIsoDate, parseIsoDate, todayLabel } from '@/lib/date';
import { getCommercialSummary, getProgressVariance, formatRatio, calculateWeightedProgress } from '@/lib/calculations';
import { initialsOf, leadName } from '@/data/users';
import { statusTone } from './workspace';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { PhotoUploadDialog } from '@/components/photo-upload-dialog';
import { ProjectAreaProgram } from '@/components/project-area-program';
import { TagUserPopover } from '@/components/tag-user-popover';
import { EmailHubModal } from '@/components/email-hub-modal';
import { getIssueStatusTheme, issueStatusOptions } from '@/lib/issue-theme';
import { activateOnKey } from '@/lib/a11y';

const healthStyles: Record<Health, { dot: string; text: string; bg: string; border: string }> = {
  'On track': { dot: 'bg-[#3d9a7e]', text: 'text-[#2e7c67]', bg: 'bg-[#e4f1ec]', border: 'border-[#cbe4d9]' },
  'At risk': { dot: 'bg-[#d19b35]', text: 'text-[#9a711f]', bg: 'bg-[#f8edcf]', border: 'border-[#eadcb1]' },
  Delayed: { dot: 'bg-[#d66254]', text: 'text-[#b2473d]', bg: 'bg-[#fae5e1]', border: 'border-[#f0c8c2]' },
  'Not started': { dot: 'bg-[#8c938d]', text: 'text-[#69716b]', bg: 'bg-[#eef0ed]', border: 'border-[#d9ded8]' },
};

type Tab =
  'overview' | 'program' | 'progress' | 'timeline' | 'milestones' | 'photos' | 'commercial' | 'issues' | 'updates';

function Metric({
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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ProgressRing({ progress }: { progress: number }) {
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

function PhaseList({ project }: { project: Project }) {
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

function DetailCard({
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

const stageStatuses: Phase['status'][] = ['upcoming', 'active', 'blocked', 'complete'];

function StageProgressPanel({
  project,
  editable,
  onSave,
}: {
  project: Project;
  editable: boolean;
  onSave: (progress: number, comment: string, milestone: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [milestone, setMilestone] = useState(project.nextMilestone);
  const activePhase = project.phases.find((phase) => phase.status === 'active');
  const weighted = calculateWeightedProgress(project.phases);

  return (
    <div className="w-full">
      <DetailCard title="Weighted Project Progress" eyebrow="Formula: Σ(Stage Progress × Weight)" icon={ClipboardCheck}>
        <div className="mt-6 grid gap-7 md:grid-cols-[140px_1fr] md:items-center">
          <div className="flex flex-col items-center gap-3">
            <ProgressRing progress={weighted.overallProgress} />
            <span className="text-center text-[10px] leading-4 text-muted-foreground">
              Planned opening
              <br />
              <strong className="text-foreground">{project.targetLabel}</strong>
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold">Progress Breakdown by Stage</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {weighted.hasTimelineData ? `Timeline Total: ${weighted.totalDurationDays}d` : 'Equal Stage Weights'}
              </span>
            </div>

            {/* Visual stacked contribution bar */}
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#e7e7dc] p-0.5">
              {weighted.stages.map((stage, idx) => {
                if (stage.contribution <= 0) return null;
                const colors = [
                  'bg-[#3d9a7e]',
                  'bg-[#2e7c67]',
                  'bg-[#d19b35]',
                  'bg-[#e0ab46]',
                  'bg-[#173e49]',
                  'bg-[#286070]',
                ];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={stage.name}
                    className={`h-full first:rounded-l-full last:rounded-r-full ${color}`}
                    style={{ width: `${stage.contribution}%` }}
                    title={`${stage.name}: +${stage.contribution}% (Weight: ${stage.weightPercent}%, Progress: ${stage.progress}%)`}
                  />
                );
              })}
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground">
              Overall completion is the mathematically weighted summation of each stage's progress proportional to its
              schedule duration and custom weightings.
            </p>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-border bg-[#f8f6f0] text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">
                <th className="py-2.5 pl-3 pr-2">Stage</th>
                <th className="px-2 py-2.5">Timeline</th>
                <th className="px-2 py-2.5 text-center">Weight</th>
                <th className="px-2 py-2.5 text-center">Progress</th>
                <th className="py-2.5 pl-2 pr-3 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {weighted.stages.map((stage) => {
                const phase = project.phases[stage.phaseIndex];
                return (
                  <tr key={`${stage.name}-${stage.phaseIndex}`} className="hover:bg-[#fbfaf6]">
                    <td className="py-2.5 pl-3 pr-2">
                      <div className="font-bold text-foreground">{stage.name}</div>
                      <div className="text-[10px] text-muted-foreground">{phase?.owner || 'Unassigned'}</div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[10px] text-muted-foreground">
                      {stage.durationDays !== null ? (
                        <span>
                          {phase?.plannedStart ? formatShortDate(phase.plannedStart) : ''}
                          {phase?.plannedStart && phase?.plannedFinish ? ' – ' : ''}
                          {phase?.plannedFinish ? formatShortDate(phase.plannedFinish) : ''}
                          <span className="ml-1 text-[9px] font-bold text-foreground">({stage.durationDays}d)</span>
                        </span>
                      ) : (
                        <span>No dates set</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${stage.isCustomWeight ? 'bg-[#f8edcf] text-[#9a711f]' : 'bg-[#eef0ed] text-muted-foreground'}`}
                      >
                        {stage.weightPercent}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono font-bold">{stage.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-right font-mono font-bold text-[#2e7c67]">
                      +{stage.contribution}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                <td className="py-2.5 pl-3 pr-2">Total Project Delivery</td>
                <td className="px-2 py-2.5 font-mono text-[10px] text-muted-foreground">
                  {weighted.hasTimelineData ? `${weighted.totalDurationDays} calendar days` : '—'}
                </td>
                <td className="px-2 py-2.5 text-center font-mono">100%</td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">—</td>
                <td className="py-2.5 pl-2 pr-3 text-right font-mono text-[12px] text-[#2e7c67]">
                  {weighted.overallProgress}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
          {(() => {
            const { planned, variance } = getProgressVariance(project);
            return (
              <div className="flex flex-wrap gap-5 text-[11px]">
                <span>
                  Planned <strong>{planned === null ? 'Unavailable' : `${planned}%`}</strong>
                </span>
                <span>
                  Actual <strong>{weighted.overallProgress}%</strong>
                </span>
                <span className={variance !== null && variance < 0 ? 'text-[#b2473d]' : 'text-[#2e7c67]'}>
                  Variance <strong>{variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance}%`}</strong>
                </span>
              </div>
            );
          })()}
          {editable && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl bg-[#d6a95d] px-3 py-2 text-[10px] font-extrabold text-[#173e49]"
            >
              Log progress note
            </button>
          )}
        </div>

        {editing && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSave(weighted.overallProgress, comment, milestone);
              setEditing(false);
            }}
            className="mt-5 space-y-4 rounded-2xl border border-[#eadcb1] bg-[#fff8e9] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-extrabold">Log progress update note</p>
              <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground">
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Overall progress is calculated automatically as <strong>{weighted.overallProgress}%</strong> based on
              stage weights and durations. To change stage progress or timeline dates, use the <strong>Timeline</strong>{' '}
              tab.
            </p>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold">Next expected milestone</span>
              <input
                value={milestone}
                onChange={(event) => setMilestone(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-[11px] outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold">Progress note / status update</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                placeholder={`What changed in ${activePhase?.name ?? 'the current stage'}?`}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-[11px] outline-none"
              />
            </label>
            <button type="submit" className="rounded-xl bg-[#173e49] px-4 py-2.5 text-[10px] font-extrabold text-white">
              Save update note
            </button>
          </form>
        )}
      </DetailCard>
    </div>
  );
}

function StageEditorForm({
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
  const set = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

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

function StageTimelinePanel({
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

function StageMilestonesPanel({
  project,
  editable,
  canTag = true,
  onAdd,
}: {
  project: Project;
  editable: boolean;
  canTag?: boolean;
  onAdd: (milestone: {
    title: string;
    date: string;
    status: 'upcoming';
    stage: string;
    owner: string;
    approvalRequired: boolean;
    approvalStatus: 'Not required' | 'Pending';
  }) => void;
}) {
  const { approveMilestone, completeMilestone, updateMilestone } = useAppState();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [stage, setStage] = useState(
    project.phases.find((phase) => phase.status === 'active')?.name ?? project.phases[0]?.name ?? '',
  );
  const [owner, setOwner] = useState('');
  const [approvalRequired, setApprovalRequired] = useState(false);

  const handleApprove = async (milestoneId: string, status: 'Approved' | 'Rejected') => {
    const success = await approveMilestone(project.id, milestoneId, status);
    if (success) {
      toast({
        title: `Milestone ${status}`,
        description: `Approval status updated to ${status}.`,
      });
    }
  };

  const handleComplete = async (milestoneId: string) => {
    const success = await completeMilestone(project.id, milestoneId);
    if (success) {
      toast({
        title: 'Milestone Completed',
        description: 'Control point marked as complete and logged.',
      });
    }
  };

  // Partition into Active/Incomplete (top) and Completed (bottom)
  const sortedMilestones = useMemo(() => {
    const active: Array<{ milestone: (typeof project.milestones)[0]; originalIndex: number }> = [];
    const completed: Array<{ milestone: (typeof project.milestones)[0]; originalIndex: number }> = [];

    project.milestones.forEach((m, idx) => {
      if (m.status === 'complete') {
        completed.push({ milestone: m, originalIndex: idx });
      } else {
        active.push({ milestone: m, originalIndex: idx });
      }
    });

    // Active/incomplete: earliest / imminent target date first
    active.sort((a, b) => a.milestone.date.localeCompare(b.milestone.date));
    // Completed: most recently completed / target date first at bottom
    completed.sort((a, b) => b.milestone.date.localeCompare(a.milestone.date));

    return [...active, ...completed];
  }, [project.milestones]);

  const hasActive = sortedMilestones.some((item) => item.milestone.status !== 'complete');
  const hasCompleted = sortedMilestones.some((item) => item.milestone.status === 'complete');

  return (
    <DetailCard title="Milestones & approvals" eyebrow="Control points" icon={CalendarDays}>
      <div className="mt-6 space-y-6">
        {/* Active & Pending Milestones */}
        <div>
          {hasCompleted && hasActive && (
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-foreground">
                Active & Upcoming ({sortedMilestones.filter((m) => m.milestone.status !== 'complete').length})
              </span>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedMilestones
              .filter((item) => item.milestone.status !== 'complete')
              .map(({ milestone, originalIndex }) => {
                const milestoneId = (milestone as any).id || `${project.id}-${milestone.title}`;
                const isPendingApproval = milestone.approvalRequired && milestone.approvalStatus === 'Pending';
                const isComplete = milestone.status === 'complete';
                return (
                  <div
                    key={`${milestone.title}-${milestone.date}-${originalIndex}`}
                    className={`flex flex-col justify-between rounded-xl border p-4 ${
                      isComplete
                        ? 'border-[#cbe4d9] bg-[#edf5f0]'
                        : milestone.status === 'late'
                          ? 'border-[#f0c8c2] bg-[#fae5e1]'
                          : 'border-border bg-[#fbfaf6]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-7 place-items-center rounded-lg ${
                            isComplete
                              ? 'bg-[#d8ede3] text-[#2e7c67]'
                              : milestone.status === 'late'
                                ? 'bg-[#f3d3ce] text-[#b2473d]'
                                : 'bg-[#f8edcf] text-[#9a711f]'
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 size={14} />
                          ) : milestone.status === 'late' ? (
                            <AlertTriangle size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">
                          {milestone.status}
                        </span>
                      </div>
                      <p className="mt-4 text-[11px] font-bold leading-4">{milestone.title}</p>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[.09em] text-muted-foreground">
                        {formatShortDate(milestone.date)} {milestone.date.slice(0, 4)}
                      </p>
                      {(milestone.stage || milestone.owner) && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {milestone.stage ?? 'Unassigned'} · {milestone.owner ?? 'No owner'}
                        </p>
                      )}
                      {milestone.approvalRequired && (
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] ${
                            milestone.approvalStatus === 'Approved'
                              ? 'bg-[#d8ede3] text-[#2e7c67]'
                              : milestone.approvalStatus === 'Rejected'
                                ? 'bg-[#fae5e1] text-[#b2473d]'
                                : 'bg-[#f8edcf] text-[#9a711f]'
                          }`}
                        >
                          Approval · {milestone.approvalStatus ?? 'Pending'}
                        </span>
                      )}

                      <div className="mt-3 flex items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          Assigned:
                        </span>
                        <TagUserPopover
                          taggedUsers={milestone.taggedUsers}
                          onChange={(newTagged) =>
                            updateMilestone(project.id, originalIndex, { taggedUsers: newTagged })
                          }
                          canTag={canTag}
                          label="Tag Member"
                          projectId={project.id}
                          entityType="Milestone"
                          entityId={milestoneId}
                          entityTitle={milestone.title}
                          entityContext={`Target Date: ${milestone.date}${milestone.stage ? ` • Stage: ${milestone.stage}` : ''}`}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                      {isPendingApproval && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Approved')}
                            className="flex items-center gap-1 rounded-lg bg-[#2e7c67] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#256554]"
                          >
                            <ThumbsUp size={10} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Rejected')}
                            className="flex items-center gap-1 rounded-lg bg-[#b2473d] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#963c33]"
                          >
                            <ThumbsDown size={10} /> Reject
                          </button>
                        </>
                      )}
                      {!isComplete && (
                        <button
                          type="button"
                          onClick={() => handleComplete(milestoneId)}
                          className="flex items-center gap-1 rounded-lg border border-[#cbe4d9] bg-white px-2 py-1 text-[9px] font-bold text-[#2e7c67] hover:bg-[#edf5f0]"
                        >
                          <Check size={10} /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Completed Milestones Section at Bottom */}
        {hasCompleted && (
          <div className="border-t border-border/70 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                Completed Milestones ({sortedMilestones.filter((m) => m.milestone.status === 'complete').length})
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedMilestones
                .filter((item) => item.milestone.status === 'complete')
                .map(({ milestone, originalIndex }) => {
                  const milestoneId = (milestone as any).id || `${project.id}-${milestone.title}`;
                  const isPendingApproval = milestone.approvalRequired && milestone.approvalStatus === 'Pending';
                  return (
                    <div
                      key={`${milestone.title}-${milestone.date}-${originalIndex}`}
                      className="flex flex-col justify-between rounded-xl border border-[#cbe4d9] bg-[#edf5f0]/80 p-4 opacity-90 transition hover:opacity-100"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="grid size-7 place-items-center rounded-lg bg-[#d8ede3] text-[#2e7c67]">
                            <CheckCircle2 size={14} />
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-[.08em] text-[#2e7c67] font-semibold">
                            Complete
                          </span>
                        </div>
                        <p className="mt-4 text-[11px] font-bold leading-4 line-through decoration-[#2e7c67]/40 text-foreground/80">
                          {milestone.title}
                        </p>
                        <p className="mt-2 font-mono text-[9px] uppercase tracking-[.09em] text-muted-foreground">
                          {formatShortDate(milestone.date)} {milestone.date.slice(0, 4)}
                        </p>
                        {(milestone.stage || milestone.owner) && (
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            {milestone.stage ?? 'Unassigned'} · {milestone.owner ?? 'No owner'}
                          </p>
                        )}
                        {milestone.approvalRequired && (
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.08em] ${
                              milestone.approvalStatus === 'Approved'
                                ? 'bg-[#d8ede3] text-[#2e7c67]'
                                : milestone.approvalStatus === 'Rejected'
                                  ? 'bg-[#fae5e1] text-[#b2473d]'
                                  : 'bg-[#f8edcf] text-[#9a711f]'
                            }`}
                          >
                            Approval · {milestone.approvalStatus ?? 'Pending'}
                          </span>
                        )}

                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            Assigned:
                          </span>
                          <TagUserPopover
                            taggedUsers={milestone.taggedUsers}
                            onChange={(newTagged) =>
                              updateMilestone(project.id, originalIndex, { taggedUsers: newTagged })
                            }
                            canTag={canTag}
                            label="Tag Member"
                            projectId={project.id}
                            entityType="Milestone"
                            entityId={milestoneId}
                            entityTitle={milestone.title}
                            entityContext={`Target Date: ${milestone.date}${milestone.stage ? ` • Stage: ${milestone.stage}` : ''}`}
                          />
                        </div>
                      </div>

                      {/* Action Buttons if needed */}
                      {isPendingApproval && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Approved')}
                            className="flex items-center gap-1 rounded-lg bg-[#2e7c67] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#256554]"
                          >
                            <ThumbsUp size={10} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(milestoneId, 'Rejected')}
                            className="flex items-center gap-1 rounded-lg bg-[#b2473d] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#963c33]"
                          >
                            <ThumbsDown size={10} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      {editable &&
        (adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!title || !date) return;
              onAdd({
                title,
                date,
                status: 'upcoming',
                stage,
                owner: owner || 'Project Lead',
                approvalRequired,
                approvalStatus: approvalRequired ? 'Pending' : 'Not required',
              });
              setTitle('');
              setDate('');
              setOwner('');
              setApprovalRequired(false);
              setAdding(false);
            }}
            className="mt-5 space-y-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Milestone name"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                required
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                {project.phases.map((phase, index) => (
                  <option key={`${phase.name}-${index}`}>{phase.name}</option>
                ))}
              </select>
              <input
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Milestone owner"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(event) => setApprovalRequired(event.target.checked)}
              />{' '}
              Requires HOD / stakeholder approval
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-[#173e49] px-4 py-2 text-[10px] font-bold text-white">
                Add milestone
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-[10px] font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 rounded-xl border border-border bg-[#f7f4ec] px-3 py-2 text-[10px] font-bold"
          >
            <Plus size={13} className="mr-1 inline" /> Add milestone
          </button>
        ))}
    </DetailCard>
  );
}

function StageIssuesPanel({
  project,
  editable,
  canTag = true,
  onAdd,
  onUpdate,
}: {
  project: Project;
  editable: boolean;
  canTag?: boolean;
  onAdd: (issue: ProjectIssue) => void;
  onUpdate: (index: number, patch: Partial<ProjectIssue>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    detail: '',
    category: 'Design' as IssueCategory,
    severity: 'Medium' as ProjectIssue['severity'],
    stage: project.phases.find((phase) => phase.status === 'active')?.name ?? project.phases[0]?.name ?? '',
    owner: '',
    issueAriseDate: todayLabel(),
    targetClosureDate: '',
    dueDate: '',
    impactCost: '',
    impactSchedule: '',
    impactScope: '',
    action: '',
  });
  const set = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <DetailCard title="Issues & risks" eyebrow="Decision radar" icon={ShieldAlert} tone="gold">
      <div className="mt-5 space-y-3">
        {project.issues.length ? (
          project.issues.map((issue, index) => {
            const ariseDate = issue.issueAriseDate || issue.dateRaised;
            const closureDate = issue.targetClosureDate || issue.dueDate;
            const statusTheme = getIssueStatusTheme(issue.status, issue.severity);
            const StatusIcon = statusTheme.icon;

            return (
              <div
                key={`${issue.id ?? issue.title}-${index}`}
                className={`rounded-xl border p-3.5 transition-colors duration-200 ${statusTheme.cardClass}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg transition-colors ${statusTheme.iconBoxClass}`}
                    title={statusTheme.description}
                  >
                    <StatusIcon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold">{issue.title}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${statusTheme.badgeClass}`}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: statusTheme.dotColor }} />
                          {issue.status ?? 'Open'}
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-[.1em] text-muted-foreground">
                          {issue.severity} · Category: {issue.category ?? 'Other'}
                        </span>
                      </div>
                    </span>
                    <span className="mt-1.5 block text-[10px] leading-4 text-muted-foreground">{issue.detail}</span>
                    <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                      <span className="rounded-full bg-white px-2 py-1">{issue.stage ?? 'General project issue'}</span>
                      <span className="rounded-full bg-white px-2 py-1">Owner · {issue.owner}</span>
                      {ariseDate && (
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-[#8b631d]">
                          Issue Arise Date: {formatShortDate(ariseDate)}
                        </span>
                      )}
                      {closureDate && (
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-[#173e49]">
                          Target Closure Date: {formatShortDate(closureDate)}
                        </span>
                      )}
                    </div>
                    {(issue.action || issue.impactCost || issue.impactSchedule || issue.impactScope) && (
                      <div className="mt-3 grid gap-2 text-[10px] text-muted-foreground md:grid-cols-2">
                        {issue.action && (
                          <p>
                            <strong className="text-foreground">Action:</strong> {issue.action}
                          </p>
                        )}
                        {issue.impactSchedule && (
                          <p>
                            <strong className="text-foreground">Schedule impact:</strong> {issue.impactSchedule}
                          </p>
                        )}
                        {issue.impactCost && (
                          <p>
                            <strong className="text-foreground">Cost impact:</strong> {issue.impactCost}
                          </p>
                        )}
                        {issue.impactScope && (
                          <p>
                            <strong className="text-foreground">Scope / quality impact:</strong> {issue.impactScope}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Progress indicator toward resolution & closure */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/5">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${statusTheme.stepPercent}%`,
                            backgroundColor: statusTheme.dotColor,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[8px] font-bold" style={{ color: statusTheme.dotColor }}>
                        {statusTheme.stepPercent}% · {statusTheme.description}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          Tagged:
                        </span>
                        <TagUserPopover
                          taggedUsers={issue.taggedUsers}
                          onChange={(newTagged) => onUpdate(index, { taggedUsers: newTagged })}
                          canTag={canTag}
                          label="Tag Member"
                          projectId={project.id}
                          entityType="Issue"
                          entityId={`issue-${index}`}
                          entityTitle={issue.title}
                          entityContext={`Severity: ${issue.severity || 'Medium'} • Category: ${issue.category || 'General'}${issue.detail ? `\nDetail: ${issue.detail}` : ''}`}
                        />
                      </div>
                      {editable ? (
                        <label className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="text-muted-foreground">Status</span>
                          <select
                            value={issue.status ?? 'Open'}
                            onChange={(event) => onUpdate(index, { status: event.target.value as IssueStatus })}
                            className={`h-8 rounded-lg border px-2 text-[10px] outline-none transition-all cursor-pointer shadow-sm ${statusTheme.selectClass}`}
                          >
                            {issueStatusOptions.map((opt) => (
                              <option key={opt.status} value={opt.status} className="bg-white text-foreground">
                                {opt.prefix} {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] ${statusTheme.badgeClass}`}
                        >
                          {issue.status ?? 'Open'}
                        </span>
                      )}
                    </div>
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-[#eadcb1] bg-[#fff8e9]/70 p-4 text-[11px] text-muted-foreground">
            No issues or risks recorded for this project.
          </p>
        )}
      </div>

      {editable &&
        (adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.title || !draft.detail) return;
              onAdd({
                ...draft,
                owner: draft.owner || 'Project Lead',
                status: 'Open',
                dateRaised: draft.issueAriseDate || todayLabel(),
                issueAriseDate: draft.issueAriseDate || todayLabel(),
                dueDate: draft.targetClosureDate || draft.dueDate,
                targetClosureDate: draft.targetClosureDate || draft.dueDate,
              });
              setDraft({
                title: '',
                detail: '',
                category: 'Design',
                severity: 'Medium',
                stage: project.phases.find((phase) => phase.status === 'active')?.name ?? project.phases[0]?.name ?? '',
                owner: '',
                dueDate: '',
                issueAriseDate: todayLabel(),
                targetClosureDate: '',
                impactCost: '',
                impactSchedule: '',
                impactScope: '',
                action: '',
              });
              setAdding(false);
            }}
            className="mt-5 space-y-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input
                required
                value={draft.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="Issue or risk title *"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <select
                value={draft.category}
                onChange={(event) => set('category', event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                {issueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={draft.stage}
                onChange={(event) => set('stage', event.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                {project.phases.map((phase, index) => (
                  <option key={`${phase.name}-${index}`}>{phase.name}</option>
                ))}
              </select>
              <select
                value={draft.severity}
                onChange={(event) => set('severity', event.target.value as any)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <input
                value={draft.owner}
                onChange={(event) => set('owner', event.target.value)}
                placeholder="Issue owner"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <label className="block">
                <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                  Issue Arise Date
                </span>
                <input
                  type="date"
                  value={draft.issueAriseDate}
                  onChange={(event) => set('issueAriseDate', event.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                  Target Closure Date
                </span>
                <input
                  type="date"
                  value={draft.targetClosureDate}
                  onChange={(event) => set('targetClosureDate', event.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
                />
              </label>
            </div>
            <textarea
              required
              value={draft.detail}
              onChange={(event) => set('detail', event.target.value)}
              placeholder="Describe the issue, cause, and current situation *"
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[11px]"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={draft.impactSchedule}
                onChange={(event) => set('impactSchedule', event.target.value)}
                placeholder="Schedule impact"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={draft.impactCost}
                onChange={(event) => set('impactCost', event.target.value)}
                placeholder="Cost impact"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={draft.impactScope}
                onChange={(event) => set('impactScope', event.target.value)}
                placeholder="Scope / quality impact"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
              <input
                value={draft.action}
                onChange={(event) => set('action', event.target.value)}
                placeholder="Next action / resolution"
                className="h-10 rounded-lg border border-border bg-white px-3 text-[11px]"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-[#173e49] px-4 py-2 text-[10px] font-bold text-white">
                Add issue
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-[10px] font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 rounded-xl border border-[#eadcb1] bg-white/60 px-3 py-2 text-[10px] font-bold text-[#9a711f]"
          >
            <Plus size={13} className="mr-1 inline" /> Add issue or risk
          </button>
        ))}
    </DetailCard>
  );
}

function StageUpdatesPanel({
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
  }) => void;
}) {
  const { user } = useAppState();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [stage, setStage] = useState(
    project.phases.find((phase) => phase.status === 'active')?.name ?? project.phases[0]?.name ?? '',
  );
  const [kind, setKind] = useState<'Progress' | 'Decision' | 'Risk' | 'General'>('Progress');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;

    onAdd({
      text: text.trim(),
      date: todayLabel(),
      author: user?.name ?? 'Project Lead',
      role: user?.title ?? 'Project Lead',
      stage,
      kind,
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

            <textarea
              required
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder="What changed in this stage? Write your update note..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[11px]"
            />

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
                  projectId={project.id}
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
                  className="rounded-lg bg-[#173e49] px-3.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#205160]"
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

function StagePhotosPanel({
  project,
  editable,
  onUpload,
  onDelete,
  onInspect,
}: {
  project: Project;
  editable: boolean;
  onUpload: () => void;
  onDelete: (photoId: string) => void;
  onInspect: (photo: SitePhoto) => void;
}) {
  const photos = project.photos || [];
  const latestPhoto = photos.length > 0 ? photos[0] : null;

  return (
    <div className="w-full space-y-6">
      <DetailCard title="Site Photographs Gallery" eyebrow="Physical Progress Verification" icon={Camera}>
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="text-[12px] text-muted-foreground max-w-xl">
              Verified physical site photographs for <strong>{project.name}</strong> documenting construction progress,
              MEP fit-out, and snag resolutions.
              {photos.length > 0 && (
                <span className="block mt-1 font-semibold text-foreground">
                  {photos.length} verified site photograph{photos.length > 1 ? 's' : ''} in project gallery.
                </span>
              )}
            </p>
          </div>
          {editable && (
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#205160] transition shadow-sm shrink-0"
            >
              <Upload size={14} />
              Upload Site Photographs
            </button>
          )}
        </div>

        {photos.length > 0 ? (
          <div className="mt-6 space-y-8">
            {/* Featured / Latest Photograph */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#9a711f]">
                  Latest Verified Progress
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Captured {latestPhoto?.takenDate ? formatFullDate(latestPhoto.takenDate) : 'Recently'}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
                {/* Clickable Featured Image */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Open the latest site photograph"
                  onClick={() => latestPhoto && onInspect(latestPhoto)}
                  onKeyDown={activateOnKey(() => latestPhoto && onInspect(latestPhoto))}
                  className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black/5 cursor-pointer shadow-md"
                >
                  <img
                    src={latestPhoto?.url}
                    alt={latestPhoto?.caption}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="rounded-xl bg-black/75 px-4 py-2 text-[11px] font-bold text-white backdrop-blur-sm shadow-lg flex items-center gap-2">
                      <Camera size={14} /> Click to inspect high-resolution
                    </span>
                  </div>
                </div>

                {/* Latest Photo Metadata Card */}
                <div className="rounded-2xl border border-border bg-[#fbf9f4] p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {latestPhoto?.category && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#e4f1ec] text-[#2e7c67] border border-[#cbe4d9]">
                        {latestPhoto.category}
                      </span>
                    )}
                    {latestPhoto?.stage && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white text-foreground border border-border">
                        Stage: {latestPhoto.stage}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Progress Caption
                    </h4>
                    <p className="mt-1 text-[13px] font-semibold leading-relaxed text-foreground">
                      "{latestPhoto?.caption}"
                    </p>
                  </div>

                  <div className="border-t border-border/70 pt-4 space-y-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Date Captured</span>
                      <strong className="text-foreground font-mono">
                        {latestPhoto?.takenDate ? formatFullDate(latestPhoto.takenDate) : '—'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Uploaded By</span>
                      <strong className="text-foreground">
                        {latestPhoto?.uploadedBy} ({latestPhoto?.role || 'Team'})
                      </strong>
                    </div>
                    {latestPhoto?.fileSize ? (
                      <div className="flex items-center justify-between">
                        <span>File Size</span>
                        <span className="font-mono">{Math.round(latestPhoto.fileSize / 1024)} KB</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-border/70 pt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => latestPhoto && onInspect(latestPhoto)}
                      className="rounded-xl border border-border bg-white px-3.5 py-2 text-[11px] font-bold text-foreground hover:bg-muted transition"
                    >
                      View High-Res
                    </button>
                    {editable && latestPhoto && (
                      <button
                        type="button"
                        onClick={() => onDelete(latestPhoto.id)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                      >
                        Delete Photograph
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery Grid (All Photographs) */}
            {photos.length > 1 && (
              <div className="border-t border-border/70 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold text-foreground">All Project Photographs ({photos.length})</h3>
                  <span className="text-[11px] text-muted-foreground">Click any photo to open full-screen viewer</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((ph, idx) => (
                    <div
                      key={ph.id}
                      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Open photograph: ${ph.caption || 'site photograph'}`}
                        onClick={() => onInspect(ph)}
                        onKeyDown={activateOnKey(() => onInspect(ph))}
                        className="relative aspect-video w-full overflow-hidden bg-black/5 cursor-pointer"
                      >
                        <img
                          src={ph.url}
                          alt={ph.caption}
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {ph.category && (
                            <span className="rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 font-mono text-[8px] font-bold text-white uppercase">
                              {ph.category}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-white/90">
                          #{idx + 1}
                        </div>
                      </div>

                      <div className="p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-foreground line-clamp-2 leading-snug">
                          {ph.caption}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                          <span>{ph.takenDate ? formatFullDate(ph.takenDate) : 'Unknown date'}</span>
                          {ph.stage && <span className="font-medium text-foreground">{ph.stage}</span>}
                        </div>
                        {editable && (
                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => onDelete(ph.id)}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <Camera size={38} className="mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-[16px] font-bold text-foreground">No Site Photographs Uploaded Yet</h3>
            <p className="mt-2 text-[12px] text-muted-foreground max-w-md mx-auto leading-relaxed">
              Upload physical progress photos, snag shots, or milestone completions directly from the site to keep
              stakeholders visually aligned. Multiple photos can be uploaded at once.
            </p>
            {editable && (
              <button
                type="button"
                onClick={onUpload}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-5 py-2.5 text-[11px] font-bold text-white hover:bg-[#205160] transition shadow-sm"
              >
                <Upload size={14} />
                Upload Site Photographs
              </button>
            )}
          </div>
        )}
      </DetailCard>
    </div>
  );
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    projects,
    role,
    user,
    updateProject,
    deleteProject,
    updatePhase,
    addPhase,
    removePhase,
    movePhase,
    addMilestone,
    addIssue,
    updateIssue,
    addUpdate,
    addPhoto,
    addMultiplePhotos,
    deletePhoto,
  } = useAppState();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<SitePhoto | null>(null);
  const project = projects.find((item) => item.id === projectId);
  if (!project)
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Project not found</p>
        <h1 className="mt-3 font-serif text-4xl text-[#173e49]">That project is not in this portfolio.</h1>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-[12px] font-bold text-primary-foreground"
        >
          <ArrowLeft size={14} /> Return to portfolio
        </Link>
      </div>
    );
  const health = healthStyles[project.health];
  const isAllottedToMe = !project.leadId || project.leadId === user?.id;
  const canEdit = role === 'coordinator' || (role === 'lead' && isAllottedToMe);
  // HOD and leads/coordinators can tag individuals on tasks and issues
  const canTag = true;
  const activePhase = project.phases.find((phase) => phase.status === 'active')?.name ?? 'planning';
  const saveProgress = (progress: number, comment: string, nextMilestone: string) => {
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description:
          role === 'hod'
            ? 'HOD accounts have strict view-only oversight.'
            : `You can only update projects allotted to you. This project is assigned to ${leadName(project.leadId)}.`,
      });
      return;
    }
    const saved = updateProject(project.id, {
      progress: clampPercent(progress),
      nextMilestone: nextMilestone.trim() || project.nextMilestone,
    });
    if (!saved) {
      toast({
        variant: 'destructive',
        title: 'Not saved',
        description: 'Project edits require Lead or Coordinator permissions.',
      });
      return;
    }
    if (comment.trim()) {
      addUpdate(project.id, {
        date: todayLabel(),
        author: user?.name ?? 'Project Lead',
        role: user?.title ?? 'Project Lead',
        text: comment.trim(),
        stage: activePhase,
        kind: 'Progress',
      });
    }
    toast({ title: 'Progress updated', description: `${project.name} is now at ${clampPercent(progress)}%.` });
  };
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
  const commercial = getCommercialSummary(project);
  const progressVariance = getProgressVariance(project);
  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-7 md:px-10 md:pt-9">
      <Link
        href="/"
        className="fade-up inline-flex items-center gap-2 text-[11px] font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to portfolio
      </Link>
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
                  onChange={(e) => {
                    const newStatus = e.target.value as ProjectStatus;
                    updateProject(project.id, { status: newStatus });
                    toast({
                      title: 'Status updated',
                      description: `${project.name} is now set to "${newStatus}".`,
                    });
                  }}
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

          <div
            className={`flex shrink-0 items-center gap-3 rounded-2xl border ${health.border} ${health.bg} px-4 py-3`}
          >
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
            onClick={() => setEmailModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-3.5 py-3 text-[10px] font-extrabold text-[#2e7c67] hover:bg-[#dfeee5] transition shadow-xs"
            title="Share executive update email or inspect delivery outbox"
          >
            <Mail size={14} /> Email Update
          </button>

          {canEdit ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="flex items-center gap-2 rounded-xl bg-[#d6a95d] px-3.5 py-3 text-[10px] font-extrabold text-[#173e49] hover:bg-[#e2bd73] transition"
              >
                <Pencil size={14} /> Edit project
              </button>
              {role === 'coordinator' && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
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
              {role === 'hod' ? 'View only · HOD Oversight' : `View only · Allotted to ${leadName(project.leadId)}`}
            </span>
          )}
        </div>
      </section>

      {editing && canEdit && (
        <EditProjectForm
          project={project}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            updateProject(project.id, patch);
            setEditing(false);
          }}
        />
      )}

      <section className="fade-up mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Project Status"
          value={project.status || 'Yet to start'}
          note="User-defined status"
          icon={Layers3}
        />
        <Metric
          label="Completion %"
          value={`${project.progress}%`}
          note={
            progressVariance.variance !== null
              ? `${progressVariance.variance >= 0 ? '+' : ''}${progressVariance.variance}% vs planned`
              : 'Target schedule'
          }
          icon={TrendingUp}
        />
        <Metric
          label="Approved Budget (AOP)"
          value={formatCrore(project.aop)}
          tone={commercial.overAwarded ? 'warning' : 'default'}
          note={
            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
              <div>
                {formatCrore(project.awarded)} committed{' '}
                {commercial.overAwarded && <span className="font-bold text-[#b2473d]">(Over AOP)</span>}
              </div>
              <div>{formatCrore(project.spent)} spent</div>
            </div>
          }
          icon={CircleDollarSign}
        />
        <Metric
          label="Projected Cost"
          value={formatCrore(project.projectedCost ?? project.aop)}
          tone={commercial.overBudget ? 'danger' : 'default'}
          note={
            commercial.costVariance === 0
              ? 'On approved budget'
              : commercial.costVariance > 0
                ? `+${formatCrore(commercial.costVariance)} variance (Over budget)`
                : `${formatCrore(commercial.costVariance)} variance`
          }
          icon={ReceiptText}
        />
        <Metric
          label="Completion Date"
          value={project.targetLabel || (project.targetDate ? formatFullDate(project.targetDate) : 'Not set')}
          note={(() => {
            const target = parseIsoDate(project.targetDate);
            if (!target) return 'Planned opening schedule';
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffMs = target.getTime() - today.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays > 0) return `${diffDays} days remaining`;
            if (diffDays === 0) return 'Due today';
            return `${Math.abs(diffDays)} days past target`;
          })()}
          icon={CalendarDays}
        />
      </section>

      <div className="mt-9 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            onClick={() => setTab(value)}
            className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-[11px] font-bold ${tab === value ? 'text-[#173e49]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon size={14} />
            {label}
            {tab === value && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#d19b35]" />}
          </button>
        ))}
      </div>
      <div className="fade-up mt-6">
        {tab === 'overview' && (
          <OverviewPanel
            project={project}
            canEdit={canEdit}
            onSelectTab={setTab}
            onUpload={() => setUploadOpen(true)}
            onInspect={(photo) => setLightboxPhoto(photo)}
          />
        )}
        {tab === 'program' && (
          <ProjectAreaProgram
            project={project}
            editable={canEdit}
            onSave={(patch) => updateProject(project.id, patch)}
          />
        )}
        {tab === 'progress' && <StageProgressPanel project={project} editable={canEdit} onSave={saveProgress} />}
        {tab === 'timeline' && (
          <StageTimelinePanel
            project={project}
            editable={canEdit}
            canTag={canTag}
            onSave={(index, patch) => updatePhase(project.id, index, patch)}
            onAdd={(phase) => addPhase(project.id, phase)}
            onRemove={(index) => removePhase(project.id, index)}
            onMove={(index, direction) => movePhase(project.id, index, direction)}
          />
        )}
        {tab === 'milestones' && (
          <StageMilestonesPanel
            project={project}
            editable={canEdit}
            canTag={canTag}
            onAdd={(milestone) => addMilestone(project.id, milestone)}
          />
        )}
        {tab === 'photos' && (
          <StagePhotosPanel
            project={project}
            editable={canEdit}
            onUpload={() => setUploadOpen(true)}
            onDelete={async (photoId) => {
              const ok = await deletePhoto(project.id, photoId);
              if (ok) {
                toast({
                  title: 'Photograph deleted',
                  description: 'The site photograph was permanently removed from the server.',
                });
              } else {
                toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete photograph.' });
              }
            }}
            onInspect={(photo) => setLightboxPhoto(photo)}
          />
        )}
        {tab === 'commercial' && (
          <CommercialPanel project={project} editable={canEdit} onSave={(patch) => updateProject(project.id, patch)} />
        )}
        {tab === 'issues' && (
          <StageIssuesPanel
            project={project}
            editable={canEdit}
            canTag={canTag}
            onAdd={(issue) => addIssue(project.id, issue)}
            onUpdate={(index, patch) => updateIssue(project.id, index, patch)}
          />
        )}
        {tab === 'updates' && (
          <StageUpdatesPanel project={project} editable={canEdit} onAdd={(update) => addUpdate(project.id, update)} />
        )}
      </div>

      <EmailHubModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        defaultTab="send"
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-700">
                <Trash2 size={20} />
              </span>
              <h3 className="text-[17px] font-bold text-foreground">Delete Project</h3>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Are you sure you want to permanently delete{' '}
              <strong className="font-semibold text-foreground">"{project.name}"</strong>? This will permanently remove
              all associated stages, milestones, issues, and progress updates from the database.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const success = await deleteProject(project.id);
                    if (success) {
                      toast({
                        title: 'Project deleted',
                        description: `"${project.name}" has been permanently removed.`,
                      });
                      setLocation('/');
                    } else {
                      toast({
                        variant: 'destructive',
                        title: 'Delete failed',
                        description: 'Could not delete project from database.',
                      });
                      setIsDeleting(false);
                    }
                  } catch (err: any) {
                    toast({
                      variant: 'destructive',
                      title: 'Delete failed',
                      description: err.message || 'An error occurred.',
                    });
                    setIsDeleting(false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[11px] font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <PhotoUploadDialog
          projectId={project.id}
          projectName={project.name}
          stages={project.phases}
          existingPhotoUrl={project.photos?.[0]?.url}
          onClose={() => setUploadOpen(false)}
          onUploadBatch={async (photos) => {
            try {
              await addMultiplePhotos(project.id, photos);
              toast({
                title: `${photos.length} photograph${photos.length > 1 ? 's' : ''} uploaded`,
                description: 'Successfully added to project site gallery.',
              });
            } catch (err: any) {
              toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: err?.message || 'Failed to upload photographs.',
              });
              throw err;
            }
          }}
          onUpload={async (data) => {
            try {
              await addPhoto(project.id, data);
              toast({
                title: 'Site photograph added',
                description: 'New photograph uploaded to project site gallery.',
              });
            } catch (err: any) {
              toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: err?.message || 'Failed to upload photograph.',
              });
              throw err;
            }
          }}
        />
      )}

      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          photos={project.photos || []}
          projectName={project.name}
          projectCode={project.code}
          canDelete={canEdit}
          onClose={() => setLightboxPhoto(null)}
          onDelete={async (photoId) => {
            const ok = await deletePhoto(project.id, photoId);
            if (ok) {
              toast({ title: 'Photograph deleted', description: 'The site photograph was permanently removed.' });
            }
          }}
        />
      )}
    </div>
  );
}

function EditProjectForm({
  project,
  onCancel,
  onSave,
}: {
  project: Project;
  onCancel: () => void;
  onSave: (patch: Partial<Project>) => void;
}) {
  const { leads, role } = useAppState();
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code || '');
  const [location, setLocation] = useState<Location>(project.location);
  const [category, setCategory] = useState<Category>(project.category);
  const [status, setStatus] = useState<ProjectStatus>(project.status || 'Yet to start');
  const [health, setHealth] = useState<Health>(project.health);
  const [leadId, setLeadId] = useState(project.leadId);
  const [startDate, setStartDate] = useState(project.startDate || '');
  const [targetDate, setTargetDate] = useState(project.targetDate);
  const [nextMilestone, setNextMilestone] = useState(project.nextMilestone || '');
  const [nextMilestoneDate, setNextMilestoneDate] = useState(project.nextMilestoneDate || '');
  const [area, setArea] = useState(project.area || project.specification?.area || '');
  const [paxKeys, setPaxKeys] = useState(project.paxKeys || project.specification?.capacity || '');
  const [terminal, setTerminal] = useState(project.specification?.terminal || '');
  const [floor, setFloor] = useState(project.specification?.floor || '');
  const [scope, setScope] = useState(project.specification?.scope || '');
  const [aop, setAop] = useState(String((project.aop || 0) / CRORE));
  const [awarded, setAwarded] = useState(String((project.awarded || 0) / CRORE));
  const [spent, setSpent] = useState(String((project.spent || 0) / CRORE));
  const [projectedCost, setProjectedCost] = useState(String(((project.projectedCost ?? project.aop) || 0) / CRORE));
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Project name cannot be empty.');
      return;
    }
    if (!isValidIsoDate(targetDate)) {
      setError('Enter a valid target completion date.');
      return;
    }
    setError('');

    const parsedAop = !isNaN(Number(aop)) && Number(aop) >= 0 ? Number(aop) * CRORE : project.aop;
    const parsedAwarded = !isNaN(Number(awarded)) && Number(awarded) >= 0 ? Number(awarded) * CRORE : project.awarded;
    const parsedSpent = !isNaN(Number(spent)) && Number(spent) >= 0 ? Number(spent) * CRORE : project.spent;
    const parsedProjected =
      !isNaN(Number(projectedCost)) && Number(projectedCost) >= 0 ? Number(projectedCost) * CRORE : parsedAop;

    onSave({
      name: name.trim(),
      code: code.trim() || project.code,
      location,
      category,
      status,
      health,
      leadId: role === 'coordinator' ? leadId : project.leadId,
      startDate: startDate || undefined,
      targetDate,
      targetLabel: formatFullDate(targetDate),
      nextMilestone: nextMilestone.trim() || project.nextMilestone,
      nextMilestoneDate: nextMilestoneDate || project.nextMilestoneDate,
      area: area.trim(),
      paxKeys: paxKeys.trim(),
      aop: parsedAop,
      awarded: parsedAwarded,
      spent: parsedSpent,
      projectedCost: parsedProjected,
      specification: {
        projectType: project.specification?.projectType ?? category,
        area: area.trim(),
        capacity: paxKeys.trim(),
        units: project.specification?.units ?? '',
        terminal: terminal.trim() || location,
        floor: floor.trim(),
        scope: scope.trim(),
        customFields: project.specification?.customFields,
        areaProgram: project.specification?.areaProgram,
        areaSheet: project.specification?.areaSheet,
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 rounded-2xl border border-[#eadcb1] bg-[#fff8e9] p-5 md:p-6 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-[#eadcb1]/70 pb-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[#9a711f]">
            {role === 'coordinator' ? 'Project coordinator controls' : 'Project lead controls'}
          </p>
          <h2 className="mt-0.5 text-[16px] font-extrabold text-[#173e49]">Edit project information</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {/* Section 1: Core Details */}
      <div className="mt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          1. Core Information
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-[10px] font-bold">Project name *</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Project Code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. DEL-T3-L01"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Project status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-bold text-[#173e49]"
            >
              {projectStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Location</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as Location)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Health status</span>
            <select
              value={health}
              onChange={(event) => setHealth(event.target.value as Health)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            >
              {(Object.keys(healthStyles) as Health[]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {role === 'coordinator' && leads.length > 0 && (
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-[#664b14]">Allotted Project Lead</span>
              <select
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                className="h-9 w-full rounded-lg border border-[#d6a95d] bg-white px-3 text-[11px] font-bold text-[#173e49]"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.title})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Section 2: Timeline & Milestones */}
      <div className="mt-5 border-t border-[#eadcb1]/70 pt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          2. Timeline & Next Milestone
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Target Completion Date *</span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Next Key Milestone</span>
            <input
              value={nextMilestone}
              onChange={(event) => setNextMilestone(event.target.value)}
              placeholder="e.g. MEP rough-in sign-off"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Milestone Target Date</span>
            <input
              type="date"
              value={nextMilestoneDate}
              onChange={(event) => setNextMilestoneDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
        </div>
      </div>

      {/* Section 3: Physical Specifications & Scope */}
      <div className="mt-5 border-t border-[#eadcb1]/70 pt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          3. Physical Space & Specifications
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Area</span>
            <input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder="e.g. 24,000 sqft"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Pax / Keys</span>
            <input
              value={paxKeys}
              onChange={(event) => setPaxKeys(event.target.value)}
              placeholder="e.g. 180 Pax / 45 Keys"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Terminal / Airport</span>
            <input
              value={terminal}
              onChange={(event) => setTerminal(event.target.value)}
              placeholder="e.g. T3 Departure"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Floor Level</span>
            <input
              value={floor}
              onChange={(event) => setFloor(event.target.value)}
              placeholder="e.g. Level 2 (Mezzanine)"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label className="md:col-span-4">
            <span className="mb-1.5 block text-[10px] font-bold">Scope of Work</span>
            <textarea
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              rows={2}
              placeholder="Detailed description of works, MEP coordination, finishes, and handover deliverables..."
              className="w-full rounded-lg border border-border bg-white p-2.5 text-[11px] outline-none"
            />
          </label>
        </div>
      </div>

      {/* Section 4: Commercial Figures */}
      <div className="mt-5 border-t border-[#eadcb1]/70 pt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          4. Commercial Capital Position (₹ in Crores)
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Approved Budget (AOP)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={aop}
              onChange={(event) => setAop(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Committed / Awarded</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={awarded}
              onChange={(event) => setAwarded(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Spent Till Date</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={spent}
              onChange={(event) => setSpent(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Projected Final Cost</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={projectedCost}
              onChange={(event) => setProjectedCost(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fae5e1] px-3 py-2 text-[11px] font-semibold text-[#b2473d]">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2 border-t border-[#eadcb1]/70 pt-3">
        <button
          type="submit"
          className="rounded-lg bg-[#173e49] px-5 py-2.5 text-[10px] font-bold text-white shadow-xs hover:bg-[#205160] transition"
        >
          Save project
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-[10px] font-bold hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function OverviewPanel({
  project,
  canEdit = false,
  onSelectTab,
  onUpload,
  onInspect,
}: {
  project: Project;
  canEdit?: boolean;
  onSelectTab?: (tab: Tab) => void;
  onUpload?: () => void;
  onInspect?: (photo: SitePhoto) => void;
}) {
  const health = healthStyles[project.health];
  const spec = project.specification;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
      <div className="space-y-5">
        <DetailCard title="Project information" eyebrow="Overview" icon={FileText}>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info label="Project name" value={project.name} />
            <Info label="Location" value={project.location} />
            <Info label="Project status" value={project.status || 'Yet to start'} />
            <Info label="Category" value={project.category} />
            <Info label="Project lead" value={leadName(project.leadId)} />
            <Info label="Project type" value={spec?.projectType ?? project.category} />
            <Info label="Start date" value={project.startDate ?? '—'} />
            <Info label="Target completion" value={project.targetLabel} />
            <Info label="Area" value={project.area || spec?.area || '—'} />
            <Info label="Pax / Keys" value={project.paxKeys || spec?.capacity || '—'} />
            <Info label="Completion %" value={`${project.progress}%`} />
          </div>
          {spec?.customFields?.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {spec.customFields
                .filter((field) => field.value)
                .map((field) => (
                  <Info key={field.label} label={field.label} value={field.value} />
                ))}
            </div>
          ) : null}
          {spec?.scope && (
            <p className="mt-5 rounded-xl bg-[#f7f4ec] p-4 text-[11px] leading-5 text-muted-foreground">{spec.scope}</p>
          )}
        </DetailCard>
        {(spec?.areaProgram || project.category === 'Hotel') && (
          <DetailCard title="Architectural Area Program" eyebrow="Space Allocation" icon={Building2}>
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Plot Area
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.summary.plotAreaSqm?.toLocaleString() ?? '8,160'} SQ.M.
                  </span>
                  <span className="font-mono text-[10px] text-[#2e7c67]">
                    {spec?.areaProgram?.summary.plotAreaAcres ?? 2} Acres
                  </span>
                </div>
                <div className="rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9a711f]">Total BUA</span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.summary.builtUpAreaSqm?.toLocaleString() ?? '14,970'} SQ.M.
                  </span>
                  <span className="font-mono text-[10px] text-[#9a711f]">
                    {spec?.areaProgram?.summary.builtUpAreaSqft?.toLocaleString() ?? '161,137'} SQ.FT.
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Inventory
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.summary.totalRoomKeys ?? 156} Keys
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {spec?.areaProgram?.summary.totalBays ?? 168} Bays
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    FOH Total
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.fohAreas?.grandSubtotal?.areaSqm?.toLocaleString() ?? '2,557'} SQ.M.
                  </span>
                  <span className="font-mono text-[10px] text-[#2e7c67]">Ground + 2nd Flr</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Stack:{' '}
                  {spec?.areaProgram?.summary.numberOfFloorsDescription ?? 'B + G + 1 + Service + 2nd to 6th Floor'}
                </span>
                {onSelectTab && (
                  <button
                    type="button"
                    onClick={() => onSelectTab('program')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#173e49] hover:text-[#2e7c67] transition"
                  >
                    View Full Space Breakdown &rarr;
                  </button>
                )}
              </div>
            </div>
          </DetailCard>
        )}
        {(spec?.areaSheet || (project.area && project.category !== 'Hotel')) && (
          <DetailCard title="Project Area Sheet Record" eyebrow="Official Master Area Register" icon={FileSpreadsheet}>
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Sheet Entry
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    #{spec?.areaSheet?.slNo ?? '—'}
                  </span>
                  <span className="font-mono text-[10px] text-[#2e7c67]">
                    {spec?.areaSheet?.section ?? (project.category === 'Lounge' ? 'LOUNGES' : 'OFFICE, KITCHEN & MISC')}
                  </span>
                </div>
                <div className="rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9a711f]">
                    Area (SQ.FT.)
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaSheet?.areaSqft
                      ? `${spec.areaSheet.areaSqft.toLocaleString()} SQ.FT.`
                      : project.area || '—'}
                  </span>
                  <span className="font-mono text-[10px] text-[#9a711f]">
                    {spec?.areaSheet?.areaSqm ? `${spec.areaSheet.areaSqm.toLocaleString()} SQ.M.` : ''}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Airport Terminal
                  </span>
                  <span className="mt-1 block text-[14px] font-extrabold text-[#173e49]">{project.location}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{spec?.floor || 'Terminal Core'}</span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Sheet Status
                  </span>
                  <span className="mt-1 block text-[12px] font-extrabold text-[#2e7c67]">
                    {spec?.areaSheet?.status || project.status || 'Operational'}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">Source: Master Sheet</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Facility Name: <strong>{project.name}</strong> ({project.code})
                </span>
                <Link
                  href="/area-sheet"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#173e49] hover:text-[#2e7c67] transition"
                >
                  View in Master Area Sheet &rarr;
                </Link>
              </div>
            </div>
          </DetailCard>
        )}
        <DetailCard title="Phase progress" eyebrow="Delivery path" icon={ClipboardCheck}>
          <div className="mt-5 grid gap-6 md:grid-cols-[140px_1fr] md:items-center">
            <div className="flex flex-col items-center gap-3">
              <ProgressRing progress={project.progress} />
              <span className="text-center text-[10px] leading-4 text-muted-foreground">
                Planned opening
                <br />
                <strong className="text-foreground">{project.targetLabel}</strong>
              </span>
            </div>
            <PhaseList project={project} />
          </div>
        </DetailCard>
      </div>
      <div className="space-y-5">
        <DetailCard title="Project health" eyebrow="Portfolio signal" icon={ShieldAlert} tone="gold">
          <div className="mt-6 space-y-3">
            <HealthRow label="Schedule" value={project.health} tone={health} />
            <HealthRow label="Current stage" value={activePhaseLabel(project)} tone={healthStyles[project.health]} />
            <HealthRow label="Open issues" value={openIssueLabel(project)} tone={openIssueTone(project)} />
            <HealthRow label="Budget" value={budgetLabel(project)} tone={budgetTone(project)} />
          </div>
        </DetailCard>

        {/* Current Site Photograph Widget */}
        <DetailCard title="Current Site Photograph" eyebrow="Visual Verification" icon={Camera}>
          {(() => {
            const currentPhoto = project.photos && project.photos.length > 0 ? project.photos[0] : null;
            if (currentPhoto) {
              return (
                <div className="mt-5 space-y-3">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Open the current site photograph"
                    onClick={() => onInspect?.(currentPhoto)}
                    onKeyDown={activateOnKey(() => onInspect?.(currentPhoto))}
                    className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black/5 cursor-pointer shadow-sm"
                  >
                    <img
                      src={currentPhoto.url}
                      alt={currentPhoto.caption}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-85 group-hover:opacity-100 transition" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {currentPhoto.category && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#3d9a7e] text-white">
                            {currentPhoto.category}
                          </span>
                        )}
                        {currentPhoto.stage && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/20 text-white backdrop-blur-sm">
                            {currentPhoto.stage}
                          </span>
                        )}
                        {project.photos && project.photos.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#173e49]/80 text-white backdrop-blur-sm border border-white/20">
                            +{project.photos.length - 1} more in gallery
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-medium leading-snug line-clamp-2">{currentPhoto.caption}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      Captured:{' '}
                      <strong className="text-foreground">
                        {currentPhoto.takenDate ? formatFullDate(currentPhoto.takenDate) : 'Recently'}
                      </strong>
                    </span>
                    {onSelectTab && (
                      <button
                        type="button"
                        onClick={() => onSelectTab('photos')}
                        className="font-bold text-[#9a711f] hover:underline"
                      >
                        {project.photos && project.photos.length > 1
                          ? `View all ${project.photos.length} photos →`
                          : 'View full photo →'}
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
                <Camera size={24} className="mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-[12px] font-bold text-foreground">No site photograph uploaded</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Upload a physical progress photograph to provide visual verification for stakeholders.
                </p>
                {canEdit && onUpload && (
                  <button
                    type="button"
                    onClick={onUpload}
                    className="mt-4 rounded-xl bg-[#173e49] px-3.5 py-2 text-[10px] font-extrabold text-white hover:bg-[#205160] transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload size={12} />
                    Upload site photograph
                  </button>
                )}
              </div>
            );
          })()}
        </DetailCard>

        <DetailCard title="Key issue" eyebrow="Decision radar" icon={AlertTriangle} tone="gold">
          {project.issues[0] ? (
            (() => {
              const keyIssueTheme = getIssueStatusTheme(project.issues[0].status, project.issues[0].severity);
              return (
                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: keyIssueTheme.dotColor }}
                    />
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${keyIssueTheme.badgeClass}`}
                    >
                      {project.issues[0].status ?? 'Open'}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                      {project.issues[0].severity} priority · {project.issues[0].category ?? 'Other'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[14px] font-extrabold">{project.issues[0].title}</h3>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{project.issues[0].detail}</p>
                  <p className="mt-4 font-mono text-[9px] uppercase tracking-[.1em] text-[#9a711f]">
                    Owner · {project.issues[0].owner}
                  </p>
                </div>
              );
            })()
          ) : (
            <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
              No active issues. The next decision point is {project.nextMilestone}.
            </p>
          )}
        </DetailCard>
      </div>
    </div>
  );
}

function CommercialPanel({
  project,
  editable,
  onSave,
}: {
  project: Project;
  editable: boolean;
  onSave: (patch: Partial<Project>) => void;
}) {
  const commercial = getCommercialSummary(project);
  const awardRateLabel = formatRatio(commercial.awardRatePct, 0);
  const spentRateLabel = formatRatio(commercial.spentRatePct, 0);
  const awardRateWidth = commercial.awardRatePct ?? 0;
  const spentRateWidth = commercial.spentRatePct ?? 0;
  const [editing, setEditing] = useState(false);
  const [aop, setAop] = useState(String(project.aop / CRORE));
  const [awarded, setAwarded] = useState(String(project.awarded / CRORE));
  const [spent, setSpent] = useState(String(project.spent / CRORE));
  const [projectedCost, setProjectedCost] = useState(String((project.projectedCost ?? project.aop) / CRORE));
  const [commercialError, setCommercialError] = useState('');

  // Phase Budgets editing state
  const [editingPhaseBudgets, setEditingPhaseBudgets] = useState(false);
  const [phaseBudgetsDraft, setPhaseBudgetsDraft] = useState<Record<number, string>>({});

  const startEditingPhaseBudgets = () => {
    const draft: Record<number, string> = {};
    const totalAwardedCr = project.awarded / CRORE;
    const numPhases = Math.max(1, project.phases.length);

    project.phases.forEach((phase, idx) => {
      if (phase.budget != null) {
        draft[idx] = (phase.budget / CRORE).toString();
      } else {
        const legacyAmounts = [0.12, 0.24, 0.31, 0.33];
        const defaultAmt =
          idx < legacyAmounts.length && numPhases === 4
            ? (totalAwardedCr * legacyAmounts[idx]).toFixed(2)
            : (totalAwardedCr / numPhases).toFixed(2);
        draft[idx] = defaultAmt;
      }
    });
    setPhaseBudgetsDraft(draft);
    setEditingPhaseBudgets(true);
  };

  const distributeEvenly = () => {
    const totalAwardedCr = project.awarded / CRORE;
    const numPhases = Math.max(1, project.phases.length);
    const splitVal = (totalAwardedCr / numPhases).toFixed(2);
    const draft: Record<number, string> = {};
    project.phases.forEach((_, idx) => {
      draft[idx] = splitVal;
    });
    setPhaseBudgetsDraft(draft);
  };

  const distributeByWeight = () => {
    const totalAwardedCr = project.awarded / CRORE;
    const weights = project.phases.map((p) => (typeof p.weight === 'number' && p.weight > 0 ? p.weight : 1));
    const sumWeights = weights.reduce((sum, w) => sum + w, 0) || 1;
    const draft: Record<number, string> = {};
    project.phases.forEach((_, idx) => {
      const share = (weights[idx] / sumWeights) * totalAwardedCr;
      draft[idx] = share.toFixed(2);
    });
    setPhaseBudgetsDraft(draft);
  };

  const sumDraftPhaseBudgets = useMemo(() => {
    let sum = 0;
    Object.values(phaseBudgetsDraft).forEach((val) => {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) sum += num;
    });
    return sum;
  }, [phaseBudgetsDraft]);

  const handleSavePhaseBudgets = (e: FormEvent) => {
    e.preventDefault();
    const updatedPhases: Phase[] = project.phases.map((phase, idx) => {
      const val = phaseBudgetsDraft[idx];
      const parsedNum = Number(val);
      return {
        ...phase,
        budget: !isNaN(parsedNum) && parsedNum >= 0 ? parsedNum * CRORE : phase.budget,
      };
    });

    onSave({ phases: updatedPhases });
    setEditingPhaseBudgets(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <DetailCard title="Capital position & commercial metrics" eyebrow="Commercial summary" icon={CircleDollarSign}>
        <div className="mt-7 space-y-5">
          <div>
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Committed / Awarded against Approved Budget (AOP)</span>
              <span className={commercial.overAwarded ? 'text-[#b2473d] font-bold' : ''}>
                {awardRateLabel}
                {commercial.overAwarded && ' ⚠️ (Over AOP)'}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7e7dc]">
              <div
                className={`h-full rounded-full transition-all ${
                  commercial.overAwarded ? 'bg-[#d66254]' : 'bg-[#d19b35]'
                }`}
                style={{ width: `${Math.min(100, awardRateWidth)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] font-semibold">
              <span>Spend till date against Committed / Awarded</span>
              <span className={commercial.overSpent ? 'text-[#b2473d] font-bold' : ''}>
                {spentRateLabel}
                {commercial.overSpent && ' ⚠️ (Over Awarded)'}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7e7dc]">
              <div
                className={`h-full rounded-full transition-all ${
                  commercial.overSpent ? 'bg-[#d66254]' : 'bg-[#3d9a7e]'
                }`}
                style={{ width: `${Math.min(100, spentRateWidth)}%` }}
              />
            </div>
          </div>

          {/* Commercial Overrun Warning Banner */}
          {(commercial.overBudget || commercial.overAwarded || commercial.overSpent) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#f0c8c2] bg-[#fae5e1] p-3 text-[11px] text-[#b2473d]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <strong className="font-bold">Commercial Overrun Alert:</strong>
                {commercial.overBudget && (
                  <p>
                    Projected final cost ({formatCrore(commercial.projectedCost)}) exceeds Approved Budget AOP (
                    {formatCrore(commercial.aop)}) by <strong>+{formatCrore(commercial.costVariance)}</strong>.
                  </p>
                )}
                {commercial.overAwarded && (
                  <p>
                    Committed awarded contracts ({formatCrore(commercial.awarded)}) exceed Approved Budget AOP (
                    {formatCrore(commercial.aop)}) by{' '}
                    <strong>+{formatCrore(commercial.awarded - commercial.aop)}</strong>.
                  </p>
                )}
                {commercial.overSpent && (
                  <p>
                    Actual spend ({formatCrore(commercial.spent)}) exceeds committed value (
                    {formatCrore(commercial.awarded)}) by{' '}
                    <strong>+{formatCrore(commercial.spent - commercial.awarded)}</strong>.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Info label="Approved Budget (AOP)" value={formatCrore(project.aop)} />
            <Info
              label="Committed / Awarded"
              value={formatCrore(project.awarded)}
              tone={commercial.overAwarded ? 'danger' : 'default'}
            />
            <Info
              label="Projected Cost"
              value={formatCrore(commercial.projectedCost)}
              tone={commercial.overBudget ? 'danger' : 'default'}
            />
            <Info
              label="Spent Till Date"
              value={formatCrore(project.spent)}
              tone={commercial.overSpent ? 'danger' : 'default'}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Info
              label="Balance Remaining"
              value={formatCrore(commercial.remaining)}
              tone={commercial.remaining < 0 ? 'danger' : 'success'}
            />
            <Info
              label="Cost Variance (Projected - AOP)"
              value={`${commercial.costVariance > 0 ? '+' : ''}${formatCrore(commercial.costVariance)}`}
              tone={commercial.costVariance > 0 ? 'danger' : 'success'}
            />
          </div>

          {editable &&
            (editing ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = parseCroreFields({ aop, awarded, spent, projectedCost });
                  if (!next) {
                    setCommercialError('Enter AOP, awarded, spent, and projected cost as numbers of 0 or more.');
                    return;
                  }
                  setCommercialError('');
                  onSave(next);
                  setEditing(false);
                }}
                className="space-y-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4"
              >
                <p className="text-[11px] font-extrabold">Edit commercial values (in ₹ Cr)</p>
                {commercialError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-[#fae5e1] px-3 py-2 text-[10px] font-semibold text-[#b2473d]"
                  >
                    {commercialError}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-4">
                  <label>
                    <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                      Approved AOP
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={aop}
                      onChange={(event) => setAop(event.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                      Committed Cost
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={awarded}
                      onChange={(event) => setAwarded(event.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                      Projected Cost
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={projectedCost}
                      onChange={(event) => setProjectedCost(event.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">
                      Spent Till Date
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={spent}
                      onChange={(event) => setSpent(event.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-[#173e49] px-3 py-2 text-[10px] font-bold text-white">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-border px-3 py-2 text-[10px] font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-xl border border-[#eadcb1] bg-[#fff8e9] px-3 py-2 text-[10px] font-bold text-[#9a711f]"
              >
                Edit commercial data
              </button>
            ))}
        </div>
      </DetailCard>

      <DetailCard
        title="Budget by phase"
        eyebrow="Indicative cost line"
        icon={ReceiptText}
        action={
          editable &&
          !editingPhaseBudgets && (
            <button
              type="button"
              onClick={startEditingPhaseBudgets}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadcb1] bg-[#fff8e9] px-2.5 py-1 text-[10px] font-bold text-[#9a711f] hover:bg-[#faeed5] transition shadow-xs"
            >
              <Pencil size={11} />
              <span>Edit phase budgets</span>
            </button>
          )
        }
      >
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <p>Indicative split of committed value across stages.</p>
            <span className="font-mono font-bold text-[#173e49]">Total Awarded: {formatCrore(project.awarded)}</span>
          </div>

          {(() => {
            const sumAllocated = project.phases.reduce((sum, p) => sum + (p.budget != null ? p.budget : 0), 0);
            const isOverAllocated = project.awarded > 0 && sumAllocated > project.awarded;
            if (isOverAllocated) {
              return (
                <div className="flex items-center gap-2 rounded-lg border border-[#f0c8c2] bg-[#fae5e1] p-2.5 text-[10px] font-semibold text-[#b2473d]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>
                    Warning: Total stage allocations ({formatCrore(sumAllocated)}) exceed committed value (
                    {formatCrore(project.awarded)}) by +{formatCrore(sumAllocated - project.awarded)}.
                  </span>
                </div>
              );
            }
            return null;
          })()}

          {editingPhaseBudgets ? (
            <form
              onSubmit={handleSavePhaseBudgets}
              className="space-y-4 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eadcb1]/70 pb-3">
                <div>
                  <span className="text-[11px] font-extrabold text-[#173e49]">Stage Budgets (in ₹ Cr)</span>
                  <div className="mt-1 flex items-center gap-3 text-[10px]">
                    <span className="text-muted-foreground">
                      Allocated: <strong className="text-[#173e49]">₹{sumDraftPhaseBudgets.toFixed(2)} Cr</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Difference:{' '}
                      <strong
                        className={
                          Math.abs(project.awarded / CRORE - sumDraftPhaseBudgets) < 0.01
                            ? 'text-[#2e7c67]'
                            : project.awarded / CRORE < sumDraftPhaseBudgets
                              ? 'text-[#b2473d]'
                              : 'text-[#9a711f]'
                        }
                      >
                        ₹{(project.awarded / CRORE - sumDraftPhaseBudgets).toFixed(2)} Cr
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={distributeEvenly}
                    className="rounded-md border border-[#cbe4d9] bg-white px-2 py-1 text-[9px] font-bold text-[#2e7c67] hover:bg-[#edf5f0]"
                  >
                    Even Split
                  </button>
                  <button
                    type="button"
                    onClick={distributeByWeight}
                    className="rounded-md border border-[#cbe4d9] bg-white px-2 py-1 text-[9px] font-bold text-[#2e7c67] hover:bg-[#edf5f0]"
                  >
                    Split by Weight
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {project.phases.map((phase, index) => {
                  const val = phaseBudgetsDraft[index] ?? '';
                  const numVal = Number(val);
                  const pct =
                    project.awarded > 0 && !isNaN(numVal) ? Math.round((numVal / (project.awarded / CRORE)) * 100) : 0;

                  return (
                    <div
                      key={`${phase.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white p-2.5 border border-border/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[11px] text-[#173e49] truncate">{phase.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">({phase.progress}% done)</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e7e7dc]">
                          <div
                            className="h-full rounded-full bg-[#3d9a7e]"
                            style={{ width: `${Math.max(phase.progress, 5)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={val}
                            onChange={(e) => setPhaseBudgetsDraft((prev) => ({ ...prev, [index]: e.target.value }))}
                            className="h-8 w-24 rounded-lg border border-border bg-[#faf8f3] pl-6 pr-2 text-right text-[11px] font-mono font-bold text-[#173e49] focus:bg-white focus:border-[#2e7c67] outline-none"
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-[#eadcb1]/70 pt-2.5">
                <span className="text-[10px] text-muted-foreground">Saved directly to stage allocations.</span>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-[#173e49] px-3.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#205160] transition"
                  >
                    Save stage budgets
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPhaseBudgets(false)}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-[10px] font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {project.phases.map((phase, index) => {
                const numPhases = Math.max(1, project.phases.length);
                const legacyAmounts = [0.12, 0.24, 0.31, 0.33];
                const phaseBudget =
                  phase.budget != null
                    ? phase.budget
                    : index < legacyAmounts.length && numPhases === 4
                      ? project.awarded * legacyAmounts[index]
                      : project.awarded / numPhases;
                const isExplicit = phase.budget != null;

                return (
                  <div key={`${phase.name}-${index}`} className="group">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#173e49]">{phase.name}</span>
                        {isExplicit ? (
                          <span className="rounded-sm bg-[#edf5f0] px-1 text-[8px] font-bold text-[#2e7c67] uppercase tracking-wider">
                            Allocated
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground font-normal">(Indicative split)</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[#173e49]">{formatCrore(phaseBudget)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e7e7dc]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          index % 2 === 1 ? 'bg-[#d19b35]' : 'bg-[#3d9a7e]'
                        }`}
                        style={{ width: `${Math.max(phase.progress, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );
}

function Info({
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

function HealthRow({ label, value, tone }: { label: string; value: string; tone: { dot: string; text: string } }) {
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

function activePhaseLabel(project: Project) {
  return project.phases.find((phase) => phase.status === 'active')?.name ?? 'Not started';
}

/** Converts the crore-denominated inputs, rejecting blank or negative values. */
function parseCroreFields(fields: {
  aop: string;
  awarded: string;
  spent: string;
  projectedCost?: string;
}): Partial<Project> | null {
  const aop = Number(fields.aop);
  const awarded = Number(fields.awarded);
  const spent = Number(fields.spent);
  const projectedCost =
    fields.projectedCost !== undefined && fields.projectedCost !== '' ? Number(fields.projectedCost) : aop;
  const values = [aop, awarded, spent, projectedCost];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  return { aop: aop * CRORE, awarded: awarded * CRORE, spent: spent * CRORE, projectedCost: projectedCost * CRORE };
}

function openIssueLabel(project: Project): string {
  const open = project.issues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
  if (open.length === 0) return 'None open';
  const high = open.filter((issue) => issue.severity === 'High').length;
  return high ? `${open.length} open · ${high} high` : `${open.length} open`;
}

function openIssueTone(project: Project) {
  const open = project.issues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
  if (open.length === 0) return healthStyles['On track'];
  return open.some((issue) => issue.severity === 'High') ? healthStyles.Delayed : healthStyles['At risk'];
}

/** Budget signal derived from spend against the awarded value. */
function budgetLabel(project: Project): string {
  // Reuses the same spentRatePct as CommercialPanel/CommercialView — one
  // definition of "spend against awarded", not a third copy of the ratio.
  const { spentRatePct } = getCommercialSummary(project);
  if (spentRatePct === null) return 'Not awarded';
  if (spentRatePct > 100) return 'Over awarded value';
  if (spentRatePct > 90) return 'Near awarded value';
  return 'Within awarded value';
}

function budgetTone(project: Project) {
  const { spentRatePct } = getCommercialSummary(project);
  if (spentRatePct === null) return healthStyles['Not started'];
  if (spentRatePct > 100) return healthStyles.Delayed;
  if (spentRatePct > 90) return healthStyles['At risk'];
  return healthStyles['On track'];
}
