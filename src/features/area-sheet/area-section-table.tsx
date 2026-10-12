import { Link } from 'wouter';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { SheetItem } from './sheet-items';
import { StatusBadge } from './status-badge';

/** Presentation differences between the three Area Sheet sections. */
export interface AreaSectionConfig {
  /** Tailwind background class for the heading dot. */
  dotClassName: string;
  title: string;
  /** Classes for the count pill beside the heading. */
  countBadgeClassName: string;
  /** Noun after the count, e.g. "facilities" or "hotels". */
  countNoun: string;
  /** Header label of the facility name column. */
  nameColumnLabel: string;
  /** Classes for the facility name link. */
  nameLinkClassName: string;
  /** Whether to append the project's pax/keys after its code. */
  showPaxKeys: boolean;
  subtotalLabel: string;
  /** Text colour class for the SQ.FT. subtotal cell. */
  subtotalClassName: string;
}

function AreaSheetRow({ item, config }: { item: SheetItem; config: AreaSectionConfig }) {
  return (
    <tr className="hover:bg-[#fbf9f4] transition">
      <td className="py-3 pl-4 pr-2 font-mono text-[10px] font-bold text-center text-muted-foreground">{item.slNo}</td>
      <td className="px-3 py-3 font-semibold text-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin size={10} className="text-muted-foreground" />
          {item.location}
        </span>
      </td>
      <td className="px-3 py-3">
        <Link href={`/project/${item.project.id}`} className={config.nameLinkClassName}>
          {item.name}
        </Link>
        <span className="ml-2 font-mono text-[9px] text-muted-foreground">
          {config.showPaxKeys ? (
            <>
              {item.code} · {item.project.paxKeys}
            </>
          ) : (
            item.code
          )}
        </span>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-3 py-3 text-right font-mono text-[11px] font-bold text-foreground">
        {item.areaSqft ? item.areaSqft.toLocaleString() : '—'}
      </td>
      <td className="px-3 py-3 text-right font-mono text-[10px] text-muted-foreground hidden md:table-cell">
        {item.areaSqm ? item.areaSqm.toLocaleString() : '—'}
      </td>
      <td className="py-3 pl-2 pr-4 text-right">
        <Link
          href={`/project/${item.project.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-bold hover:bg-[#edf5f0] hover:text-[#2e7c67] transition"
        >
          View <ArrowUpRight size={11} />
        </Link>
      </td>
    </tr>
  );
}

export function AreaSectionTable({ items, config }: { items: SheetItem[]; config: AreaSectionConfig }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${config.dotClassName}`} />
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">{config.title}</h2>
          <span className={config.countBadgeClassName}>
            {items.length} {config.countNoun}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
          Subtotal: {items.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                <th className="py-3 pl-4 pr-2 w-16 text-center">SL No</th>
                <th className="px-3 py-3 w-28">Location</th>
                <th className="px-3 py-3 min-w-[240px]">{config.nameColumnLabel}</th>
                <th className="px-3 py-3 w-48">Project Status</th>
                <th className="px-3 py-3 text-right w-36">Area (SQ.FT.)</th>
                <th className="px-3 py-3 text-right w-32 hidden md:table-cell">Area (SQ.M.)</th>
                <th className="py-3 pl-2 pr-4 text-right w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((item) => (
                <AreaSheetRow key={item.project.id} item={item} config={config} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-[#f8f6f0] font-bold">
                <td colSpan={4} className="py-3 pl-4 pr-3">
                  {config.subtotalLabel}
                </td>
                <td className={`px-3 py-3 text-right font-mono text-[12px] ${config.subtotalClassName}`}>
                  {items.reduce((acc, i) => acc + (i.areaSqft || 0), 0).toLocaleString()} SQ.FT.
                </td>
                <td className="px-3 py-3 text-right font-mono text-[11px] text-muted-foreground hidden md:table-cell">
                  {items.reduce((acc, i) => acc + (i.areaSqm || 0), 0).toLocaleString()} SQ.M.
                </td>
                <td className="py-3 pr-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
