import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

export function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-20 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Project not found</p>
      <h1 className="mt-3 font-serif text-4xl text-[#173e49]">That project is not in this portfolio.</h1>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-[12px] font-bold text-primary-foreground"
      >
        <ArrowLeft size={14} /> Return to portfolio
      </Link>
    </div>
  );
}
