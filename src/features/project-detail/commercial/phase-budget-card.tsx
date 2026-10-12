import { AlertCircle, Pencil, ReceiptText } from 'lucide-react';
import { formatCrore, type Project } from '@/data/projects';
import { DetailCard } from '../ui';
import { PhaseBudgetForm } from './phase-budget-form';
import { type PhaseBudgetDraft } from './use-phase-budget-draft';

export function PhaseBudgetCard({
  project,
  editable,
  budgets,
}: {
  project: Project;
  editable: boolean;
  budgets: PhaseBudgetDraft;
}) {
  const { editingPhaseBudgets, startEditingPhaseBudgets } = budgets;
  return (
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
          <PhaseBudgetForm project={project} budgets={budgets} />
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
  );
}
