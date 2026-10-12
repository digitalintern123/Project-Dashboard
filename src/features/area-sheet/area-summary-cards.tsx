import { Activity, Building2, CircleDollarSign, Maximize2 } from 'lucide-react';
import type { SheetMetrics } from './sheet-items';

export function AreaSummaryCards({ metrics }: { metrics: SheetMetrics }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Total Portfolio</span>
          <Building2 size={16} className="text-muted-foreground/60" />
        </div>
        <p className="mt-4 text-[28px] font-extrabold tracking-[-.04em] text-foreground">{metrics.totalFacilities}</p>
        <p className="mt-1 font-mono text-[10px] text-[#2e7c67]">
          {metrics.operationalCount} Operational · {metrics.pipelineCount} Pipeline
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
            Total Built-Up Area
          </span>
          <Maximize2 size={16} className="text-muted-foreground/60" />
        </div>
        <p className="mt-4 text-[24px] font-extrabold tracking-[-.04em] text-foreground">
          {metrics.totalSqft.toLocaleString()}{' '}
          <span className="text-[14px] font-bold text-muted-foreground">SQ.FT.</span>
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          Approx. {metrics.totalSqm.toLocaleString()} SQ.M.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
            Lounges & Wellness
          </span>
          <Activity size={16} className="text-[#2e7c67]" />
        </div>
        <p className="mt-4 text-[24px] font-extrabold tracking-[-.04em] text-[#173e49]">
          {metrics.loungeSqft.toLocaleString()}{' '}
          <span className="text-[14px] font-bold text-muted-foreground">SQ.FT.</span>
        </p>
        <p className="mt-1 font-mono text-[10px] text-[#2e7c67]">42 Facilities across Delhi, Hyd, Goa, Vizag</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
            Kitchen & Misc Facilities
          </span>
          <CircleDollarSign size={16} className="text-[#9a711f]" />
        </div>
        <p className="mt-4 text-[24px] font-extrabold tracking-[-.04em] text-[#9a711f]">
          {metrics.kitchenSqft.toLocaleString()}{' '}
          <span className="text-[14px] font-bold text-muted-foreground">SQ.FT.</span>
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">24 Commissary, Kitchen & Back-Office Units</p>
      </div>
    </div>
  );
}
