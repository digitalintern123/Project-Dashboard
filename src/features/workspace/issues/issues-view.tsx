import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Project, ProjectIssue } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { todayLabel } from '@/lib/date';
import { PageHeader } from '../page-header';
import { IssuesToolbar } from './issues-toolbar';
import { ProjectIssuesCard } from './project-issues-card';
import type { IssueDraft, IssueFilter, IssueScope } from './types';
import { useIssueRegister } from './use-issue-register';
import { currentStage } from '@/lib/stage-status';

export function IssuesView() {
  const { projects, canEditProject, updateIssue, addIssue } = useAppState();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<IssueFilter>('All');
  const [scope, setScope] = useState<IssueScope>('with-issues');
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({});
  const [addingForProjectId, setAddingForProjectId] = useState<string | null>(null);

  const [newDraft, setNewDraft] = useState<IssueDraft>({
    title: '',
    detail: '',
    category: 'Design',
    severity: 'Medium',
    stage: '',
    owner: '',
    dueDate: '',
    issueAriseDate: todayLabel(),
    targetClosureDate: '',
    impactCost: '',
    impactSchedule: '',
    impactScope: '',
    action: '',
  });

  const setDraftField = (key: keyof typeof newDraft, value: string) => setNewDraft((cur) => ({ ...cur, [key]: value }));

  const { portfolioCounts, displayedProjects } = useIssueRegister(projects, search, filter, scope);

  // Determine if a project is expanded
  const isProjectExpanded = (projectId: string, hasMatchingIssues: boolean) => {
    if (projectId in userToggled) {
      return !!userToggled[projectId];
    }
    // Default open if project has matching issues
    return hasMatchingIssues;
  };

  const toggleProject = (projectId: string, currentState: boolean) => {
    setUserToggled((prev) => ({ ...prev, [projectId]: !currentState }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of displayedProjects) {
      next[item.project.id] = true;
    }
    setUserToggled(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of displayedProjects) {
      next[item.project.id] = false;
    }
    setUserToggled(next);
  };

  const handleStatusChange = (projectId: string, issueIndex: number, newStatus: string) => {
    if (!canEditProject(projectId)) {
      toast({
        title: 'Action not allowed',
        description: 'You can only update issues for projects allotted to you.',
        variant: 'destructive',
      });
      return;
    }
    updateIssue(projectId, issueIndex, { status: newStatus as ProjectIssue['status'] });
    toast({
      title: 'Issue Status Updated',
      description: `Issue updated to "${newStatus}".`,
    });
  };

  const handleOpenAddForm = (project: Project) => {
    if (!canEditProject(project)) {
      toast({
        title: 'Action not allowed',
        description: 'You can only log issues for projects allotted to you.',
        variant: 'destructive',
      });
      return;
    }
    setAddingForProjectId(project.id);
    setUserToggled((prev) => ({ ...prev, [project.id]: true }));
    setNewDraft({
      title: '',
      detail: '',
      category: 'Design',
      severity: 'Medium',
      stage: currentStage(project.phases)?.name ?? project.phases[0]?.name ?? '',
      owner: '',
      dueDate: '',
      issueAriseDate: todayLabel(),
      targetClosureDate: '',
      impactCost: '',
      impactSchedule: '',
      impactScope: '',
      action: '',
    });
  };

  const handleSaveNewIssue = (projectId: string) => {
    if (!canEditProject(projectId)) {
      toast({
        variant: 'destructive',
        title: 'Action not allowed',
        description: 'You can only log issues for projects allotted to you.',
      });
      return;
    }

    if (!newDraft.title.trim() || !newDraft.detail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Required fields missing',
        description: 'Please provide both an issue title and description.',
      });
      return;
    }

    addIssue(projectId, {
      ...newDraft,
      owner: newDraft.owner.trim() || 'Project Lead',
      status: 'Open',
      dateRaised: newDraft.issueAriseDate || todayLabel(),
      issueAriseDate: newDraft.issueAriseDate || todayLabel(),
      dueDate: newDraft.targetClosureDate || newDraft.dueDate,
      targetClosureDate: newDraft.targetClosureDate || newDraft.dueDate,
    });

    setAddingForProjectId(null);
    toast({
      title: 'Issue Logged',
      description: `Added "${newDraft.title}" to project register.`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Execution Register"
        title="Issues & risks"
        description="A project-centric register of the blockers, decisions, and risks that can change project outcomes."
      />

      {/* Filter and Control Bar */}
      <IssuesToolbar
        search={search}
        onSearchChange={setSearch}
        scope={scope}
        onScopeChange={setScope}
        filter={filter}
        onFilterChange={setFilter}
        portfolioCounts={portfolioCounts}
        projectCount={projects.length}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {/* Primary Project List with Issues Sub-Sections */}
      <div className="mt-7 space-y-5">
        {displayedProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <ShieldAlert size={28} className="mx-auto text-muted-foreground/60" />
            <h3 className="mt-3 text-[14px] font-extrabold text-foreground">No projects match this issues filter</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Try switching to "All projects" or choosing a different filter tab above.
            </p>
          </div>
        ) : (
          displayedProjects.map((item) => {
            const { project, filteredIssues } = item;
            const expanded = isProjectExpanded(project.id, filteredIssues.length > 0);
            const isAdding = addingForProjectId === project.id;

            return (
              <ProjectIssuesCard
                key={project.id}
                item={item}
                filter={filter}
                expanded={expanded}
                isAdding={isAdding}
                canEdit={canEditProject(project)}
                draft={newDraft}
                onToggle={() => toggleProject(project.id, expanded)}
                onOpenAddForm={() => handleOpenAddForm(project)}
                onDraftFieldChange={setDraftField}
                onSaveNewIssue={() => handleSaveNewIssue(project.id)}
                onCancelAdd={() => setAddingForProjectId(null)}
                onStatusChange={handleStatusChange}
              />
            );
          })
        )}
      </div>
    </>
  );
}
