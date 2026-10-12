import { useState, useMemo, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { CRORE, type Phase, type Project } from '@/data/projects';

export interface PhaseBudgetDraft {
  editingPhaseBudgets: boolean;
  setEditingPhaseBudgets: Dispatch<SetStateAction<boolean>>;
  phaseBudgetsDraft: Record<number, string>;
  setPhaseBudgetsDraft: Dispatch<SetStateAction<Record<number, string>>>;
  startEditingPhaseBudgets: () => void;
  distributeEvenly: () => void;
  distributeByWeight: () => void;
  sumDraftPhaseBudgets: number;
  handleSavePhaseBudgets: (e: FormEvent) => void;
}

/** Draft state for editing per-stage budget allocations (in crore). */
export function usePhaseBudgetDraft(project: Project, onSave: (patch: Partial<Project>) => void): PhaseBudgetDraft {
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

  return {
    editingPhaseBudgets,
    setEditingPhaseBudgets,
    phaseBudgetsDraft,
    setPhaseBudgetsDraft,
    startEditingPhaseBudgets,
    distributeEvenly,
    distributeByWeight,
    sumDraftPhaseBudgets,
    handleSavePhaseBudgets,
  };
}
