import { useState, type FormEvent } from 'react';
import { ShieldAlert } from 'lucide-react';
import { CRORE, type ArchitecturalAreaProgram } from '@/data/projects';
import { AreaProgramEditorModal, emptyAreaProgram } from '@/components/project-area-program';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { formatFullDate, isValidIsoDate, todayIso } from '@/lib/date';
import { PageHeader } from '../page-header';
import { AreaCommercialsSection } from './area-commercials-section';
import { AreaProgramSection } from './area-program-section';
import { BasicInfoSection } from './basic-info-section';
import { ProjectCreated } from './project-created';
import type { NewProjectForm } from './types';

export function NewProjectView() {
  const { addProject, user, canEdit, role, leads, projects } = useAppState();
  const { toast } = useToast();
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [includeAdvancedAreaProgram, setIncludeAdvancedAreaProgram] = useState(false);
  const [areaProgram, setAreaProgram] = useState<ArchitecturalAreaProgram>(emptyAreaProgram);
  const [isDetailedTableModalOpen, setIsDetailedTableModalOpen] = useState(false);
  const [form, setForm] = useState<NewProjectForm>({
    name: '',
    location: 'Delhi',
    category: 'Lounge',
    projectType: 'Premium Lounge',
    leadId: (role === 'lead' ? user?.id : leads[0]?.id) || user?.id || '',
    status: 'Yet to start',
    startDate: todayIso(),
    targetDate: '',
    progress: '0',
    aop: '50',
    awarded: '0',
    projectedCost: '50',
    area: '',
    paxKeys: '',
    scope: '',
  });

  const progressNum = Math.max(0, Math.min(100, Number(form.progress) || 0));

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  if (!canEdit) {
    return (
      <>
        <PageHeader
          eyebrow="Project workspace"
          title="Create new project"
          description="Creating projects is restricted to Project Leads and Coordinators."
        />
        <div className="mt-8 flex max-w-[620px] items-start gap-3 rounded-2xl border border-[#eadcb1] bg-[#fbf1d8] p-5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#9a711f]" />
          <p className="text-[12px] leading-6 text-[#8e681c]">
            You are signed in with read-only portfolio access. Project creation is managed by the Project Coordinator or
            Leads.
          </p>
        </div>
      </>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const found: string[] = [];
    const name = form.name.trim();
    const aopCrore = Number(form.aop);
    const awardedCrore = Number(form.awarded);
    const projectedCrore = Number(form.projectedCost || form.aop);

    if (!name) found.push('Project name is required.');
    if (!form.location.trim()) found.push('Enter the location.');
    if (!isValidIsoDate(form.startDate)) found.push('Enter a valid start date.');
    if (!isValidIsoDate(form.targetDate)) found.push('Enter a valid target completion date.');
    if (!Number.isFinite(aopCrore) || aopCrore < 0) found.push('Approved Budget (AOP) must be a number of 0 or more.');
    if (!Number.isFinite(awardedCrore) || awardedCrore < 0)
      found.push('Committed/Awarded amount must be a number of 0 or more.');
    if (!Number.isFinite(projectedCrore) || projectedCrore < 0)
      found.push('Projected Cost must be a number of 0 or more.');
    if (isValidIsoDate(form.startDate) && isValidIsoDate(form.targetDate) && form.targetDate < form.startDate) {
      found.push('Target completion must fall on or after the start date.');
    }

    if (found.length) {
      setErrors(found);
      return;
    }
    setErrors([]);

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const place =
      form.location
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'site';
    const id = `${place}-${slug || 'project'}-${Date.now()}`;

    const created = await addProject({
      id,
      name,
      location: form.location,
      category: form.category,
      code: `${
        form.location
          .replace(/[^a-z]/gi, '')
          .slice(0, 3)
          .toUpperCase() || 'PRJ'
      }-NEW-${new Date().getFullYear() % 100}`,
      health: progressNum > 0 ? 'On track' : 'Not started',
      status: form.status,
      progress: progressNum,
      targetDate: form.targetDate,
      targetLabel: formatFullDate(form.targetDate),
      aop: aopCrore * CRORE,
      awarded: awardedCrore * CRORE,
      spent: 0,
      projectedCost: projectedCrore * CRORE,
      area: form.area.trim(),
      paxKeys: form.paxKeys.trim(),
      nextMilestone: 'Project brief',
      nextMilestoneDate: form.startDate,
      leadId: form.leadId || user?.id || '',
      startDate: form.startDate,
      specification: {
        projectType: form.projectType,
        area: form.area,
        capacity: form.paxKeys,
        units: '',
        terminal: form.location,
        floor: '',
        scope: form.scope,
        areaProgram: includeAdvancedAreaProgram ? areaProgram : undefined,
      },
      phases: [
        { name: 'Brief & scope', status: 'active', progress: 0, owner: 'PMO' },
        { name: 'Design development', status: 'upcoming', progress: 0, owner: 'Design' },
        { name: 'Procurement', status: 'upcoming', progress: 0, owner: 'Sourcing' },
        { name: 'Execution', status: 'upcoming', progress: 0, owner: 'Projects' },
        { name: 'Handover', status: 'upcoming', progress: 0, owner: 'Operations' },
      ],
      milestones: [],
      issues: [],
      updates: [],
    });

    if (!created) {
      setErrors(['The project could not be saved. Refresh and try again.']);
      return;
    }

    setCreatedName(name);
    toast({ title: 'Project created', description: `${name} is now in the portfolio.` });
  };

  if (createdName) return <ProjectCreated name={createdName} />;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio creation"
        title="Create new project"
        description="Capture the core project metrics, status lifecycle, commercial budget, and assign a Project Lead."
      />
      <form onSubmit={submit} noValidate className="mt-8 max-w-[1000px] space-y-5">
        {errors.length > 0 && (
          <div role="alert" className="rounded-2xl border border-[#f0c8c2] bg-[#fff5f2] p-4">
            <p className="text-[11px] font-extrabold text-[#b2473d]">Fix the following before creating the project</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-[#b2473d]">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <BasicInfoSection form={form} set={set} role={role} leads={leads} projects={projects} />

        <AreaCommercialsSection form={form} set={set} />

        {/* Section 3: Architectural Space Program (Advanced Specifications) */}
        <AreaProgramSection
          includeAdvancedAreaProgram={includeAdvancedAreaProgram}
          setIncludeAdvancedAreaProgram={setIncludeAdvancedAreaProgram}
          areaProgram={areaProgram}
          setAreaProgram={setAreaProgram}
          form={form}
          set={set}
          onOpenDetailedTables={() => setIsDetailedTableModalOpen(true)}
        />

        {isDetailedTableModalOpen && (
          <AreaProgramEditorModal
            initialProgram={areaProgram}
            onClose={() => setIsDetailedTableModalOpen(false)}
            onSave={(updated) => {
              setAreaProgram(updated);
              setIncludeAdvancedAreaProgram(true);
              if (updated.summary.builtUpAreaSqm) {
                set(
                  'area',
                  `${updated.summary.builtUpAreaSqm.toLocaleString()} SQ.M. / ${updated.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.`,
                );
              }
              if (updated.summary.totalRoomKeys) {
                set('paxKeys', `${updated.summary.totalRoomKeys} Keys / ${updated.summary.totalBays} Bays`);
              }
              setIsDetailedTableModalOpen(false);
              toast({
                title: 'Space Program Tables Updated',
                description: 'Floor breakdown, FOH capacities, and room matrices have been saved to this draft.',
              });
            }}
          />
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-[#d6a95d] px-5 py-3 text-[11px] font-extrabold text-[#173e49] hover:bg-[#e2bd73]"
          >
            Create project
          </button>
        </div>
      </form>
    </>
  );
}
