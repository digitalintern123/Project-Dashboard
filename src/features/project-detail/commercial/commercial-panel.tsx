import { type Project } from '@/data/projects';
import { CommercialSummaryCard } from './commercial-summary-card';
import { PhaseBudgetCard } from './phase-budget-card';
import { useCommercialEdit } from './use-commercial-edit';
import { usePhaseBudgetDraft } from './use-phase-budget-draft';

export function CommercialPanel({
  project,
  editable,
  onSave,
}: {
  project: Project;
  editable: boolean;
  onSave: (patch: Partial<Project>) => void;
}) {
  const edit = useCommercialEdit(project, onSave);
  const budgets = usePhaseBudgetDraft(project, onSave);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <CommercialSummaryCard project={project} editable={editable} edit={edit} />

      <PhaseBudgetCard project={project} editable={editable} budgets={budgets} />
    </div>
  );
}
