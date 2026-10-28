import { useState } from 'react';
import { Link } from 'wouter';
import { MapPin, Trash2 } from 'lucide-react';
import type { Project } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { healthTone, statusTone } from '@/lib/tones';
import { leadName } from '@/data/users';
import { projectProgressTone } from '@/lib/progress-tone';
import { errorMessage } from '@/lib/utils';

export function ProjectTable({ rows }: { rows: Project[] }) {
  const { deleteProject, role } = useAppState();
  const { toast } = useToast();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <>
      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-border bg-[#f8f6f0] font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground whitespace-nowrap">
                <th className="py-3.5 pl-5 pr-3 min-w-[220px]">Project</th>
                <th className="px-3 py-3.5 w-28">Location</th>
                <th className="px-3 py-3.5 w-36">Status</th>
                <th className="px-3 py-3.5 w-32">Area</th>
                <th className="px-3 py-3.5 w-36">Lead</th>
                <th className="px-3 py-3.5 w-36">Progress</th>
                <th className="px-3 py-3.5 w-28">Target</th>
                <th className="px-3 py-3.5 w-28">Health</th>
                <th className="py-3.5 pl-2 pr-5 text-right w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[12px] text-muted-foreground">
                    No projects match this view. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                rows.map((project) => (
                  <tr key={project.id} className="transition hover:bg-[#fcfaf5]">
                    <td className="py-3.5 pl-5 pr-3">
                      <Link href={`/project/${project.id}`} className="group inline-block">
                        <span className="block text-[12px] font-bold text-foreground group-hover:text-[#2e7c67] group-hover:underline transition">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">
                          {project.code}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <MapPin size={11} className="text-muted-foreground/70" />
                        {project.location}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}
                      >
                        {project.status || 'Yet to start'}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3.5 whitespace-nowrap font-mono text-[10px] font-bold text-foreground"
                      title={project.area || '—'}
                    >
                      {project.area ? (
                        project.area.includes('SQ.FT.') ? (
                          project.area.split('/')[1]?.trim() || project.area
                        ) : (
                          project.area
                        )
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap font-medium text-foreground">
                      {leadName(project.leadId)}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5 min-w-[100px]">
                        <div
                          className="h-1.5 w-16 rounded-full bg-[#e7e7dc] overflow-hidden"
                          title={projectProgressTone(project).reason}
                        >
                          <div
                            data-tone={projectProgressTone(project).key}
                            className={`h-full rounded-full ${projectProgressTone(project).bar} transition-all`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-foreground">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap font-medium text-muted-foreground">
                      {project.targetLabel}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${healthTone[project.health]}`}
                      >
                        {project.health}
                      </span>
                    </td>
                    <td className="py-3.5 pl-2 pr-5 text-right whitespace-nowrap">
                      {role === 'coordinator' ? (
                        <button
                          type="button"
                          title={`Delete ${project.name}`}
                          onClick={() => setProjectToDelete(project)}
                          className="inline-grid size-7 place-items-center rounded-lg text-muted-foreground/60 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span className="inline-block size-7" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {projectToDelete && (
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
              <strong className="font-semibold text-foreground">"{projectToDelete.name}"</strong>? This will remove all
              associated stages, milestones, and issues from the database.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProjectToDelete(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const success = await deleteProject(projectToDelete.id);
                    if (success) {
                      toast({
                        title: 'Project deleted',
                        description: `"${projectToDelete.name}" was permanently removed.`,
                      });
                      setProjectToDelete(null);
                    } else {
                      toast({
                        variant: 'destructive',
                        title: 'Delete failed',
                        description: 'Could not delete project from database.',
                      });
                    }
                  } catch (err) {
                    toast({
                      variant: 'destructive',
                      title: 'Delete failed',
                      description: errorMessage(err, 'An error occurred.'),
                    });
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[11px] font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
