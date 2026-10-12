import { type CommercialEdit } from './use-commercial-edit';

export function CommercialEditForm({ edit }: { edit: CommercialEdit }) {
  const {
    setEditing,
    aop,
    setAop,
    awarded,
    setAwarded,
    spent,
    setSpent,
    projectedCost,
    setProjectedCost,
    commercialError,
    submit,
  } = edit;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-4">
      <p className="text-[11px] font-extrabold">Edit commercial values (in ₹ Cr)</p>
      {commercialError && (
        <p role="alert" className="rounded-lg bg-[#fae5e1] px-3 py-2 text-[10px] font-semibold text-[#b2473d]">
          {commercialError}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <label>
          <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Approved AOP</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={aop}
            onChange={(event) => setAop(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Committed Cost</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={awarded}
            onChange={(event) => setAwarded(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Projected Cost</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={projectedCost}
            onChange={(event) => setProjectedCost(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Spent Till Date</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={spent}
            onChange={(event) => setSpent(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[11px]"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-[#173e49] px-3 py-2 text-[10px] font-bold text-white">
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-border px-3 py-2 text-[10px] font-bold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
