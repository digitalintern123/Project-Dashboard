import { Link } from 'wouter';
import { ArrowLeft, Compass } from 'lucide-react';

/**
 * Shown for any unmatched route. The previous version asked the visitor
 * "Did you forget to add the page to the router?" — a developer note that
 * reached end users, with no way back.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-5 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-[#f8edcf] text-[#9a711f]">
        <Compass size={25} />
      </span>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
        Page not found
      </p>
      <h1 className="mt-3 font-serif text-[44px] leading-none tracking-[-.05em] text-[#173e49]">
        This page isn&rsquo;t part of the workspace.
      </h1>
      <p className="mt-4 max-w-[440px] text-[13px] leading-6 text-muted-foreground">
        The link may be out of date, or the project it pointed to has been removed.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[11px] font-bold text-white hover:bg-[#204f59]"
      >
        <ArrowLeft size={15} /> Back to portfolio
      </Link>
    </div>
  );
}
