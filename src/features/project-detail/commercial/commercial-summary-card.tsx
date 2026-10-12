import { AlertCircle, CircleDollarSign } from 'lucide-react';
import { formatCrore, type Project } from '@/data/projects';
import { getCommercialSummary, formatRatio } from '@/lib/calculations';
import { DetailCard, Info } from '../ui';
import { CommercialEditForm } from './commercial-edit-form';
import { type CommercialEdit } from './use-commercial-edit';

export function CommercialSummaryCard({
  project,
  editable,
  edit,
}: {
  project: Project;
  editable: boolean;
  edit: CommercialEdit;
}) {
  const commercial = getCommercialSummary(project);
  const awardRateLabel = formatRatio(commercial.awardRatePct, 0);
  const spentRateLabel = formatRatio(commercial.spentRatePct, 0);
  const awardRateWidth = commercial.awardRatePct ?? 0;
  const spentRateWidth = commercial.spentRatePct ?? 0;
  const { editing, setEditing } = edit;
  return (
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
              className={`h-full rounded-full transition-all ${commercial.overSpent ? 'bg-[#d66254]' : 'bg-[#3d9a7e]'}`}
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
                  {formatCrore(commercial.aop)}) by <strong>+{formatCrore(commercial.awarded - commercial.aop)}</strong>
                  .
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
            <CommercialEditForm edit={edit} />
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
  );
}
