import { useState } from 'react';
import { Link } from 'wouter';
import {
  Building2,
  FileSpreadsheet,
  Printer,
  Edit3,
  Sparkles,
  Layers,
  DoorClosed,
  Maximize2,
  Plus,
  Trash2,
  X,
  Save,
  FileText,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { type Project, type ArchitecturalAreaProgram } from '@/data/projects';
import { useToast } from '@/hooks/use-toast';

interface ProjectAreaProgramProps {
  project: Project;
  editable: boolean;
  onSave?: (patch: Partial<Project>) => void;
}

export const emptyAreaProgram: ArchitecturalAreaProgram = {
  summary: {
    plotAreaSqm: 0,
    plotAreaSqft: 0,
    plotAreaAcres: 0,
    builtUpAreaSqm: 0,
    builtUpAreaSqft: 0,
    numberOfFloorsDescription: '',
    totalRoomKeys: 0,
    totalBays: 0,
    standardRoomSizeSqm: 27,
    numberOfElevators: 0,
    elevatorRemarks: '',
    generalRemarks: '',
  },
  fohAreas: {
    groundFloor: [],
    groundFloorSubtotal: { areaSqm: 0, areaSqft: 0 },
    secondFloor: [],
    secondFloorSubtotal: { areaSqm: 0, areaSqft: 0 },
    grandSubtotal: { areaSqm: 0, areaSqft: 0 },
  },
  floorWiseBua: {
    items: [],
    subtotal: { areaSqm: 0, areaSqft: 0 },
  },
  roomConfiguration: {
    items: [],
    totalKeys: 0,
    totalBays: 0,
  },
};

export function ProjectAreaProgram({ project, editable, onSave }: ProjectAreaProgramProps) {
  const { toast } = useToast();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const hasProgram = Boolean(project.specification?.areaProgram);
  const currentProgram: ArchitecturalAreaProgram = project.specification?.areaProgram || emptyAreaProgram;
  const upperFloorName = currentProgram.fohAreas.secondFloor[0]?.floor || 'Upper Floor';

  const handleExportCSV = () => {
    try {
      const rows: string[][] = [];

      // Section 1: Summary
      rows.push(['ARCHITECTURAL AREA PROGRAM & SPACE SUMMARY']);
      rows.push(['Project Name', project.name]);
      rows.push(['Location', project.location]);
      rows.push(['Export Date', new Date().toLocaleDateString('en-GB')]);
      rows.push([]);

      rows.push(['EXECUTIVE SUMMARY METRICS']);
      rows.push(['Parameter', 'Area (SQ.M.)', 'Area (SQ.FT.)', 'Pax / Remarks']);
      rows.push([
        'Plot Area',
        currentProgram.summary.plotAreaSqm.toLocaleString(),
        currentProgram.summary.plotAreaSqft.toLocaleString(),
        `${currentProgram.summary.plotAreaAcres} Acres`,
      ]);
      rows.push([
        'Total Built-Up Area (BUA)',
        currentProgram.summary.builtUpAreaSqm.toLocaleString(),
        currentProgram.summary.builtUpAreaSqft.toLocaleString(),
        currentProgram.summary.numberOfFloorsDescription,
      ]);
      rows.push([
        'Room Inventory',
        `Standard Room: ${currentProgram.summary.standardRoomSizeSqm} SQ.M.`,
        `Total Bays: ${currentProgram.summary.totalBays}`,
        `Total Keys: ${currentProgram.summary.totalRoomKeys} (${currentProgram.summary.generalRemarks || ''})`,
      ]);
      rows.push([
        'Vertical Transportation',
        `${currentProgram.summary.numberOfElevators} Elevators`,
        '—',
        currentProgram.summary.elevatorRemarks,
      ]);
      rows.push([]);

      // Section 2: FOH Bifurcation
      rows.push(['KEY FOH (FRONT OF HOUSE) AREAS BIFURCATION']);
      rows.push(['S.No', 'Floor', 'Description', 'Area (SQ.M.)', 'Area (SQ.FT.)', 'Capacity (Pax)', 'Remarks']);

      currentProgram.fohAreas.groundFloor.forEach((item) => {
        rows.push([
          String(item.sNo),
          item.floor,
          `"${item.description}"`,
          String(item.areaSqm),
          String(item.areaSqft),
          String(item.capacityPax || '—'),
          `"${item.remarks || ''}"`,
        ]);
      });
      rows.push([
        '',
        'Ground Floor Subtotal',
        '',
        String(currentProgram.fohAreas.groundFloorSubtotal.areaSqm),
        String(currentProgram.fohAreas.groundFloorSubtotal.areaSqft),
        '',
        '',
      ]);

      currentProgram.fohAreas.secondFloor.forEach((item) => {
        rows.push([
          String(item.sNo),
          item.floor,
          `"${item.description}"`,
          String(item.areaSqm),
          String(item.areaSqft),
          String(item.capacityPax || '—'),
          `"${item.remarks || ''}"`,
        ]);
      });
      rows.push([
        '',
        `${upperFloorName} Subtotal`,
        '',
        String(currentProgram.fohAreas.secondFloorSubtotal.areaSqm),
        String(currentProgram.fohAreas.secondFloorSubtotal.areaSqft),
        '',
        '',
      ]);
      rows.push([
        '',
        'FOH Grand Total',
        '',
        String(currentProgram.fohAreas.grandSubtotal.areaSqm),
        String(currentProgram.fohAreas.grandSubtotal.areaSqft),
        '',
        '',
      ]);
      rows.push([]);

      // Section 3: Floor-Wise BUA
      rows.push(['FLOOR-WISE BUILT-UP AREA (BUA) SUMMARY']);
      rows.push(['S.No', 'Floor', 'Area (SQ.M.)', 'Area (SQ.FT.)', 'Share (%)', 'Remarks']);
      const totalBua = currentProgram.floorWiseBua.subtotal.areaSqm || 1;
      currentProgram.floorWiseBua.items.forEach((item) => {
        const sharePct = ((item.areaSqm / totalBua) * 100).toFixed(1);
        rows.push([
          String(item.sNo),
          item.floor,
          String(item.areaSqm),
          String(item.areaSqft),
          `${sharePct}%`,
          `"${item.remarks || ''}"`,
        ]);
      });
      rows.push([
        '',
        'Total BUA Subtotal',
        String(currentProgram.floorWiseBua.subtotal.areaSqm),
        String(currentProgram.floorWiseBua.subtotal.areaSqft),
        '100%',
        '',
      ]);
      rows.push([]);

      // Section 4: Room Configuration
      rows.push(['ROOM CONFIGURATION BY FLOOR']);
      rows.push(['S.No', 'Floor', 'Keys', 'Bays', 'Remarks']);
      currentProgram.roomConfiguration.items.forEach((item) => {
        rows.push([String(item.sNo), item.floor, String(item.keys), String(item.bays), `"${item.remarks || ''}"`]);
      });
      rows.push([
        '',
        'Total Inventory',
        String(currentProgram.roomConfiguration.totalKeys),
        String(currentProgram.roomConfiguration.totalBays),
        '',
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${project.name.replace(/\s+/g, '_')}_Area_Program.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'CSV exported',
        description: 'Complete Architectural Area Summary downloaded successfully.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Could not generate CSV file.',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!hasProgram) {
    const sheet = project.specification?.areaSheet;
    return (
      <div className="space-y-6 max-w-4xl mx-auto my-6">
        {sheet || project.area ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#9a711f]">
                  Official Master Area Register · Source: 3rd PDF
                </span>
                <h3 className="mt-1 text-[20px] font-bold text-foreground">Project Area Sheet Specification</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Master space allocation for <strong>{project.name}</strong> from the official Project Area Sheet
                  blueprint.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/area-sheet"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-3.5 py-2 text-[11px] font-bold text-[#2e7c67] hover:bg-[#dfeee5] transition shadow-xs"
                >
                  <FileSpreadsheet size={13} /> View Master Sheet
                </Link>
                {editable && (
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#173e49] px-3.5 py-2 text-[11px] font-bold text-white hover:bg-[#205160] transition shadow-xs"
                  >
                    <Plus size={13} /> Advanced Space Program
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-[#f8f6f0] p-4 text-center">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Sheet Entry No
                </span>
                <span className="mt-1 block text-[20px] font-extrabold text-[#173e49]">#{sheet?.slNo ?? '—'}</span>
                <span className="font-mono text-[10px] text-[#2e7c67]">{sheet?.section ?? 'FACILITIES'}</span>
              </div>

              <div className="rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4 text-center">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9a711f]">
                  Facility Area
                </span>
                <span className="mt-1 block text-[18px] font-extrabold text-[#173e49]">
                  {sheet?.areaSqft ? `${sheet.areaSqft.toLocaleString()} SQ.FT.` : project.area || '—'}
                </span>
                <span className="font-mono text-[10px] text-[#9a711f]">
                  {sheet?.areaSqm ? `${sheet.areaSqm.toLocaleString()} SQ.M.` : ''}
                </span>
              </div>

              <div className="rounded-xl border border-border bg-[#f8f6f0] p-4 text-center">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Location & Level
                </span>
                <span className="mt-1 block text-[16px] font-extrabold text-[#173e49]">{project.location}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {project.specification?.floor || 'Terminal / Concourse'}
                </span>
              </div>

              <div className="rounded-xl border border-border bg-[#f8f6f0] p-4 text-center">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Sheet Status
                </span>
                <span className="mt-1 block text-[13px] font-extrabold text-[#2e7c67]">
                  {sheet?.status || project.status || 'Operational'}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">Progress: {project.progress}%</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-[#fcfaf4] p-4 text-[12px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Facility Scope:</strong>{' '}
              {project.specification?.scope ||
                `${project.name} at ${project.location} airport. Area: ${project.area || 'Standard'}.`}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center max-w-2xl mx-auto my-8">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#f8f5ec] text-[#9a711f]">
              <Building2 size={30} />
            </div>
            <h3 className="mt-4 text-[19px] font-bold text-foreground">Architectural Space Program Not Configured</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground max-w-lg mx-auto">
              No architectural area or room configuration has been entered for <strong>{project.name}</strong> yet. You
              can manually enter plot area, BUA, keys, bays, floor-wise built-up area, and FOH public facilities.
            </p>
            {editable && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-5 py-2.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
                >
                  <Plus size={15} />
                  Configure Architectural Area Program
                </button>
              </div>
            )}
          </div>
        )}
        {isEditorOpen && (
          <AreaProgramEditorModal
            initialProgram={emptyAreaProgram}
            onClose={() => setIsEditorOpen(false)}
            onSave={(updated) => {
              if (onSave) {
                onSave({
                  area: `${updated.summary.builtUpAreaSqm.toLocaleString()} SQ.M. / ${updated.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.`,
                  paxKeys: `${updated.summary.totalRoomKeys} Keys / ${updated.summary.totalBays} Bays`,
                  specification: {
                    ...(project.specification || {
                      projectType: project.category,
                      units: '',
                      terminal: project.location,
                      floor: '',
                      scope: '',
                    }),
                    area: `${updated.summary.builtUpAreaSqm.toLocaleString()} SQ.M. / ${updated.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.`,
                    capacity: `${updated.summary.totalRoomKeys} Keys / ${updated.summary.totalBays} Bays`,
                    areaProgram: updated,
                  },
                });
                toast({
                  title: 'Area Program configured',
                  description: 'The architectural program has been saved to the database.',
                });
              }
              setIsEditorOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 print:p-0 print:space-y-4">
      {/* Top Header & Action Ribbon */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#e4f1ec] text-[#2e7c67]">
              <Building2 size={16} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[.15em] text-[#2e7c67] font-bold">
              Architectural Area Program & Summary
            </span>
          </div>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-tight text-[#173e49]">{project.name} Area Program</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Complete space allocation, FOH area bifurcation, floor-wise built-up area (BUA), and room inventory matrix.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-[11px] font-bold text-foreground shadow-sm hover:bg-[#f8f5ec] transition"
          >
            <FileSpreadsheet size={14} className="text-[#2e7c67]" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-[11px] font-bold text-foreground shadow-sm hover:bg-[#f8f5ec] transition"
          >
            <Printer size={14} className="text-[#173e49]" />
            Print Summary
          </button>
          {editable && (
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-[#225766] transition"
            >
              <Edit3 size={14} />
              Edit Program Data
            </button>
          )}
        </div>
      </div>

      {/* 1. Executive Metrics Ribbon */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Plot Area</span>
            <Maximize2 size={14} />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-extrabold text-foreground">
              {currentProgram.summary.plotAreaSqm.toLocaleString()}{' '}
              <span className="text-[12px] font-medium text-muted-foreground">SQ.M.</span>
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-[#2e7c67] font-semibold">
              {currentProgram.summary.plotAreaSqft.toLocaleString()} SQ.FT.
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground font-medium">
              {currentProgram.summary.plotAreaAcres} Acres site footprint
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#eadcb1] bg-[#fbf5e7] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#8f691b]">
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Total Built-Up Area</span>
            <Building2 size={14} />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-extrabold text-[#173e49]">
              {currentProgram.summary.builtUpAreaSqm.toLocaleString()}{' '}
              <span className="text-[12px] font-medium text-muted-foreground">SQ.M.</span>
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-[#9a711f] font-bold">
              {currentProgram.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.
            </p>
            <p className="mt-1 text-[10px] text-[#785b20] font-medium">B + G + 1 + Service + 2nd–6th</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Total Room Keys</span>
            <DoorClosed size={14} />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-extrabold text-foreground">
              {currentProgram.summary.totalRoomKeys}{' '}
              <span className="text-[12px] font-medium text-muted-foreground">Keys</span>
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-[#2e7c67] font-semibold">
              {currentProgram.summary.totalBays} Total Bays
            </p>
            <p
              className="mt-1 text-[10px] text-muted-foreground font-medium truncate"
              title={currentProgram.summary.generalRemarks}
            >
              {currentProgram.summary.generalRemarks || `${currentProgram.summary.totalRoomKeys} Keys across floors`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Standard Room Size</span>
            <Layers size={14} />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-extrabold text-foreground">
              {currentProgram.summary.standardRoomSizeSqm}{' '}
              <span className="text-[12px] font-medium text-muted-foreground">SQ.M.</span>
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-[#2e7c67] font-semibold">
              {Math.round(currentProgram.summary.standardRoomSizeSqm * 10.7639)} SQ.FT.
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground font-medium">Single standard bay unit</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Elevators</span>
            <Building2 size={14} />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-extrabold text-foreground">
              {currentProgram.summary.numberOfElevators}{' '}
              <span className="text-[12px] font-medium text-muted-foreground">Total</span>
            </span>
            <p
              className="mt-0.5 text-[11px] text-foreground font-semibold truncate"
              title={currentProgram.summary.elevatorRemarks}
            >
              {currentProgram.summary.elevatorRemarks || `${currentProgram.summary.numberOfElevators} Elevators`}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground font-medium">Passenger & Service Vertical Transport</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Key FOH Total</span>
            <Sparkles size={14} />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-extrabold text-[#173e49]">
              {currentProgram.fohAreas.grandSubtotal.areaSqm.toLocaleString()}{' '}
              <span className="text-[12px] font-medium text-muted-foreground">SQ.M.</span>
            </span>
            <p className="mt-0.5 font-mono text-[11px] text-[#2e7c67] font-semibold">
              {currentProgram.fohAreas.grandSubtotal.areaSqft.toLocaleString()} SQ.FT.
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground font-medium">Ground + 2nd floor facilities</p>
          </div>
        </div>
      </div>

      {/* 2. Key FOH Areas Bifurcation */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#9a711f] font-bold">
              Front of House (FOH)
            </span>
            <h3 className="mt-1 text-[18px] font-extrabold text-[#173e49]">Key FOH Areas Bifurcation</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-[#3d9a7e]" /> Ground Floor:{' '}
              {currentProgram.fohAreas.groundFloorSubtotal.areaSqm.toLocaleString()} SQ.M.
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-[#d19b35]" /> {upperFloorName}:{' '}
              {currentProgram.fohAreas.secondFloorSubtotal.areaSqm.toLocaleString()} SQ.M.
            </span>
          </div>
        </div>

        {/* Ground Floor FOH Table */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-bold text-[#173e49] flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#3d9a7e]" /> Ground Floor Public & Banquet Areas
            </h4>
            <span className="font-mono text-[11px] text-muted-foreground">
              {currentProgram.fohAreas.groundFloor.length} Areas Allocated
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-2 w-12">S.No</th>
                  <th className="px-3 py-2.5 w-28">Floor</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Description</th>
                  <th className="px-3 py-2.5 text-right w-28">Area (SQ.M.)</th>
                  <th className="px-3 py-2.5 text-right w-28">Area (SQ.FT.)</th>
                  <th className="px-3 py-2.5 text-center w-36">Capacity (Pax)</th>
                  <th className="py-2.5 pl-3 pr-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentProgram.fohAreas.groundFloor.map((item, idx) => (
                  <tr key={`${item.description}-${idx}`} className="hover:bg-[#fbfaf6] transition-colors">
                    <td className="py-2.5 pl-4 pr-2 font-mono text-muted-foreground">{item.sNo}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{item.floor}</td>
                    <td className="px-3 py-2.5 font-bold text-[#173e49]">{item.description}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{item.areaSqm.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {item.areaSqft.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {item.capacityPax ? (
                        <span className="inline-block rounded-full bg-[#f8edcf] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#9a711f]">
                          {item.capacityPax} Pax
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-muted-foreground text-[11px]">{item.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold text-foreground">
                  <td
                    colSpan={3}
                    className="py-2.5 pl-4 pr-3 text-right font-mono uppercase text-[10px] tracking-wider text-muted-foreground"
                  >
                    Ground Floor Subtotal
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#173e49]">
                    {currentProgram.fohAreas.groundFloorSubtotal.areaSqm.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#2e7c67]">
                    {currentProgram.fohAreas.groundFloorSubtotal.areaSqft.toLocaleString()}
                  </td>
                  <td colSpan={2} className="py-2.5 pl-3 pr-4 text-muted-foreground text-[11px] font-normal">
                    Ground FOH core footprint
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Upper Floor FOH Table */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-bold text-[#173e49] flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#d19b35]" /> {upperFloorName} Wellness & Recreational Areas
            </h4>
            <span className="font-mono text-[11px] text-muted-foreground">
              {currentProgram.fohAreas.secondFloor.length} Areas Allocated
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-2 w-12">S.No</th>
                  <th className="px-3 py-2.5 w-28">Floor</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Description</th>
                  <th className="px-3 py-2.5 text-right w-28">Area (SQ.M.)</th>
                  <th className="px-3 py-2.5 text-right w-28">Area (SQ.FT.)</th>
                  <th className="px-3 py-2.5 text-center w-36">Capacity (Pax)</th>
                  <th className="py-2.5 pl-3 pr-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentProgram.fohAreas.secondFloor.map((item, idx) => (
                  <tr key={`${item.description}-${idx}`} className="hover:bg-[#fbfaf6] transition-colors">
                    <td className="py-2.5 pl-4 pr-2 font-mono text-muted-foreground">{item.sNo}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{item.floor}</td>
                    <td className="px-3 py-2.5 font-bold text-[#173e49]">{item.description}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{item.areaSqm.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {item.areaSqft.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {item.capacityPax ? (
                        <span className="inline-block rounded-full bg-[#f8edcf] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#9a711f]">
                          {item.capacityPax} Pax
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-muted-foreground text-[11px]">{item.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold text-foreground">
                  <td
                    colSpan={3}
                    className="py-2.5 pl-4 pr-3 text-right font-mono uppercase text-[10px] tracking-wider text-muted-foreground"
                  >
                    {upperFloorName} Subtotal
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#173e49]">
                    {currentProgram.fohAreas.secondFloorSubtotal.areaSqm.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#2e7c67]">
                    {currentProgram.fohAreas.secondFloorSubtotal.areaSqft.toLocaleString()}
                  </td>
                  <td colSpan={2} className="py-2.5 pl-3 pr-4 text-muted-foreground text-[11px] font-normal">
                    Wellness & recreation
                  </td>
                </tr>
                <tr className="border-t border-border bg-[#faefe4] font-extrabold text-[#173e49]">
                  <td
                    colSpan={3}
                    className="py-3 pl-4 pr-3 text-right font-mono uppercase text-[11px] tracking-wider text-[#9a711f]"
                  >
                    Grand Total FOH Areas
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[14px] text-[#173e49]">
                    {currentProgram.fohAreas.grandSubtotal.areaSqm.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[14px] text-[#2e7c67]">
                    {currentProgram.fohAreas.grandSubtotal.areaSqft.toLocaleString()}
                  </td>
                  <td colSpan={2} className="py-3 pl-3 pr-4 font-semibold text-[#8f691b] text-[11px]">
                    Total public & guest facility areas
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* 3. Floor-Wise BUA Summary & Room Configuration Grid */}
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        {/* Floor-Wise Built-Up Area Table */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#2e7c67] font-bold">
                Vertical Stacking
              </span>
              <h3 className="mt-1 text-[18px] font-extrabold text-[#173e49]">Floor-Wise Built-Up Area (BUA)</h3>
            </div>
            <div className="text-right">
              <span className="font-mono text-[14px] font-extrabold text-[#173e49]">
                {currentProgram.floorWiseBua.subtotal.areaSqm.toLocaleString()} SQ.M.
              </span>
              <span className="block font-mono text-[10px] text-[#2e7c67] font-bold">
                {currentProgram.floorWiseBua.subtotal.areaSqft.toLocaleString()} SQ.FT.
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  <th className="py-2.5 pl-3 pr-2 w-10">S.No</th>
                  <th className="px-2 py-2.5 min-w-[130px]">Floor</th>
                  <th className="px-2 py-2.5 text-right w-24">SQ.M.</th>
                  <th className="px-2 py-2.5 text-right w-24">SQ.FT.</th>
                  <th className="px-2 py-2.5 text-center w-28">BUA Share</th>
                  <th className="py-2.5 pl-2 pr-3">Function / Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentProgram.floorWiseBua.items.map((item, idx) => {
                  const total = currentProgram.floorWiseBua.subtotal.areaSqm || 1;
                  const pct = Math.round((item.areaSqm / total) * 100);
                  return (
                    <tr key={`${item.floor}-${idx}`} className="hover:bg-[#fbfaf6] transition-colors">
                      <td className="py-2.5 pl-3 pr-2 font-mono text-muted-foreground text-[11px]">{item.sNo}</td>
                      <td className="px-2 py-2.5 font-bold text-[#173e49]">{item.floor}</td>
                      <td className="px-2 py-2.5 text-right font-mono font-semibold">
                        {item.areaSqm.toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-muted-foreground text-[11px]">
                        {item.areaSqft.toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="h-1.5 w-12 rounded-full bg-[#e7e7dc] overflow-hidden">
                            <div className="h-full rounded-full bg-[#3d9a7e]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] font-bold text-foreground w-6 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-muted-foreground text-[11px]">{item.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-[#f8f6f0] font-extrabold text-[#173e49]">
                  <td
                    colSpan={2}
                    className="py-2.5 pl-3 pr-2 font-mono uppercase text-[10px] tracking-wider text-muted-foreground"
                  >
                    Total BUA
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-[13px] text-[#173e49]">
                    {currentProgram.floorWiseBua.subtotal.areaSqm.toLocaleString()}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-[13px] text-[#2e7c67]">
                    {currentProgram.floorWiseBua.subtotal.areaSqft.toLocaleString()}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono text-[10px] text-muted-foreground">100%</td>
                  <td className="py-2.5 pl-2 pr-3 text-[11px] text-muted-foreground font-normal">
                    Complete vertical stack
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Room Configuration Matrix */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#9a711f] font-bold">
                  Guest Inventory
                </span>
                <h3 className="mt-1 text-[18px] font-extrabold text-[#173e49]">Room Configuration by Floor</h3>
              </div>
              <div className="text-right">
                <span className="font-mono text-[14px] font-extrabold text-[#173e49]">
                  {currentProgram.roomConfiguration.totalKeys} Keys
                </span>
                <span className="block font-mono text-[10px] text-[#9a711f] font-bold">
                  {currentProgram.roomConfiguration.totalBays} Bays
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                    <th className="py-2.5 pl-3 pr-2 w-10">S.No</th>
                    <th className="px-3 py-2.5">Guest Floor</th>
                    <th className="px-3 py-2.5 text-center w-20">Keys</th>
                    <th className="px-3 py-2.5 text-center w-20">Bays</th>
                    <th className="py-2.5 pl-2 pr-3">Notes & Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {currentProgram.roomConfiguration.items.map((item, idx) => (
                    <tr key={`${item.floor}-${idx}`} className="hover:bg-[#fbfaf6] transition-colors">
                      <td className="py-2.5 pl-3 pr-2 font-mono text-muted-foreground text-[11px]">{item.sNo}</td>
                      <td className="px-3 py-2.5 font-bold text-[#173e49]">{item.floor}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-foreground">
                        <span className="inline-block rounded-md bg-[#e4f1ec] px-2 py-0.5 text-[#2e7c67]">
                          {item.keys}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-foreground">
                        <span className="inline-block rounded-md bg-[#f8edcf] px-2 py-0.5 text-[#9a711f]">
                          {item.bays}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-[11px] text-muted-foreground">
                        {item.remarks || 'Standard'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-[#f8f6f0] font-extrabold text-[#173e49]">
                    <td
                      colSpan={2}
                      className="py-2.5 pl-3 pr-2 font-mono uppercase text-[10px] tracking-wider text-muted-foreground"
                    >
                      Total Keys & Bays
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[13px] text-[#2e7c67]">
                      {currentProgram.roomConfiguration.totalKeys}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[13px] text-[#9a711f]">
                      {currentProgram.roomConfiguration.totalBays}
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-[11px] text-[#173e49] font-medium">
                      {currentProgram.roomConfiguration.totalKeys} Keys ({currentProgram.roomConfiguration.totalBays}{' '}
                      Bays)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Room Inventory & Suite Configuration Note */}
            {currentProgram.summary.generalRemarks ? (
              <div className="mt-5 rounded-xl border border-[#eadcb1] bg-[#fbf5e7] p-4 text-[11px] leading-relaxed text-[#7c5b1b]">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Sparkles size={14} className="text-[#9a711f]" />
                  Room Inventory & Configuration Notes
                </div>
                {currentProgram.summary.generalRemarks}
              </div>
            ) : null}
          </div>

          <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Standard Room Size: <strong>{currentProgram.summary.standardRoomSizeSqm} SQ.M.</strong>
            </span>
            <span>
              Total Operational Bays: <strong>{currentProgram.summary.totalBays}</strong>
            </span>
          </div>
        </section>
      </div>

      {/* 4. MEPF Infrastructure & Site Utilities (if present in specification) */}
      {project.specification?.customFields && project.specification.customFields.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#2e7c67] font-bold">
                Infrastructure & Utilities
              </span>
              <h3 className="mt-1 text-[18px] font-extrabold text-[#173e49]">MEPF Services & Plant Capacities</h3>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {project.specification.customFields.length} Specifications Recorded
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.specification.customFields.map((field, idx) => (
              <div key={`${field.label}-${idx}`} className="rounded-xl border border-border/80 bg-[#fbfaf6] p-3.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a711f]">
                  {field.label}
                </span>
                <p className="mt-1 text-[12px] font-semibold text-[#173e49] leading-snug">{field.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inline Editor Dialog */}
      {isEditorOpen && (
        <AreaProgramEditorModal
          initialProgram={currentProgram}
          onClose={() => setIsEditorOpen(false)}
          onSave={(updated) => {
            if (onSave) {
              onSave({
                area: `${updated.summary.builtUpAreaSqm.toLocaleString()} SQ.M. / ${updated.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.`,
                paxKeys: `${updated.summary.totalRoomKeys} Keys / ${updated.summary.totalBays} Bays`,
                specification: {
                  ...(project.specification || {
                    projectType: 'Hotel',
                    units: '',
                    terminal: project.location,
                    floor: '',
                    scope: '',
                  }),
                  area: `${updated.summary.builtUpAreaSqm.toLocaleString()} SQ.M. / ${updated.summary.builtUpAreaSqft.toLocaleString()} SQ.FT.`,
                  capacity: `${updated.summary.totalRoomKeys} Keys / ${updated.summary.totalBays} Bays`,
                  areaProgram: updated,
                },
              });
              toast({
                title: 'Area Program updated',
                description: 'Changes to the architectural program have been saved to the database.',
              });
            }
            setIsEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Interactive Editor Modal for architectural area program */
export function AreaProgramEditorModal({
  initialProgram,
  onClose,
  onSave,
}: {
  initialProgram: ArchitecturalAreaProgram;
  onClose: () => void;
  onSave: (program: ArchitecturalAreaProgram) => void;
}) {
  const [draft, setDraft] = useState<ArchitecturalAreaProgram>(() => JSON.parse(JSON.stringify(initialProgram)));
  const [activeTab, setActiveTab] = useState<'summary' | 'foh' | 'bua' | 'rooms'>('summary');

  // Live Calculations
  const gfSqm = draft.fohAreas.groundFloor.reduce((acc, it) => acc + (Number(it.areaSqm) || 0), 0);
  const gfSqft = Math.round(gfSqm * 10.7639);
  const gfPax = draft.fohAreas.groundFloor.reduce((acc, it) => {
    const p = parseInt(String(it.capacityPax || '0'), 10);
    return acc + (isNaN(p) ? 0 : p);
  }, 0);

  const sfSqm = draft.fohAreas.secondFloor.reduce((acc, it) => acc + (Number(it.areaSqm) || 0), 0);
  const sfSqft = Math.round(sfSqm * 10.7639);
  const sfPax = draft.fohAreas.secondFloor.reduce((acc, it) => {
    const p = parseInt(String(it.capacityPax || '0'), 10);
    return acc + (isNaN(p) ? 0 : p);
  }, 0);

  const fohGrandSqm = gfSqm + sfSqm;
  const fohGrandSqft = gfSqft + sfSqft;

  const buaSubtotalSqm = draft.floorWiseBua.items.reduce((acc, it) => acc + (Number(it.areaSqm) || 0), 0);
  const buaSubtotalSqft = Math.round(buaSubtotalSqm * 10.7639);

  const totalKeys = draft.roomConfiguration.items.reduce((acc, it) => acc + (Number(it.keys) || 0), 0);
  const totalBays = draft.roomConfiguration.items.reduce((acc, it) => acc + (Number(it.bays) || 0), 0);

  const hasFloorItems = draft.floorWiseBua.items.length > 0;
  const effectiveBuaSqm = hasFloorItems ? buaSubtotalSqm : draft.summary.builtUpAreaSqm || 0;
  const effectiveBuaSqft = hasFloorItems
    ? buaSubtotalSqft
    : draft.summary.builtUpAreaSqft || Math.round(effectiveBuaSqm * 10.7639);

  const hasRoomItems = draft.roomConfiguration.items.length > 0;
  const effectiveKeys = hasRoomItems ? totalKeys : draft.summary.totalRoomKeys || 0;
  const effectiveBays = hasRoomItems ? totalBays : draft.summary.totalBays || 0;

  const updateSummary = <K extends keyof ArchitecturalAreaProgram['summary']>(
    key: K,
    value: ArchitecturalAreaProgram['summary'][K],
  ) => {
    setDraft((prev) => {
      const summary = { ...prev.summary, [key]: value };
      if (key === 'plotAreaSqm') {
        const num = Number(value) || 0;
        summary.plotAreaSqft = Math.round(num * 10.7639);
      }
      if (key === 'builtUpAreaSqm') {
        const num = Number(value) || 0;
        summary.builtUpAreaSqft = Math.round(num * 10.7639);
      }
      return { ...prev, summary };
    });
  };

  const handleSave = () => {
    const updated: ArchitecturalAreaProgram = {
      ...draft,
      summary: {
        ...draft.summary,
        builtUpAreaSqm: effectiveBuaSqm,
        builtUpAreaSqft: effectiveBuaSqft,
        totalRoomKeys: effectiveKeys,
        totalBays: effectiveBays,
      },
      fohAreas: {
        groundFloor: draft.fohAreas.groundFloor,
        groundFloorSubtotal: { areaSqm: gfSqm, areaSqft: gfSqft },
        secondFloor: draft.fohAreas.secondFloor,
        secondFloorSubtotal: { areaSqm: sfSqm, areaSqft: sfSqft },
        grandSubtotal: {
          areaSqm: fohGrandSqm,
          areaSqft: fohGrandSqft,
        },
      },
      floorWiseBua: {
        items: draft.floorWiseBua.items,
        subtotal: { areaSqm: buaSubtotalSqm, areaSqft: buaSubtotalSqft },
      },
      roomConfiguration: {
        items: draft.roomConfiguration.items,
        totalKeys,
        totalBays,
      },
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-5xl xl:max-w-6xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-[#f8f6f0] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#173e49] text-[#d6a95d] shadow-sm">
              <Building2 size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-extrabold text-[#173e49]">Edit Architectural Space Program</h3>
                <span className="rounded-md bg-[#e4f1ec] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2e7c67]">
                  Executive Matrix
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Manage executive metrics, FOH public areas with pax capacities, floor-wise BUA, and room inventory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live KPI Header Pill */}
            <div className="hidden lg:flex items-center gap-2 rounded-xl border border-[#eadcb1] bg-[#fffbf2] px-3 py-1.5 font-mono text-[11px]">
              <span className="font-bold text-[#173e49]">BUA: {effectiveBuaSqm.toLocaleString()} SQ.M.</span>
              <span className="text-[#9a711f] font-medium">({effectiveBuaSqft.toLocaleString()} SQ.FT.)</span>
              <span className="text-border">|</span>
              <span className="font-bold text-[#2e7c67]">
                {effectiveKeys} Keys / {effectiveBays} Bays
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex flex-wrap border-b border-border bg-muted/40 px-6 gap-2 pt-2">
          {(
            [
              { key: 'summary', label: 'Executive Summary', icon: FileText, badge: null },
              {
                key: 'foh',
                label: 'Key FOH Areas',
                icon: Sparkles,
                badge: `${draft.fohAreas.groundFloor.length + draft.fohAreas.secondFloor.length}`,
              },
              {
                key: 'bua',
                label: 'Floor-Wise BUA',
                icon: Layers,
                badge: `${draft.floorWiseBua.items.length}`,
              },
              {
                key: 'rooms',
                label: 'Room Configuration',
                icon: DoorClosed,
                badge: `${draft.roomConfiguration.items.length}`,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 border-b-2 px-4 py-3 text-[12px] font-bold transition ${
                  isActive
                    ? 'border-[#173e49] text-[#173e49]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-[#9a711f]' : 'text-muted-foreground'} />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                      isActive ? 'bg-[#173e49] text-white' : 'bg-muted border border-border text-muted-foreground'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Card 1: Site & Land Parcel */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/70 pb-3 mb-4">
                  <span className="size-2 rounded-full bg-[#9a711f]" />
                  <h4 className="text-[13px] font-extrabold uppercase tracking-wider text-[#173e49]">
                    1. Site & Land Parcel Metrics
                  </h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Plot Area (SQ.M.) *
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.summary.plotAreaSqm || ''}
                      onChange={(e) => updateSummary('plotAreaSqm', Number(e.target.value) || 0)}
                      placeholder="e.g. 8160"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      = {(draft.summary.plotAreaSqft || 0).toLocaleString()} SQ.FT. (Dual conversion)
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Plot Area (SQ.FT. Auto Calculated)
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={(draft.summary.plotAreaSqft || 0).toLocaleString()}
                      className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 font-mono text-[12px] font-bold text-muted-foreground cursor-not-allowed"
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Computed as Plot Area (SQ.M.) × 10.7639
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Site Size (Acres)
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.summary.plotAreaAcres || ''}
                      onChange={(e) => updateSummary('plotAreaAcres', Number(e.target.value) || 0)}
                      placeholder="e.g. 2.0"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Official land parcel allocation in Acres
                    </span>
                  </label>
                </div>
              </div>

              {/* Card 2: Built-Up Area (BUA) & Stacking */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#173e49]" />
                    <h4 className="text-[13px] font-extrabold uppercase tracking-wider text-[#173e49]">
                      2. Built-Up Area (BUA) & Vertical Stacking
                    </h4>
                  </div>
                  {hasFloorItems && (
                    <span className="font-mono text-[10px] font-bold text-[#2e7c67] flex items-center gap-1">
                      <CheckCircle2 size={13} /> Synced from Floor-Wise BUA Table ({draft.floorWiseBua.items.length}{' '}
                      Floors)
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Total BUA (SQ.M.) *
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={effectiveBuaSqm || ''}
                      onChange={(e) => updateSummary('builtUpAreaSqm', Number(e.target.value) || 0)}
                      placeholder="e.g. 14970"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      = {effectiveBuaSqft.toLocaleString()} SQ.FT.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Total BUA (SQ.FT. Auto)
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={effectiveBuaSqft.toLocaleString()}
                      className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 font-mono text-[12px] font-bold text-muted-foreground cursor-not-allowed"
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Dual imperial footprint representation
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Vertical Floor Stacking Description
                    </span>
                    <input
                      type="text"
                      value={draft.summary.numberOfFloorsDescription}
                      onChange={(e) => updateSummary('numberOfFloorsDescription', e.target.value)}
                      placeholder="e.g. B + G + 1 + Service + 2nd to 6th Floor"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Level summary from basement to guest levels
                    </span>
                  </label>
                </div>
              </div>

              {/* Card 3: Room Inventory & Transport */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#2e7c67]" />
                    <h4 className="text-[13px] font-extrabold uppercase tracking-wider text-[#173e49]">
                      3. Room Inventory & Vertical Transportation
                    </h4>
                  </div>
                  {hasRoomItems && (
                    <span className="font-mono text-[10px] font-bold text-[#2e7c67] flex items-center gap-1">
                      <CheckCircle2 size={13} /> Synced from Room Configuration Matrix (
                      {draft.roomConfiguration.items.length} Floors)
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Total Room Keys
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={effectiveKeys || ''}
                      onChange={(e) => updateSummary('totalRoomKeys', Number(e.target.value) || 0)}
                      placeholder="e.g. 156"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">Total Bays</span>
                    <input
                      type="number"
                      min="0"
                      value={effectiveBays || ''}
                      onChange={(e) => updateSummary('totalBays', Number(e.target.value) || 0)}
                      placeholder="e.g. 168"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Standard Room Size (SQ.M.)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.summary.standardRoomSizeSqm || ''}
                      onChange={(e) => updateSummary('standardRoomSizeSqm', Number(e.target.value) || 0)}
                      placeholder="e.g. 27"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      = {Math.round((draft.summary.standardRoomSizeSqm || 0) * 10.7639)} SQ.FT.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Number of Elevators
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={draft.summary.numberOfElevators || ''}
                      onChange={(e) => updateSummary('numberOfElevators', Number(e.target.value) || 0)}
                      placeholder="e.g. 4"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                    />
                  </label>

                  <label className="block sm:col-span-2 lg:col-span-4">
                    <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                      Elevator / Core Specification Notes
                    </span>
                    <input
                      type="text"
                      value={draft.summary.elevatorRemarks}
                      onChange={(e) => updateSummary('elevatorRemarks', e.target.value)}
                      placeholder="e.g. 2 Guest Elevators + 2 Service Lifts + 1 Dedicated Fire Tower Core"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[12px] outline-none focus:border-[#c9a04e]"
                    />
                  </label>
                </div>
              </div>

              {/* Card 4: Special Amenities & Scope Remarks */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/70 pb-3 mb-4">
                  <span className="size-2 rounded-full bg-[#173e49]" />
                  <h4 className="text-[13px] font-extrabold uppercase tracking-wider text-[#173e49]">
                    4. Special Amenities & Scope Remarks
                  </h4>
                </div>
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] font-bold text-foreground">
                    Public Facilities, Presidential Suites & Brief Notes
                  </span>
                  <textarea
                    rows={3}
                    value={draft.summary.generalRemarks || ''}
                    onChange={(e) => updateSummary('generalRemarks', e.target.value)}
                    placeholder="e.g. Banquet, ADD, Lounge Bar, Gym, Pool & 4 Presidential Suites across upper guest floors."
                    className="w-full rounded-lg border border-border bg-background p-3 text-[12px] outline-none focus:border-[#c9a04e]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: KEY FOH AREAS BIFURCATION */}
          {activeTab === 'foh' && (
            <div className="space-y-8">
              {/* Ground Floor FOH Table */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-[#3d9a7e]" />
                      <h4 className="text-[15px] font-extrabold text-[#173e49]">Ground Floor Public & Banquet Areas</h4>
                      <span className="rounded-md bg-[#e4f1ec] px-2 py-0.5 font-mono text-[11px] font-bold text-[#2e7c67]">
                        {draft.fohAreas.groundFloor.length} Allocated
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Public facilities including Banquets, Pre-function, ADD, Bars, Kitchens, and Reception.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newSNo = (draft.fohAreas.groundFloor.length || 0) + 1;
                        setDraft((prev) => ({
                          ...prev,
                          fohAreas: {
                            ...prev.fohAreas,
                            groundFloor: [
                              ...prev.fohAreas.groundFloor,
                              {
                                sNo: newSNo,
                                floor: 'Ground Floor',
                                description: 'New Public Space',
                                areaSqm: 100,
                                areaSqft: 1076,
                                capacityPax: '',
                                remarks: '',
                              },
                            ],
                          },
                        }));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#173e49] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
                    >
                      <Plus size={13} /> Add Area
                    </button>
                  </div>
                </div>

                {/* Structured Table */}
                <div className="overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pl-3 pr-2 w-12 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[200px]">Description / Facility Name</th>
                        <th className="px-3 py-2.5 w-32">Area (SQ.M.)</th>
                        <th className="px-3 py-2.5 w-28 text-muted-foreground">Area (SQ.FT.)</th>
                        <th className="px-3 py-2.5 w-28">Capacity (Pax)</th>
                        <th className="px-3 py-2.5 min-w-[180px]">Functional Remarks</th>
                        <th className="py-2.5 pl-2 pr-3 w-10 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {draft.fohAreas.groundFloor.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground text-[12px]">
                            No Ground Floor public areas entered yet. Click <strong>+ Add Area</strong> to add a public
                            facility.
                          </td>
                        </tr>
                      ) : (
                        draft.fohAreas.groundFloor.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 pl-3 pr-2 font-mono text-center text-muted-foreground text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const gf = [...prev.fohAreas.groundFloor];
                                    gf[idx] = { ...gf[idx], description: val };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, groundFloor: gf } };
                                  });
                                }}
                                placeholder="e.g. Banquet Hall"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.areaSqm}
                                onChange={(e) => {
                                  const sqm = Number(e.target.value) || 0;
                                  setDraft((prev) => {
                                    const gf = [...prev.fohAreas.groundFloor];
                                    gf[idx] = {
                                      ...gf[idx],
                                      areaSqm: sqm,
                                      areaSqft: Math.round(sqm * 10.7639),
                                    };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, groundFloor: gf } };
                                  });
                                }}
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[12px] font-semibold text-[#173e49] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                              {item.areaSqft
                                ? item.areaSqft.toLocaleString()
                                : Math.round(item.areaSqm * 10.7639).toLocaleString()}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.capacityPax || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const gf = [...prev.fohAreas.groundFloor];
                                    gf[idx] = { ...gf[idx], capacityPax: val };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, groundFloor: gf } };
                                  });
                                }}
                                placeholder="e.g. 350 Pax"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[11px] font-medium outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const gf = [...prev.fohAreas.groundFloor];
                                    gf[idx] = { ...gf[idx], remarks: val };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, groundFloor: gf } };
                                  });
                                }}
                                placeholder="e.g. Large pillarless hall"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[11px] text-muted-foreground outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="py-2 pl-2 pr-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    fohAreas: {
                                      ...prev.fohAreas,
                                      groundFloor: prev.fohAreas.groundFloor.filter((_, i) => i !== idx),
                                    },
                                  }));
                                }}
                                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Remove Area"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                        <td
                          colSpan={2}
                          className="py-3 pl-4 pr-3 text-right font-mono uppercase text-[11px] tracking-wider text-muted-foreground"
                        >
                          Ground Floor Subtotal:
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[#173e49]">
                          {gfSqm.toLocaleString()} SQ.M.
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-[#2e7c67]">
                          {gfSqft.toLocaleString()} SQ.FT.
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-[#9a711f]">
                          {gfPax > 0 ? `${gfPax.toLocaleString()} Pax` : '—'}
                        </td>
                        <td colSpan={2} className="py-3 pl-3 pr-4 text-[11px] text-muted-foreground font-normal">
                          Ground Floor core public footprint
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 2nd Floor FOH Table */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-[#d19b35]" />
                      <h4 className="text-[15px] font-extrabold text-[#173e49]">
                        2nd Floor Wellness & Recreational Areas
                      </h4>
                      <span className="rounded-md bg-[#fff8e9] px-2 py-0.5 font-mono text-[11px] font-bold text-[#9a711f]">
                        {draft.fohAreas.secondFloor.length} Allocated
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Gymnasium, outdoor deck, swimming pool, and health club facilities.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newSNo = (draft.fohAreas.secondFloor.length || 0) + 1;
                      setDraft((prev) => ({
                        ...prev,
                        fohAreas: {
                          ...prev.fohAreas,
                          secondFloor: [
                            ...prev.fohAreas.secondFloor,
                            {
                              sNo: newSNo,
                              floor: '2nd Floor',
                              description: 'New Amenity',
                              areaSqm: 100,
                              areaSqft: 1076,
                              capacityPax: '',
                              remarks: '',
                            },
                          ],
                        },
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#173e49] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
                  >
                    <Plus size={13} /> Add Area
                  </button>
                </div>

                {/* Structured Table */}
                <div className="overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pl-3 pr-2 w-12 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[200px]">Description / Amenity Name</th>
                        <th className="px-3 py-2.5 w-32">Area (SQ.M.)</th>
                        <th className="px-3 py-2.5 w-28 text-muted-foreground">Area (SQ.FT.)</th>
                        <th className="px-3 py-2.5 w-28">Capacity (Pax)</th>
                        <th className="px-3 py-2.5 min-w-[180px]">Functional Remarks</th>
                        <th className="py-2.5 pl-2 pr-3 w-10 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {draft.fohAreas.secondFloor.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground text-[12px]">
                            No 2nd Floor wellness amenities entered. Click <strong>+ Add Area</strong> to configure.
                          </td>
                        </tr>
                      ) : (
                        draft.fohAreas.secondFloor.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 pl-3 pr-2 font-mono text-center text-muted-foreground text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const sf = [...prev.fohAreas.secondFloor];
                                    sf[idx] = { ...sf[idx], description: val };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, secondFloor: sf } };
                                  });
                                }}
                                placeholder="e.g. Swimming Pool"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[12px] font-semibold outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.areaSqm}
                                onChange={(e) => {
                                  const sqm = Number(e.target.value) || 0;
                                  setDraft((prev) => {
                                    const sf = [...prev.fohAreas.secondFloor];
                                    sf[idx] = {
                                      ...sf[idx],
                                      areaSqm: sqm,
                                      areaSqft: Math.round(sqm * 10.7639),
                                    };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, secondFloor: sf } };
                                  });
                                }}
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[12px] font-semibold text-[#173e49] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                              {item.areaSqft
                                ? item.areaSqft.toLocaleString()
                                : Math.round(item.areaSqm * 10.7639).toLocaleString()}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.capacityPax || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const sf = [...prev.fohAreas.secondFloor];
                                    sf[idx] = { ...sf[idx], capacityPax: val };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, secondFloor: sf } };
                                  });
                                }}
                                placeholder="e.g. 40 Pax"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[11px] font-medium outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const sf = [...prev.fohAreas.secondFloor];
                                    sf[idx] = { ...sf[idx], remarks: val };
                                    return { ...prev, fohAreas: { ...prev.fohAreas, secondFloor: sf } };
                                  });
                                }}
                                placeholder="e.g. Temperature controlled infinity pool"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[11px] text-muted-foreground outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="py-2 pl-2 pr-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    fohAreas: {
                                      ...prev.fohAreas,
                                      secondFloor: prev.fohAreas.secondFloor.filter((_, i) => i !== idx),
                                    },
                                  }));
                                }}
                                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Remove Area"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                        <td
                          colSpan={2}
                          className="py-3 pl-4 pr-3 text-right font-mono uppercase text-[11px] tracking-wider text-muted-foreground"
                        >
                          2nd Floor Subtotal:
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[#173e49]">
                          {sfSqm.toLocaleString()} SQ.M.
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-[#2e7c67]">
                          {sfSqft.toLocaleString()} SQ.FT.
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-[#9a711f]">
                          {sfPax > 0 ? `${sfPax.toLocaleString()} Pax` : '—'}
                        </td>
                        <td colSpan={2} className="py-3 pl-3 pr-4 text-[11px] text-muted-foreground font-normal">
                          2nd Floor wellness & pool deck footprint
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Grand Total Ribbon */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#eadcb1] bg-[#fffbf2] p-4 text-[#173e49]">
                <div>
                  <h5 className="font-extrabold text-[14px]">Combined Key FOH Areas Total</h5>
                  <p className="text-[11px] text-muted-foreground">
                    Aggregated Ground Floor + 2nd Floor public facility footprint.
                  </p>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-[16px] font-extrabold text-[#173e49]">
                    {fohGrandSqm.toLocaleString()} SQ.M.
                  </span>
                  <span className="text-[14px] font-bold text-[#9a711f]">{fohGrandSqft.toLocaleString()} SQ.FT.</span>
                  <span className="rounded-md bg-[#e4f1ec] px-2.5 py-1 text-[11px] font-bold text-[#2e7c67]">
                    {(gfPax + sfPax).toLocaleString()} Total Pax
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FLOOR-WISE BUA */}
          {activeTab === 'bua' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-[#173e49]" />
                      <h4 className="text-[15px] font-extrabold text-[#173e49]">
                        Floor-Wise Built-Up Area (BUA) Allocation
                      </h4>
                      <span className="rounded-md bg-[#e4f1ec] px-2 py-0.5 font-mono text-[11px] font-bold text-[#2e7c67]">
                        {draft.floorWiseBua.items.length} Floors
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Row-by-row structural floor allocation across basement, public, services, and guest levels.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newSNo = (draft.floorWiseBua.items.length || 0) + 1;
                        setDraft((prev) => ({
                          ...prev,
                          floorWiseBua: {
                            ...prev.floorWiseBua,
                            items: [
                              ...prev.floorWiseBua.items,
                              {
                                sNo: newSNo,
                                floor: 'Additional Floor',
                                areaSqm: 1000,
                                areaSqft: 10764,
                                remarks: '',
                              },
                            ],
                          },
                        }));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#173e49] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
                    >
                      <Plus size={13} /> Add Floor Level
                    </button>
                  </div>
                </div>

                {/* Structured Table */}
                <div className="overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pl-3 pr-2 w-12 text-center">#</th>
                        <th className="px-3 py-2.5 w-52">Floor Level / Name</th>
                        <th className="px-3 py-2.5 w-36">Area (SQ.M.)</th>
                        <th className="px-3 py-2.5 w-32 text-muted-foreground">Area (SQ.FT.)</th>
                        <th className="px-3 py-2.5 min-w-[240px]">Function & Scope Remarks</th>
                        <th className="py-2.5 pl-2 pr-3 w-10 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {draft.floorWiseBua.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground text-[12px]">
                            No floor levels configured yet. Click <strong>+ Add Floor Level</strong> to configure a
                            floor level.
                          </td>
                        </tr>
                      ) : (
                        draft.floorWiseBua.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 pl-3 pr-2 font-mono text-center text-muted-foreground text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.floor}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const items = [...prev.floorWiseBua.items];
                                    items[idx] = { ...items[idx], floor: val };
                                    return { ...prev, floorWiseBua: { ...prev.floorWiseBua, items } };
                                  });
                                }}
                                placeholder="e.g. Ground Floor"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[12px] font-bold text-[#173e49] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.areaSqm}
                                onChange={(e) => {
                                  const sqm = Number(e.target.value) || 0;
                                  setDraft((prev) => {
                                    const items = [...prev.floorWiseBua.items];
                                    items[idx] = {
                                      ...items[idx],
                                      areaSqm: sqm,
                                      areaSqft: Math.round(sqm * 10.7639),
                                    };
                                    return { ...prev, floorWiseBua: { ...prev.floorWiseBua, items } };
                                  });
                                }}
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[12px] font-semibold text-[#173e49] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                              {item.areaSqft
                                ? item.areaSqft.toLocaleString()
                                : Math.round(item.areaSqm * 10.7639).toLocaleString()}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const items = [...prev.floorWiseBua.items];
                                    items[idx] = { ...items[idx], remarks: val };
                                    return { ...prev, floorWiseBua: { ...prev.floorWiseBua, items } };
                                  });
                                }}
                                placeholder="e.g. Reception, Banquet, ADD, Lounge Bar"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[11px] text-muted-foreground outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="py-2 pl-2 pr-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    floorWiseBua: {
                                      ...prev.floorWiseBua,
                                      items: prev.floorWiseBua.items.filter((_, i) => i !== idx),
                                    },
                                  }));
                                }}
                                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Remove Floor Level"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                        <td
                          colSpan={2}
                          className="py-3 pl-4 pr-3 text-right font-mono uppercase text-[11px] tracking-wider text-muted-foreground"
                        >
                          Total Floor-Wise BUA ({draft.floorWiseBua.items.length} Floors):
                        </td>
                        <td className="px-3 py-3 font-mono text-[13px] text-[#173e49]">
                          {buaSubtotalSqm.toLocaleString()} SQ.M.
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[#2e7c67]">
                          {buaSubtotalSqft.toLocaleString()} SQ.FT.
                        </td>
                        <td colSpan={2} className="py-3 pl-3 pr-4 text-[11px] text-muted-foreground font-normal">
                          Auto-synchronizes to Total BUA on Executive Summary
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ROOM CONFIGURATION MATRIX */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-[#2e7c67]" />
                      <h4 className="text-[15px] font-extrabold text-[#173e49]">
                        Guest Floor Room Inventory & Bay Matrix
                      </h4>
                      <span className="rounded-md bg-[#e4f1ec] px-2 py-0.5 font-mono text-[11px] font-bold text-[#2e7c67]">
                        {draft.roomConfiguration.items.length} Guest Floors
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Floor-wise breakdown of guest keys, architectural bays, and presidential / executive suite
                      distribution.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newSNo = (draft.roomConfiguration.items.length || 0) + 1;
                        setDraft((prev) => ({
                          ...prev,
                          roomConfiguration: {
                            ...prev.roomConfiguration,
                            items: [
                              ...prev.roomConfiguration.items,
                              {
                                sNo: newSNo,
                                floor: 'Guest Floor',
                                keys: 30,
                                bays: 30,
                                remarks: 'Standard Deluxe Rooms',
                              },
                            ],
                          },
                        }));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#173e49] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
                    >
                      <Plus size={13} /> Add Guest Floor
                    </button>
                  </div>
                </div>

                {/* Structured Table */}
                <div className="overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pl-3 pr-2 w-12 text-center">#</th>
                        <th className="px-3 py-2.5 w-52">Guest Floor Level</th>
                        <th className="px-3 py-2.5 w-28 text-center">Keys</th>
                        <th className="px-3 py-2.5 w-28 text-center">Bays</th>
                        <th className="px-3 py-2.5 min-w-[240px]">Room Types & Suite Configuration</th>
                        <th className="py-2.5 pl-2 pr-3 w-10 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {draft.roomConfiguration.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground text-[12px]">
                            No guest floors configured yet. Click <strong>+ Add Guest Floor</strong> to add room
                            inventory.
                          </td>
                        </tr>
                      ) : (
                        draft.roomConfiguration.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 pl-3 pr-2 font-mono text-center text-muted-foreground text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.floor}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const items = [...prev.roomConfiguration.items];
                                    items[idx] = { ...items[idx], floor: val };
                                    return { ...prev, roomConfiguration: { ...prev.roomConfiguration, items } };
                                  });
                                }}
                                placeholder="e.g. 2nd Guest Floor"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[12px] font-bold text-[#173e49] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="0"
                                value={item.keys}
                                onChange={(e) => {
                                  const keys = Number(e.target.value) || 0;
                                  setDraft((prev) => {
                                    const items = [...prev.roomConfiguration.items];
                                    items[idx] = { ...items[idx], keys };
                                    return { ...prev, roomConfiguration: { ...prev.roomConfiguration, items } };
                                  });
                                }}
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 font-mono text-center text-[12px] font-bold text-[#173e49] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="0"
                                value={item.bays}
                                onChange={(e) => {
                                  const bays = Number(e.target.value) || 0;
                                  setDraft((prev) => {
                                    const items = [...prev.roomConfiguration.items];
                                    items[idx] = { ...items[idx], bays };
                                    return { ...prev, roomConfiguration: { ...prev.roomConfiguration, items } };
                                  });
                                }}
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 font-mono text-center text-[12px] font-semibold text-[#2e7c67] outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraft((prev) => {
                                    const items = [...prev.roomConfiguration.items];
                                    items[idx] = { ...items[idx], remarks: val };
                                    return { ...prev, roomConfiguration: { ...prev.roomConfiguration, items } };
                                  });
                                }}
                                placeholder="e.g. 28 Deluxe Rooms (28 Bays) + 2 Suites (4 Bays)"
                                className="h-8.5 w-full rounded-md border border-border bg-background px-2.5 text-[11px] text-muted-foreground outline-none focus:border-[#c9a04e]"
                              />
                            </td>
                            <td className="py-2 pl-2 pr-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    roomConfiguration: {
                                      ...prev.roomConfiguration,
                                      items: prev.roomConfiguration.items.filter((_, i) => i !== idx),
                                    },
                                  }));
                                }}
                                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Remove Guest Floor"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                        <td
                          colSpan={2}
                          className="py-3 pl-4 pr-3 text-right font-mono uppercase text-[11px] tracking-wider text-muted-foreground"
                        >
                          Total Room Inventory ({draft.roomConfiguration.items.length} Floors):
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-[13px] text-[#173e49]">{totalKeys} Keys</td>
                        <td className="px-3 py-3 text-center font-mono text-[12px] text-[#2e7c67]">{totalBays} Bays</td>
                        <td colSpan={2} className="py-3 pl-3 pr-4 text-[11px] text-muted-foreground font-normal">
                          Auto-synchronizes to Total Keys & Bays on Executive Summary
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border bg-[#f8f6f0] px-6 py-4">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Info size={15} className="text-[#9a711f]" />
            <span>
              Ready to apply: <strong>{effectiveBuaSqm.toLocaleString()} SQ.M.</strong> •{' '}
              <strong>
                {effectiveKeys} Keys / {effectiveBays} Bays
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-6 py-2.5 text-[12px] font-bold text-white shadow-md hover:bg-[#205160] transition"
            >
              <Save size={15} /> Save Architectural Program
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
