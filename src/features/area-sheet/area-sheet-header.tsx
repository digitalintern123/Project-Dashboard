import { Download, FileSpreadsheet, Printer } from 'lucide-react';

export function AreaSheetHeader({ onExportCsv }: { onExportCsv: () => void }) {
  return (
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end border-b border-border/80 pb-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[#edf5f0] text-[#2e7c67]">
            <FileSpreadsheet size={15} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#9a711f]">
            Official Master Register · Source: 3rd PDF
          </p>
        </div>
        <h1 className="mt-3 font-serif text-[38px] leading-none tracking-[-.05em] text-[#173e49] md:text-[48px]">
          Project Area Sheet
        </h1>
        <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-muted-foreground">
          Complete facility register from the authentic master <strong>Project Area Sheet</strong>: 66 operational and
          under-construction lounges, wellness spas, central production kitchens, and infrastructure facilities, plus 2
          airport hotels.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-[#cbe4d9] bg-[#edf5f0] px-4 py-2.5 text-[11px] font-bold text-[#2e7c67] hover:bg-[#dfeee5] transition shadow-xs"
        >
          <Download size={14} /> Export CSV
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[11px] font-bold text-foreground hover:bg-muted transition shadow-xs"
        >
          <Printer size={14} /> Print
        </button>
      </div>
    </div>
  );
}
