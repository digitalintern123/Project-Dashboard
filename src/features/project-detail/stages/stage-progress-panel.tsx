import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { formatShortDate, type Project } from '@/data/projects';
import { getProgressVariance, calculateWeightedProgress } from '@/lib/calculations';
import { ProgressRing, DetailCard } from '../ui';

export function StageProgressPanel({
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
