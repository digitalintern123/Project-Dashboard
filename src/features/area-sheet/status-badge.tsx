export function StatusBadge({ status }: { status: string }) {
  if (status.includes('Operational')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f1ec] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#2e7c67]">
        <span className="size-1.5 rounded-full bg-[#3d9a7e]" />
        Operational / Handed-over
      </span>
    );
  }
  if (status.includes('Under Construction')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f8edcf] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#9a711f]">
        <span className="size-1.5 rounded-full bg-[#d19b35]" />
        Under Construction
      </span>
    );
  }
  if (status.includes('HOLD')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fae5e1] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#b2473d]">
        <span className="size-1.5 rounded-full bg-[#d66254]" />
        HOLD
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0ed] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#69716b]">
      <span className="size-1.5 rounded-full bg-[#8c938d]" />
      Yet to start
    </span>
  );
}
