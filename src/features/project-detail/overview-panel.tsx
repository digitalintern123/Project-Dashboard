import { Link } from 'wouter';
import {
  AlertTriangle,
  Building2,
  Camera,
  ClipboardCheck,
  FileText,
  FileSpreadsheet,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { type Project, type SitePhoto } from '@/data/projects';
import { formatFullDate } from '@/lib/date';
import { leadName } from '@/data/users';
import { getIssueStatusTheme } from '@/lib/issue-theme';
import { activateOnKey } from '@/lib/a11y';
import { healthStyles, type Tab } from './styles';
import { activePhaseLabel, openIssueLabel, openIssueTone, budgetLabel, budgetTone } from './helpers';
import { ProgressRing, PhaseList, DetailCard, Info, HealthRow } from './ui';

export function OverviewPanel({
  project,
  canEdit = false,
  onSelectTab,
  onUpload,
  onInspect,
}: {
  project: Project;
  canEdit?: boolean;
  onSelectTab?: (tab: Tab) => void;
  onUpload?: () => void;
  onInspect?: (photo: SitePhoto) => void;
}) {
  const health = healthStyles[project.health];
  const spec = project.specification;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
      <div className="space-y-5">
        <DetailCard title="Project information" eyebrow="Overview" icon={FileText}>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info label="Project name" value={project.name} />
            <Info label="Location" value={project.location} />
            <Info label="Project status" value={project.status || 'Yet to start'} />
            <Info label="Category" value={project.category} />
            <Info label="Project lead" value={leadName(project.leadId)} />
            <Info label="Project type" value={spec?.projectType ?? project.category} />
            <Info label="Start date" value={project.startDate ?? '—'} />
            <Info label="Target completion" value={project.targetLabel} />
            <Info label="Area" value={project.area || spec?.area || '—'} />
            <Info label="Pax / Keys" value={project.paxKeys || spec?.capacity || '—'} />
            <Info label="Completion %" value={`${project.progress}%`} />
          </div>
          {spec?.customFields?.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {spec.customFields
                .filter((field) => field.value)
                .map((field) => (
                  <Info key={field.label} label={field.label} value={field.value} />
                ))}
            </div>
          ) : null}
          {spec?.scope && (
            <p className="mt-5 rounded-xl bg-[#f7f4ec] p-4 text-[11px] leading-5 text-muted-foreground">{spec.scope}</p>
          )}
        </DetailCard>
        {(spec?.areaProgram || project.category === 'Hotel') && (
          <DetailCard title="Architectural Area Program" eyebrow="Space Allocation" icon={Building2}>
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Plot Area
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.summary.plotAreaSqm?.toLocaleString() ?? '8,160'} SQ.M.
                  </span>
                  <span className="font-mono text-[10px] text-[#2e7c67]">
                    {spec?.areaProgram?.summary.plotAreaAcres ?? 2} Acres
                  </span>
                </div>
                <div className="rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9a711f]">Total BUA</span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.summary.builtUpAreaSqm?.toLocaleString() ?? '14,970'} SQ.M.
                  </span>
                  <span className="font-mono text-[10px] text-[#9a711f]">
                    {spec?.areaProgram?.summary.builtUpAreaSqft?.toLocaleString() ?? '161,137'} SQ.FT.
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Inventory
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.summary.totalRoomKeys ?? 156} Keys
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {spec?.areaProgram?.summary.totalBays ?? 168} Bays
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    FOH Total
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaProgram?.fohAreas?.grandSubtotal?.areaSqm?.toLocaleString() ?? '2,557'} SQ.M.
                  </span>
                  <span className="font-mono text-[10px] text-[#2e7c67]">Ground + 2nd Flr</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Stack:{' '}
                  {spec?.areaProgram?.summary.numberOfFloorsDescription ?? 'B + G + 1 + Service + 2nd to 6th Floor'}
                </span>
                {onSelectTab && (
                  <button
                    type="button"
                    onClick={() => onSelectTab('program')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#173e49] hover:text-[#2e7c67] transition"
                  >
                    View Full Space Breakdown &rarr;
                  </button>
                )}
              </div>
            </div>
          </DetailCard>
        )}
        {(spec?.areaSheet || (project.area && project.category !== 'Hotel')) && (
          <DetailCard title="Project Area Sheet Record" eyebrow="Official Master Area Register" icon={FileSpreadsheet}>
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Sheet Entry
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    #{spec?.areaSheet?.slNo ?? '—'}
                  </span>
                  <span className="font-mono text-[10px] text-[#2e7c67]">
                    {spec?.areaSheet?.section ?? (project.category === 'Lounge' ? 'LOUNGES' : 'OFFICE, KITCHEN & MISC')}
                  </span>
                </div>
                <div className="rounded-xl border border-[#eadcb1] bg-[#fff8e9] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9a711f]">
                    Area (SQ.FT.)
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold text-[#173e49]">
                    {spec?.areaSheet?.areaSqft
                      ? `${spec.areaSheet.areaSqft.toLocaleString()} SQ.FT.`
                      : project.area || '—'}
                  </span>
                  <span className="font-mono text-[10px] text-[#9a711f]">
                    {spec?.areaSheet?.areaSqm ? `${spec.areaSheet.areaSqm.toLocaleString()} SQ.M.` : ''}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Airport Terminal
                  </span>
                  <span className="mt-1 block text-[14px] font-extrabold text-[#173e49]">{project.location}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{spec?.floor || 'Terminal Core'}</span>
                </div>
                <div className="rounded-xl border border-border bg-[#f8f6f0] p-3 text-center">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Sheet Status
                  </span>
                  <span className="mt-1 block text-[12px] font-extrabold text-[#2e7c67]">
                    {spec?.areaSheet?.status || project.status || 'Operational'}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">Source: Master Sheet</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Facility Name: <strong>{project.name}</strong> ({project.code})
                </span>
                <Link
                  href="/area-sheet"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#173e49] hover:text-[#2e7c67] transition"
                >
                  View in Master Area Sheet &rarr;
                </Link>
              </div>
            </div>
          </DetailCard>
        )}
        <DetailCard title="Phase progress" eyebrow="Delivery path" icon={ClipboardCheck}>
          <div className="mt-5 grid gap-6 md:grid-cols-[140px_1fr] md:items-center">
            <div className="flex flex-col items-center gap-3">
              <ProgressRing progress={project.progress} />
              <span className="text-center text-[10px] leading-4 text-muted-foreground">
                Planned opening
                <br />
                <strong className="text-foreground">{project.targetLabel}</strong>
              </span>
            </div>
            <PhaseList project={project} />
          </div>
        </DetailCard>
      </div>
      <div className="space-y-5">
        <DetailCard title="Project health" eyebrow="Portfolio signal" icon={ShieldAlert} tone="gold">
          <div className="mt-6 space-y-3">
            <HealthRow label="Schedule" value={project.health} tone={health} />
            <HealthRow label="Current stage" value={activePhaseLabel(project)} tone={healthStyles[project.health]} />
            <HealthRow label="Open issues" value={openIssueLabel(project)} tone={openIssueTone(project)} />
            <HealthRow label="Budget" value={budgetLabel(project)} tone={budgetTone(project)} />
          </div>
        </DetailCard>

        {/* Current Site Photograph Widget */}
        <DetailCard title="Current Site Photograph" eyebrow="Visual Verification" icon={Camera}>
          {(() => {
            const currentPhoto = project.photos && project.photos.length > 0 ? project.photos[0] : null;
            if (currentPhoto) {
              return (
                <div className="mt-5 space-y-3">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Open the current site photograph"
                    onClick={() => onInspect?.(currentPhoto)}
                    onKeyDown={activateOnKey(() => onInspect?.(currentPhoto))}
                    className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black/5 cursor-pointer shadow-sm"
                  >
                    <img
                      src={currentPhoto.url}
                      alt={currentPhoto.caption}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-85 group-hover:opacity-100 transition" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {currentPhoto.category && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#3d9a7e] text-white">
                            {currentPhoto.category}
                          </span>
                        )}
                        {currentPhoto.stage && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/20 text-white backdrop-blur-sm">
                            {currentPhoto.stage}
                          </span>
                        )}
                        {project.photos && project.photos.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#173e49]/80 text-white backdrop-blur-sm border border-white/20">
                            +{project.photos.length - 1} more in gallery
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-medium leading-snug line-clamp-2">{currentPhoto.caption}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      Captured:{' '}
                      <strong className="text-foreground">
                        {currentPhoto.takenDate ? formatFullDate(currentPhoto.takenDate) : 'Recently'}
                      </strong>
                    </span>
                    {onSelectTab && (
                      <button
                        type="button"
                        onClick={() => onSelectTab('photos')}
                        className="font-bold text-[#9a711f] hover:underline"
                      >
                        {project.photos && project.photos.length > 1
                          ? `View all ${project.photos.length} photos →`
                          : 'View full photo →'}
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
                <Camera size={24} className="mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-[12px] font-bold text-foreground">No site photograph uploaded</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Upload a physical progress photograph to provide visual verification for stakeholders.
                </p>
                {canEdit && onUpload && (
                  <button
                    type="button"
                    onClick={onUpload}
                    className="mt-4 rounded-xl bg-[#173e49] px-3.5 py-2 text-[10px] font-extrabold text-white hover:bg-[#205160] transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload size={12} />
                    Upload site photograph
                  </button>
                )}
              </div>
            );
          })()}
        </DetailCard>

        <DetailCard title="Key issue" eyebrow="Decision radar" icon={AlertTriangle} tone="gold">
          {project.issues[0] ? (
            (() => {
              const keyIssueTheme = getIssueStatusTheme(project.issues[0].status, project.issues[0].severity);
              return (
                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: keyIssueTheme.dotColor }}
                    />
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${keyIssueTheme.badgeClass}`}
                    >
                      {project.issues[0].status ?? 'Open'}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                      {project.issues[0].severity} priority · {project.issues[0].category ?? 'Other'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[14px] font-extrabold">{project.issues[0].title}</h3>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{project.issues[0].detail}</p>
                  <p className="mt-4 font-mono text-[9px] uppercase tracking-[.1em] text-[#9a711f]">
                    Owner · {project.issues[0].owner}
                  </p>
                </div>
              );
            })()
          ) : (
            <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
              No active issues. The next decision point is {project.nextMilestone}.
            </p>
          )}
        </DetailCard>
      </div>
    </div>
  );
}
