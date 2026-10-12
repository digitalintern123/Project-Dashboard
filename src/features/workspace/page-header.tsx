import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#9a711f]">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-[42px] leading-none tracking-[-.05em] text-[#173e49] md:text-[52px]">
          {title}
        </h1>
        <p className="mt-4 max-w-[620px] text-[13px] leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
