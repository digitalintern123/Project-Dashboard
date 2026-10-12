import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { CRORE, type Project } from '@/data/projects';
import { parseCroreFields } from '../helpers';

export interface CommercialEdit {
  editing: boolean;
  setEditing: Dispatch<SetStateAction<boolean>>;
  aop: string;
  setAop: Dispatch<SetStateAction<string>>;
  awarded: string;
  setAwarded: Dispatch<SetStateAction<string>>;
  spent: string;
  setSpent: Dispatch<SetStateAction<string>>;
  projectedCost: string;
  setProjectedCost: Dispatch<SetStateAction<string>>;
  commercialError: string;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}

/** Edit state for the commercial values form (AOP, awarded, spent, projected cost). */
export function useCommercialEdit(project: Project, onSave: (patch: Partial<Project>) => void): CommercialEdit {
  const [editing, setEditing] = useState(false);
  const [aop, setAop] = useState(String(project.aop / CRORE));
  const [awarded, setAwarded] = useState(String(project.awarded / CRORE));
  const [spent, setSpent] = useState(String(project.spent / CRORE));
  const [projectedCost, setProjectedCost] = useState(String((project.projectedCost ?? project.aop) / CRORE));
  const [commercialError, setCommercialError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = parseCroreFields({ aop, awarded, spent, projectedCost });
    if (!next) {
      setCommercialError('Enter AOP, awarded, spent, and projected cost as numbers of 0 or more.');
      return;
    }
    setCommercialError('');
    onSave(next);
    setEditing(false);
  };

  return {
    editing,
    setEditing,
    aop,
    setAop,
    awarded,
    setAwarded,
    spent,
    setSpent,
    projectedCost,
    setProjectedCost,
    commercialError,
    submit,
  };
}
