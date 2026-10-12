import type { ArchitecturalAreaProgram } from '@/data/projects';
import type { NewProjectForm, SetAreaProgram, SetNewProjectField } from './types';

type SiteBuaFieldsProps = {
  areaProgram: ArchitecturalAreaProgram;
  setAreaProgram: SetAreaProgram;
  form: NewProjectForm;
  set: SetNewProjectField;
};

/** Advanced space program: plot / site area, total BUA, and floor stacking. */
export function SiteBuaFields({ areaProgram, setAreaProgram, form, set }: SiteBuaFieldsProps) {
  return (
    <div>
      <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#9a711f]">Site & Built-Up Area (BUA)</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Plot Area (SQ.M.)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={areaProgram.summary.plotAreaSqm || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setAreaProgram((prev) => ({
                ...prev,
                summary: {
                  ...prev.summary,
                  plotAreaSqm: val,
                  plotAreaSqft: Math.round(val * 10.7639),
                },
              }));
            }}
            placeholder="e.g. 8160"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
            = {(areaProgram.summary.plotAreaSqft || 0).toLocaleString()} SQ.FT.
          </span>
        </label>

        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Site Area (Acres)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={areaProgram.summary.plotAreaAcres || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, plotAreaAcres: val },
              }));
            }}
            placeholder="e.g. 2.0"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Total BUA (SQ.M.)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={areaProgram.summary.builtUpAreaSqm || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              const sqft = Math.round(val * 10.7639);
              setAreaProgram((prev) => ({
                ...prev,
                summary: {
                  ...prev.summary,
                  builtUpAreaSqm: val,
                  builtUpAreaSqft: sqft,
                },
              }));
              if (!form.area || form.area.includes('SQ.M.')) {
                set('area', `${val.toLocaleString()} SQ.M. / ${sqft.toLocaleString()} SQ.FT.`);
              }
            }}
            placeholder="e.g. 14970"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
            = {(areaProgram.summary.builtUpAreaSqft || 0).toLocaleString()} SQ.FT.
          </span>
        </label>

        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Floor Stacking / Level Breakdown</span>
          <input
            type="text"
            value={areaProgram.summary.numberOfFloorsDescription}
            onChange={(e) => {
              const val = e.target.value;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, numberOfFloorsDescription: val },
              }));
            }}
            placeholder="e.g. B + G + 1 + Service + 2nd-6th Floor"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
          />
        </label>
      </div>
    </div>
  );
}
