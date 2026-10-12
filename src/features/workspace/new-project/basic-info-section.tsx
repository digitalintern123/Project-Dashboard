import { categories, locations, projectStatuses } from '@/data/projects';
import type { User } from '@/data/users';
import type { AppRole } from '@/state/app-state';
import type { NewProjectForm, SetNewProjectField } from './types';

type BasicInfoSectionProps = {
  form: NewProjectForm;
  set: SetNewProjectField;
  role: AppRole | null;
  leads: User[];
};

/** Section 1: project name, lead allotment, location, category, progress, status, and dates. */
export function BasicInfoSection({ form, set, role, leads }: BasicInfoSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-[18px] font-extrabold">1. Basic Information & Ownership</h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-2 block text-[11px] font-bold">Project Name *</span>
          <input
            required
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="e.g. Terminal 3 Premium Lounge"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
          />
        </label>

        {role === 'coordinator' && leads.length > 0 && (
          <label className="md:col-span-2">
            <span className="mb-2 block text-[11px] font-bold text-[#664b14]">Allot to Project Lead *</span>
            <select
              value={form.leadId}
              onChange={(event) => set('leadId', event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d6a95d] bg-white px-3 text-[12px] font-bold text-[#173e49]"
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.title}) — {l.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="mb-2 block text-[11px] font-bold">Location *</span>
          <select
            value={form.location}
            onChange={(event) => set('location', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
          >
            {locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Category *</span>
          <select
            value={form.category}
            onChange={(event) => set('category', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Initial Progress (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            value={form.progress}
            onChange={(event) => set('progress', event.target.value)}
            placeholder="0"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none"
          />
        </label>
        <div>
          <span className="mb-2 block text-[11px] font-bold">Project Status *</span>
          <select
            value={form.status}
            onChange={(event) => set('status', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold"
          >
            {projectStatuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Start Date *</span>
          <input
            type="date"
            required
            value={form.startDate}
            onChange={(event) => set('startDate', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
          />
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Project Completion Date (Target) *</span>
          <input
            type="date"
            required
            min={form.startDate}
            value={form.targetDate}
            onChange={(event) => set('targetDate', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px]"
          />
        </label>
      </div>
    </section>
  );
}
