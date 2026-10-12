import type { ArchitecturalAreaProgram } from '@/data/projects';
import type { NewProjectForm, SetAreaProgram, SetNewProjectField } from './types';

type KeysBaysFieldsProps = {
  areaProgram: ArchitecturalAreaProgram;
  setAreaProgram: SetAreaProgram;
  form: NewProjectForm;
  set: SetNewProjectField;
};

/** Advanced space program: room keys, bays, room size, elevators, and remarks. */
export function KeysBaysFields({ areaProgram, setAreaProgram, form, set }: KeysBaysFieldsProps) {
  return (
    <div>
      <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#9a711f]">
        Keys, Bays & Transportation
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Total Room Keys</span>
          <input
            type="number"
            min="0"
            value={areaProgram.summary.totalRoomKeys || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10) || 0;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, totalRoomKeys: val },
              }));
              if (!form.paxKeys || form.paxKeys.includes('Keys')) {
                set('paxKeys', `${val} Keys / ${areaProgram.summary.totalBays || val} Bays`);
              }
            }}
            placeholder="e.g. 156"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Total Room Bays</span>
          <input
            type="number"
            min="0"
            value={areaProgram.summary.totalBays || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10) || 0;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, totalBays: val },
              }));
              if (!form.paxKeys || form.paxKeys.includes('Bays')) {
                set('paxKeys', `${areaProgram.summary.totalRoomKeys || 0} Keys / ${val} Bays`);
              }
            }}
            placeholder="e.g. 168"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Standard Room Size (SQ.M.)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={areaProgram.summary.standardRoomSizeSqm || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, standardRoomSizeSqm: val },
              }));
            }}
            placeholder="e.g. 27"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Number of Elevators</span>
          <input
            type="number"
            min="0"
            value={areaProgram.summary.numberOfElevators || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10) || 0;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, numberOfElevators: val },
              }));
            }}
            placeholder="e.g. 4"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Elevator / Core Notes</span>
          <input
            type="text"
            value={areaProgram.summary.elevatorRemarks}
            onChange={(e) => {
              const val = e.target.value;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, elevatorRemarks: val },
              }));
            }}
            placeholder="e.g. 2 Passenger Elevators + 2 Service Lifts"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-bold text-foreground">Special Amenities / Scope Remarks</span>
          <input
            type="text"
            value={areaProgram.summary.generalRemarks}
            onChange={(e) => {
              const val = e.target.value;
              setAreaProgram((prev) => ({
                ...prev,
                summary: { ...prev.summary, generalRemarks: val },
              }));
            }}
            placeholder="e.g. Banquet, ADD, Lounge Bar, Gym, Pool & 4 Presidential Suites"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
          />
        </label>
      </div>
    </div>
  );
}
