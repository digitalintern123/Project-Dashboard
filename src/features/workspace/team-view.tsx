import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { UserPlus } from 'lucide-react';
import { useAppState } from '@/state/app-state';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { statusTone } from '@/lib/tones';
import { initialsOf, leadName } from '@/data/users';
import { errorMessage } from '@/lib/utils';
import { PageHeader } from './page-header';

export function TeamView() {
  const { leads, projects, createLead, allotProject, role } = useAppState();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('Project Lead');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [allottingProjectId, setAllottingProjectId] = useState<string | null>(null);

  const handleResetPassword = async (lead: { id: string; name: string }) => {
    if (!window.confirm(`Reset the password for ${lead.name}? They will have to choose a new one at next sign-in.`))
      return;
    try {
      const res = await api.auth.resetPassword(lead.id);
      window.prompt(
        `Temporary password for ${lead.name}. Copy it now and share it securely; it will not be shown again.`,
        res.temporaryPassword,
      );
    } catch (err) {
      toast({
        title: 'Password reset failed',
        description: errorMessage(err, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please provide a name, email, and password.');
      return;
    }
    if (password.trim().length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('The temporary password must be at least 10 characters and include letters and numbers.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await createLead({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        title: title.trim() || 'Project Lead',
      });
      if (res.success && res.lead) {
        toast({
          title: 'Project Lead Created',
          description: `Account created for ${res.lead.name}. They sign in with ${res.lead.email} and must set a new password at first sign-in.`,
        });
        setName('');
        setEmail('');
        setPassword('');
        setTitle('Project Lead');
      } else {
        setError(res.error || 'Failed to create lead account');
      }
    } catch (err) {
      setError(errorMessage(err, 'Error creating lead'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllot = async (projectId: string, leadId: string) => {
    setAllottingProjectId(projectId);
    const res = await allotProject(projectId, leadId);
    setAllottingProjectId(null);
    if (res.success) {
      const lead = leads.find((l) => l.id === leadId);
      const project = projects.find((p) => p.id === projectId);
      toast({
        title: 'Project Allotted',
        description: `${project?.name || 'Project'} assigned to ${lead?.name || 'lead'}.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Allotment failed',
        description: res.error || 'Could not allot project',
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Project Coordinator Workspace"
        title="Team & Project Allotment"
        description="Create Project Leads with real credentials, assign and allot projects, and manage portfolio ownership."
      />

      <div className="mt-8 grid gap-7 lg:grid-cols-[1.05fr_1.95fr]">
        {/* Left Column: Create Project Lead */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#ebdcb9] text-[#664b14]">
                <UserPlus size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-extrabold text-[#173e49]">Create Project Lead</h2>
                <p className="text-[11px] text-muted-foreground">Add a new Project Lead to the system</p>
              </div>
            </div>

            <form onSubmit={handleCreateLead} className="mt-5 space-y-4">
              {error && <p className="rounded-xl bg-[#fae5e1] p-3 text-[11px] font-bold text-[#b2473d]">{error}</p>}

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Full Name *</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Karan Verma"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#d6a95d]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Email Address *</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. karan.verma@encalm.com"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#d6a95d]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Initial Password *</span>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Temporary password (10+ chars, letters and numbers)"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] font-mono outline-none focus:border-[#d6a95d]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-[#173e49]">Role Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Project Lead"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[12px] outline-none focus:border-[#d6a95d]"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3 text-[12px] font-extrabold text-[#173e49] hover:bg-[#e2bd73] transition disabled:opacity-50"
              >
                <UserPlus size={15} /> {submitting ? 'Creating Lead...' : 'Create Project Lead Account'}
              </button>
            </form>
          </section>

          {/* Active Leads Roster Card */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-extrabold text-[#173e49]">Active Project Leads ({leads.length})</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                Live Roster
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {leads.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No leads found in database.</p>
              ) : (
                leads.map((lead) => {
                  const assignedProjects = projects.filter((p) => p.leadId === lead.id);
                  return (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-border bg-background p-3.5 transition hover:border-[#eadcb1]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-full bg-[#173e49] text-[10px] font-bold text-white">
                            {lead.initials}
                          </span>
                          <div>
                            <p className="text-[12px] font-bold text-foreground">{lead.name}</p>
                            <p className="font-mono text-[9px] text-muted-foreground">{lead.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="rounded-full bg-[#eef0ed] px-2 py-0.5 font-mono text-[9px] font-bold text-muted-foreground">
                            {assignedProjects.length} {assignedProjects.length === 1 ? 'project' : 'projects'}
                          </span>
                          {role === 'coordinator' && (
                            <button
                              type="button"
                              onClick={() => handleResetPassword(lead)}
                              className="text-[9px] font-bold text-[#9a711f] hover:underline"
                            >
                              Reset password
                            </button>
                          )}
                        </div>
                      </div>

                      {assignedProjects.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                          {assignedProjects.map((p) => (
                            <Link
                              key={p.id}
                              href={`/project/${p.id}`}
                              className="rounded-md bg-card px-2 py-0.5 text-[9px] font-semibold text-muted-foreground hover:text-foreground border border-border hover:border-[#d6a95d]"
                            >
                              {p.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Project Allotment Matrix */}
        <div>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-[16px] font-extrabold text-[#173e49]">Project Allotment & Ownership</h2>
                <p className="text-[11px] text-muted-foreground">
                  Assign projects to leads. Changes are saved directly to the database.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">
                Total Projects: {projects.length}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {projects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-10 text-center text-[12px] text-muted-foreground">
                  No projects in portfolio.
                </p>
              ) : (
                projects.map((project) => {
                  const currentLead = leads.find((l) => l.id === project.leadId);
                  const isAllotting = allottingProjectId === project.id;

                  return (
                    <div
                      key={project.id}
                      className="rounded-xl border border-border bg-background p-4 transition hover:border-[#d6a95d]"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/project/${project.id}`}
                              className="text-[13px] font-extrabold text-foreground hover:text-[#2e7c67] hover:underline"
                            >
                              {project.name}
                            </Link>
                            <span className="rounded-full bg-[#eef0ed] px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                              {project.code}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[project.status || 'Yet to start']}`}
                            >
                              {project.status || 'Yet to start'}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                            {project.location} · {project.category} · Target: {project.targetLabel} · Progress:{' '}
                            {project.progress}%
                          </p>
                        </div>

                        {/* Allotment Control */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="block font-mono text-[8px] uppercase tracking-[.1em] text-muted-foreground">
                              Assigned Lead
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-[#173e49]">
                              <span className="grid size-5 place-items-center rounded-full bg-[#ebdcb9] text-[9px] font-bold text-[#664b14]">
                                {currentLead ? currentLead.initials : initialsOf(leadName(project.leadId))}
                              </span>
                              {currentLead ? currentLead.name : leadName(project.leadId)}
                            </span>
                          </div>

                          <select
                            disabled={isAllotting}
                            value={project.leadId || ''}
                            onChange={(e) => handleAllot(project.id, e.target.value)}
                            className="h-9 rounded-xl border border-border bg-white px-2.5 text-[11px] font-bold text-[#173e49] outline-none focus:border-[#d6a95d] disabled:opacity-50"
                          >
                            <option value="" disabled>
                              Select lead...
                            </option>
                            {leads.map((l) => (
                              <option key={l.id} value={l.id}>
                                Allot to {l.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
