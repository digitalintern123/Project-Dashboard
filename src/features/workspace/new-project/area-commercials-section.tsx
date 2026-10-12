import type { NewProjectForm, SetNewProjectField } from './types';

type AreaCommercialsSectionProps = {
  form: NewProjectForm;
  set: SetNewProjectField;
};

/** Section 2: area, pax / keys, commercial budget figures, and scope description. */
export function AreaCommercialsSection({ form, set }: AreaCommercialsSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <h2 className="text-[18px] font-extrabold">2. Area, Capacity & Commercials</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-[11px] font-bold">Area</span>
          <input
            value={form.area}
            onChange={(event) => set('area', event.target.value)}
            placeholder="e.g. 24,000 sqft"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none"
          />
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Pax / Keys</span>
          <input
            value={form.paxKeys}
            onChange={(event) => set('paxKeys', event.target.value)}
            placeholder="e.g. 180 Pax / 45 Keys"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none"
          />
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Approved Budget (AOP in ₹ Cr) *</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.aop}
            onChange={(event) => set('aop', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none font-bold"
          />
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-bold">Committed Cost / Awarded (₹ Cr)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.awarded}
            onChange={(event) => set('awarded', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none font-bold"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-2 block text-[11px] font-bold">Projected Cost (₹ Cr)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.projectedCost}
            onChange={(event) => set('projectedCost', event.target.value)}
            placeholder="Leave blank to match Approved Budget"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none font-bold text-[#173e49]"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-2 block text-[11px] font-bold">Scope Description</span>
          <textarea
            value={form.scope}
            onChange={(event) => set('scope', event.target.value)}
            rows={3}
            placeholder="Describe the core project scope..."
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[12px] outline-none"
          />
        </label>
      </div>
    </section>
  );
}
