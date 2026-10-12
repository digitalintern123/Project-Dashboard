import type { Dispatch, SetStateAction } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { Project } from '@/data/projects';
import { ProjectCard, ProjectRow } from './project-row';

interface PortfolioRegisterProps {
  filteredProjects: Project[];
  portfolioExpanded: boolean;
  setPortfolioExpanded: Dispatch<SetStateAction<boolean>>;
}

/** Desktop register table plus the stacked card list shown on small screens. */
export function PortfolioRegister({
  filteredProjects,
  portfolioExpanded,
  setPortfolioExpanded,
}: PortfolioRegisterProps) {
  return (
    <>
      <div
        className={`mt-4 hidden overflow-x-auto rounded-2xl border border-[#e1dccf] bg-[#f7f4ec] text-[#173e49] shadow-sm shadow-[#173e49]/[.03] md:block [&>a]:!bg-[#f7f4ec] [&>a]:!text-[#173e49] [&>a:hover]:!bg-[#fcf5e5] ${portfolioExpanded ? 'max-h-none' : 'max-h-[560px] overflow-y-auto'}`}
        style={{ backgroundColor: '#f7f4ec' }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border bg-[#f7f4ec] px-5 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
            Portfolio register
          </span>
          <button
            type="button"
            onClick={() => setPortfolioExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-expanded={portfolioExpanded}
          >
            {portfolioExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{portfolioExpanded ? 'Standard view' : 'Expand full width'}</span>
          </button>
        </div>
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(180px,1.2fr)_105px_95px_110px_90px_90px_105px_24px] gap-3 border-b border-border bg-[#f7f4ec] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
          <span>Project</span>
          <span>Status</span>
          <span>Health</span>
          <span>Progress</span>
          <span>AOP</span>
          <span>Spent</span>
          <span>Target date</span>
          <span />
        </div>
        {filteredProjects.length ? (
          filteredProjects.map((project, index) => <ProjectRow key={project.id} project={project} index={index} />)
        ) : (
          <div className="p-10 text-center text-[12px] text-muted-foreground">
            No projects match this view. Try a broader search.
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:hidden">
        {filteredProjects.length ? (
          filteredProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">
            No projects match this view.
          </div>
        )}
      </div>
    </>
  );
}
