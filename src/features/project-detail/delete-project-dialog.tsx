import { Trash2 } from 'lucide-react';

export function DeleteProjectDialog({
  projectName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  projectName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-rose-600">
          <span className="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-700">
            <Trash2 size={20} />
          </span>
          <h3 className="text-[17px] font-bold text-foreground">Delete Project</h3>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Are you sure you want to permanently delete{' '}
          <strong className="font-semibold text-foreground">"{projectName}"</strong>? This will permanently remove all
          associated stages, milestones, issues, and progress updates from the database.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[11px] font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Yes, delete project'}
          </button>
        </div>
      </div>
    </div>
  );
}
