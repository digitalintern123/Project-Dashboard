import { CRORE, type Project } from '@/data/projects';
import { type PhaseBudgetDraft } from './use-phase-budget-draft';

export function PhaseBudgetForm({ project, budgets }: { project: Project; budgets: PhaseBudgetDraft }) {
  const {
    setEditingPhaseBudgets,
    phaseBudgetsDraft,
    setPhaseBudgetsDraft,
    distributeEvenly,
    distributeByWeight,
    sumDraftPhaseBudgets,
    handleSavePhaseBudgets,
  } = budgets;
  return (
    <form onSubmit={handleSavePhaseBudgets} className="space-y-4 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4">
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
  );
}
