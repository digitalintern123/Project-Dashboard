import type { Dispatch, SetStateAction } from 'react';
import type { ArchitecturalAreaProgram, Category, Project, ProjectStatus } from '@/data/projects';

export type NewProjectForm = {
  name: string;
  location: Project['location'];
  category: Category;
  projectType: string;
  leadId: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  progress: string;
  aop: string;
  awarded: string;
  projectedCost: string;
  area: string;
  paxKeys: string;
  scope: string;
};

export type SetNewProjectField = (key: keyof NewProjectForm, value: string) => void;

export type SetAreaProgram = Dispatch<SetStateAction<ArchitecturalAreaProgram>>;
