import { useState, type FormEvent } from 'react';
import {
  CRORE,
  projectStatuses,
  locationOptions,
  categories,
  type Health,
  type Project,
  type ProjectStatus,
  type Category,
} from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { LocationField } from '@/components/location-field';
import { formatFullDate, isValidIsoDate } from '@/lib/date';
import { healthStyles } from './styles';

export function EditProjectForm({
  project,
  onCancel,
  onSave,
}: {
  project: Project;
  onCancel: () => void;
  onSave: (patch: Partial<Project>) => void;
}) {
  const { leads, role, projects } = useAppState();
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code || '');
  const [location, setLocation] = useState(project.location);
  const [category, setCategory] = useState<Category>(project.category);
  const [status, setStatus] = useState<ProjectStatus>(project.status || 'Yet to start');
  const [health, setHealth] = useState<Health>(project.health);
  const [leadId, setLeadId] = useState(project.leadId);
  const [startDate, setStartDate] = useState(project.startDate || '');
  const [targetDate, setTargetDate] = useState(project.targetDate);
  const [nextMilestone, setNextMilestone] = useState(project.nextMilestone || '');
  const [nextMilestoneDate, setNextMilestoneDate] = useState(project.nextMilestoneDate || '');
  const [area, setArea] = useState(project.area || project.specification?.area || '');
  const [paxKeys, setPaxKeys] = useState(project.paxKeys || project.specification?.capacity || '');
  const [terminal, setTerminal] = useState(project.specification?.terminal || '');
  const [floor, setFloor] = useState(project.specification?.floor || '');
  const [scope, setScope] = useState(project.specification?.scope || '');
  const [aop, setAop] = useState(String((project.aop || 0) / CRORE));
  const [awarded, setAwarded] = useState(String((project.awarded || 0) / CRORE));
  const [spent, setSpent] = useState(String((project.spent || 0) / CRORE));
  const [projectedCost, setProjectedCost] = useState(String(((project.projectedCost ?? project.aop) || 0) / CRORE));
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Project name cannot be empty.');
      return;
    }
    if (!location.trim()) {
      setError('Enter the location.');
      return;
    }
    if (!isValidIsoDate(targetDate)) {
      setError('Enter a valid target completion date.');
      return;
    }
    setError('');

    const parsedAop = !isNaN(Number(aop)) && Number(aop) >= 0 ? Number(aop) * CRORE : project.aop;
    const parsedAwarded = !isNaN(Number(awarded)) && Number(awarded) >= 0 ? Number(awarded) * CRORE : project.awarded;
    const parsedSpent = !isNaN(Number(spent)) && Number(spent) >= 0 ? Number(spent) * CRORE : project.spent;
    const parsedProjected =
      !isNaN(Number(projectedCost)) && Number(projectedCost) >= 0 ? Number(projectedCost) * CRORE : parsedAop;

    onSave({
      name: name.trim(),
      code: code.trim() || project.code,
      location,
      category,
      status,
      health,
      leadId: role === 'coordinator' ? leadId : project.leadId,
      startDate: startDate || undefined,
      targetDate,
      targetLabel: formatFullDate(targetDate),
      nextMilestone: nextMilestone.trim() || project.nextMilestone,
      nextMilestoneDate: nextMilestoneDate || project.nextMilestoneDate,
      area: area.trim(),
      paxKeys: paxKeys.trim(),
      aop: parsedAop,
      awarded: parsedAwarded,
      spent: parsedSpent,
      projectedCost: parsedProjected,
      specification: {
        projectType: project.specification?.projectType ?? category,
        area: area.trim(),
        capacity: paxKeys.trim(),
        units: project.specification?.units ?? '',
        terminal: terminal.trim() || location,
        floor: floor.trim(),
        scope: scope.trim(),
        customFields: project.specification?.customFields,
        areaProgram: project.specification?.areaProgram,
        areaSheet: project.specification?.areaSheet,
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 rounded-2xl border border-[#eadcb1] bg-[#fff8e9] p-5 md:p-6 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-[#eadcb1]/70 pb-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[#9a711f]">
            {role === 'coordinator' ? 'Project coordinator controls' : 'Project lead controls'}
          </p>
          <h2 className="mt-0.5 text-[16px] font-extrabold text-[#173e49]">Edit project information</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {/* Section 1: Core Details */}
      <div className="mt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          1. Core Information
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-[10px] font-bold">Project name *</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Project Code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. DEL-T3-L01"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Project status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-bold text-[#173e49]"
            >
              {projectStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1.5 block text-[10px] font-bold">Location</span>
            <LocationField
              value={location}
              onChange={setLocation}
              options={locationOptions(projects)}
              required
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </div>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Health status</span>
            <select
              value={health}
              onChange={(event) => setHealth(event.target.value as Health)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            >
              {(Object.keys(healthStyles) as Health[]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {role === 'coordinator' && leads.length > 0 && (
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-[#664b14]">Allotted Project Lead</span>
              <select
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                className="h-9 w-full rounded-lg border border-[#d6a95d] bg-white px-3 text-[11px] font-bold text-[#173e49]"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.title})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Section 2: Timeline & Milestones */}
      <div className="mt-5 border-t border-[#eadcb1]/70 pt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          2. Timeline & Next Milestone
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Target Completion Date *</span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Next Key Milestone</span>
            <input
              value={nextMilestone}
              onChange={(event) => setNextMilestone(event.target.value)}
              placeholder="e.g. MEP rough-in sign-off"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Milestone Target Date</span>
            <input
              type="date"
              value={nextMilestoneDate}
              onChange={(event) => setNextMilestoneDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
        </div>
      </div>

      {/* Section 3: Physical Specifications & Scope */}
      <div className="mt-5 border-t border-[#eadcb1]/70 pt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          3. Physical Space & Specifications
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Area</span>
            <input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder="e.g. 24,000 sqft"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Pax / Keys</span>
            <input
              value={paxKeys}
              onChange={(event) => setPaxKeys(event.target.value)}
              placeholder="e.g. 180 Pax / 45 Keys"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Terminal / Airport</span>
            <input
              value={terminal}
              onChange={(event) => setTerminal(event.target.value)}
              placeholder="e.g. T3 Departure"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Floor Level</span>
            <input
              value={floor}
              onChange={(event) => setFloor(event.target.value)}
              placeholder="e.g. Level 2 (Mezzanine)"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px]"
            />
          </label>
          <label className="md:col-span-4">
            <span className="mb-1.5 block text-[10px] font-bold">Scope of Work</span>
            <textarea
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              rows={2}
              placeholder="Detailed description of works, MEP coordination, finishes, and handover deliverables..."
              className="w-full rounded-lg border border-border bg-white p-2.5 text-[11px] outline-none"
            />
          </label>
        </div>
      </div>

      {/* Section 4: Commercial Figures */}
      <div className="mt-5 border-t border-[#eadcb1]/70 pt-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#9a711f] font-bold">
          4. Commercial Capital Position (₹ in Crores)
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Approved Budget (AOP)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={aop}
              onChange={(event) => setAop(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Committed / Awarded</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={awarded}
              onChange={(event) => setAwarded(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Spent Till Date</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={spent}
              onChange={(event) => setSpent(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold">Projected Final Cost</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={projectedCost}
              onChange={(event) => setProjectedCost(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[11px] font-mono"
            />
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fae5e1] px-3 py-2 text-[11px] font-semibold text-[#b2473d]">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2 border-t border-[#eadcb1]/70 pt-3">
        <button
          type="submit"
          className="rounded-lg bg-[#173e49] px-5 py-2.5 text-[10px] font-bold text-white shadow-xs hover:bg-[#205160] transition"
        >
          Save project
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-[10px] font-bold hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
