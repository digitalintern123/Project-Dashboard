import { Link } from 'wouter';
import { formatCrore } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import {
  formatRatio,
  getCommercialSummary,
  getPortfolioCommercialSummary,
  sortProjectsIncompleteFirst,
} from '@/lib/calculations';
import { PageHeader } from './page-header';

export function CommercialView() {
  const { projects, canEdit } = useAppState();
  const portfolio = getPortfolioCommercialSummary(projects);
  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Budget & AOP"
        description="Portfolio-level capital position, with a project view of Approved Budget (AOP), Committed Cost, Projected Cost, and Spent Till Date."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
              Approved Budget (AOP)
            </p>
            <p className="mt-4 text-[27px] font-extrabold">{formatCrore(portfolio.totalAop)}</p>
          </div>
          <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
            <div>{formatCrore(portfolio.totalAwarded)} committed</div>
            <div>{formatCrore(portfolio.totalSpent)} spent</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Committed / Awarded</p>
            <p className="mt-4 text-[27px] font-extrabold">{formatCrore(portfolio.totalAwarded)}</p>
          </div>
          <p className="mt-2 text-[10px] text-[#2e7c67]">{formatRatio(portfolio.awardRatePct)} commitment rate</p>
        </div>
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            portfolio.totalProjectedCost > portfolio.totalAop
              ? 'border-[#f0c8c2] bg-[#fff6f5]'
              : 'border-border bg-card'
          }`}
        >
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Projected Cost</p>
            <p
              className={`mt-4 text-[27px] font-extrabold ${
                portfolio.totalProjectedCost > portfolio.totalAop ? 'text-[#b2473d]' : ''
              }`}
            >
              {formatCrore(portfolio.totalProjectedCost)}
            </p>
          </div>
          <p
            className={`mt-2 text-[10px] font-bold ${
              portfolio.totalProjectedCost > portfolio.totalAop ? 'text-[#b2473d]' : 'text-muted-foreground'
            }`}
          >
            Variance: {portfolio.totalProjectedCost >= portfolio.totalAop ? '+' : ''}
            {formatCrore(portfolio.totalProjectedCost - portfolio.totalAop)}
            {portfolio.totalProjectedCost > portfolio.totalAop && ' (Over Budget)'}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Spent Till Date</p>
            <p className="mt-4 text-[27px] font-extrabold">{formatCrore(portfolio.totalSpent)}</p>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{formatRatio(portfolio.spentRatePct)} of awarded</p>
        </div>
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(180px,1.2fr)_110px_110px_110px_110px_110px_90px_80px] gap-3 border-b border-border bg-[#f7f4ec] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground md:grid">
          <span>Project</span>
          <span>Approved (AOP)</span>
          <span>Committed</span>
          <span>Projected</span>
          <span>Spent</span>
          <span>Cost Variance</span>
          <span>Status</span>
          <span>Access</span>
        </div>
        {projects.length === 0 && (
          <p className="px-5 py-10 text-center text-[12px] text-muted-foreground">
            No projects found. Create a project to view commercials.
          </p>
        )}
        {sortProjectsIncompleteFirst(projects).map((project) => {
          const commercial = getCommercialSummary(project);
          return (
            <div
              key={project.id}
              className={`grid gap-2 border-b border-border/70 px-5 py-4 md:grid-cols-[minmax(180px,1.2fr)_110px_110px_110px_110px_110px_90px_80px] md:items-center transition-colors ${
                commercial.overBudget ? 'bg-[#fffbfb] hover:bg-[#fff5f5]' : 'hover:bg-muted/30'
              }`}
            >
              <Link
                href={`/project/${project.id}`}
                className="text-[12px] font-bold hover:text-[#2e7c67] flex items-center gap-1.5"
              >
                {commercial.overBudget && (
                  <span title="Over Budget" className="inline-block size-2 rounded-full bg-[#d66254] shrink-0" />
                )}
                <span className="truncate">{project.name}</span>
              </Link>
              <span className="text-[11px] font-mono">{formatCrore(commercial.aop)}</span>
              <span className={`text-[11px] font-mono ${commercial.overAwarded ? 'font-bold text-[#b2473d]' : ''}`}>
                {formatCrore(commercial.awarded)}
                {commercial.overAwarded && (
                  <span className="block text-[8px] uppercase font-bold tracking-wider text-[#b2473d]">Over AOP</span>
                )}
              </span>
              <span
                className={`text-[11px] font-mono font-semibold ${commercial.overBudget ? 'font-bold text-[#b2473d]' : ''}`}
              >
                {formatCrore(commercial.projectedCost)}
                {commercial.overBudget && (
                  <span className="block text-[8px] uppercase font-bold tracking-wider text-[#b2473d]">Overrun</span>
                )}
              </span>
              <span className={`text-[11px] font-mono ${commercial.overSpent ? 'font-bold text-[#b2473d]' : ''}`}>
                {formatCrore(commercial.spent)}
                {commercial.overSpent && (
                  <span className="block text-[8px] uppercase font-bold tracking-wider text-[#b2473d]">
                    Over Awarded
                  </span>
                )}
              </span>
              <div>
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-mono font-bold ${
                    commercial.costVariance > 0
                      ? 'bg-[#fae5e1] text-[#b2473d]'
                      : commercial.costVariance < 0
                        ? 'bg-[#edf5f0] text-[#2e7c67]'
                        : 'text-muted-foreground'
                  }`}
                >
                  {commercial.costVariance > 0
                    ? `+${formatCrore(commercial.costVariance)}`
                    : formatCrore(commercial.costVariance)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">{project.status || 'Yet to start'}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">
                {canEdit ? 'Editable' : 'View only'}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
