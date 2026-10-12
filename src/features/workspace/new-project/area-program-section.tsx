import { Building2, SlidersHorizontal } from 'lucide-react';
import type { ArchitecturalAreaProgram } from '@/data/projects';
import { KeysBaysFields } from './keys-bays-fields';
import { SiteBuaFields } from './site-bua-fields';
import type { NewProjectForm, SetAreaProgram, SetNewProjectField } from './types';

type AreaProgramSectionProps = {
  includeAdvancedAreaProgram: boolean;
  setIncludeAdvancedAreaProgram: (value: boolean) => void;
  areaProgram: ArchitecturalAreaProgram;
  setAreaProgram: SetAreaProgram;
  form: NewProjectForm;
  set: SetNewProjectField;
  onOpenDetailedTables: () => void;
};

/** Section 3: optional Architectural Space Program (Advanced Specifications). */
export function AreaProgramSection({
  includeAdvancedAreaProgram,
  setIncludeAdvancedAreaProgram,
  areaProgram,
  setAreaProgram,
  form,
  set,
  onOpenDetailedTables,
}: AreaProgramSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-[#9a711f]" />
            <h2 className="text-[18px] font-extrabold text-[#173e49]">
              3. Architectural Space Program (Advanced Specifications)
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Optional comprehensive architectural breakdown: Plot area, Total BUA, floor stacking, keys/bays, FOH public
            areas with pax, floor-wise BUA table, and room matrix.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-[12px] font-bold text-foreground hover:bg-muted/50 transition shrink-0 select-none">
          <input
            type="checkbox"
            checked={includeAdvancedAreaProgram}
            onChange={(e) => setIncludeAdvancedAreaProgram(e.target.checked)}
            className="size-4 rounded text-[#173e49] focus:ring-[#9a711f] accent-[#173e49]"
          />
          <span>Enable Advanced Specifications</span>
        </label>
      </div>

      {includeAdvancedAreaProgram ? (
        <div className="mt-6 space-y-6">
          {/* Site & BUA Metrics */}
          <SiteBuaFields areaProgram={areaProgram} setAreaProgram={setAreaProgram} form={form} set={set} />

          {/* Room Inventory & Stacking */}
          <KeysBaysFields areaProgram={areaProgram} setAreaProgram={setAreaProgram} form={form} set={set} />

          {/* Detailed Breakdown Tables Action Card */}
          <div className="rounded-xl border border-[#eadcb1] bg-[#fffbf2] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-[14px] font-extrabold text-[#173e49]">
                  Detailed Breakdown Tables (FOH Pax, Floor BUA & Room Matrix)
                </h4>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Add row-by-row entries for Ground/2nd Floor public spaces (Banquet, ADD, Lounge Bar, etc.) with Pax
                  capacities, floor-wise BUA allocations, and room inventory across guest floors.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#eadcb1] px-2.5 py-1 text-[#8f691b] font-semibold">
                    {areaProgram.fohAreas.groundFloor.length + areaProgram.fohAreas.secondFloor.length} FOH Areas
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#eadcb1] px-2.5 py-1 text-[#8f691b] font-semibold">
                    {areaProgram.floorWiseBua.items.length} Floor BUA Rows
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#eadcb1] px-2.5 py-1 text-[#8f691b] font-semibold">
                    {areaProgram.roomConfiguration.items.length} Guest Floor Rows
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenDetailedTables}
                className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-2.5 text-[12px] font-bold text-white shadow hover:bg-[#205160] transition shrink-0"
              >
                <SlidersHorizontal size={14} />
                Open Detailed Tables Editor
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
          <p className="text-[12px] text-muted-foreground">
            Advanced Architectural Space Program is currently disabled for this project. Check the box above to enter
            plot area, BUA, floor stacking, keys, bays, and detailed space allocation tables.
          </p>
        </div>
      )}
    </section>
  );
}
