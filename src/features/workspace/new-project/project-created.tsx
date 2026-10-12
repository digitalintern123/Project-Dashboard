import { Link } from 'wouter';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';

/** Confirmation screen shown after a project has been created. */
export function ProjectCreated({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-[760px] py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e4f1ec] text-[#2e7c67]">
        <CheckCircle2 size={25} />
      </span>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[.16em] text-[#2e7c67]">Project created</p>
      <h1 className="mt-3 font-serif text-[44px] leading-none tracking-[-.05em] text-[#173e49]">
        {name} is ready for updates.
      </h1>
      <p className="mx-auto mt-4 max-w-[480px] text-[13px] leading-6 text-muted-foreground">
        The project is saved and synced with the portfolio database.
      </p>
      <Link
        href="/projects"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[11px] font-bold text-white"
      >
        View all projects <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
