import { Camera, Upload } from 'lucide-react';
import { type Project, type SitePhoto, photoThumbnail } from '@/data/projects';
import { formatFullDate } from '@/lib/date';
import { activateOnKey } from '@/lib/a11y';
import { DetailCard } from '../ui';

export function StagePhotosPanel({
  project,
  editable,
  onUpload,
  onDelete,
  onInspect,
}: {
  project: Project;
  editable: boolean;
  onUpload: () => void;
  onDelete: (photoId: string) => void;
  onInspect: (photo: SitePhoto) => void;
}) {
  const photos = project.photos || [];
  const latestPhoto = photos.length > 0 ? photos[0] : null;

  return (
    <div className="w-full space-y-6">
      <DetailCard title="Site Photographs Gallery" eyebrow="Physical Progress Verification" icon={Camera}>
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="text-[12px] text-muted-foreground max-w-xl">
              Verified physical site photographs for <strong>{project.name}</strong> documenting construction progress,
              MEP fit-out, and snag resolutions.
              {photos.length > 0 && (
                <span className="block mt-1 font-semibold text-foreground">
                  {photos.length} verified site photograph{photos.length > 1 ? 's' : ''} in project gallery.
                </span>
              )}
            </p>
          </div>
          {editable && (
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#205160] transition shadow-sm shrink-0"
            >
              <Upload size={14} />
              Upload Site Photographs
            </button>
          )}
        </div>

        {photos.length > 0 ? (
          <div className="mt-6 space-y-8">
            {/* Featured / Latest Photograph */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#9a711f]">
                  Latest Verified Progress
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Captured {latestPhoto?.takenDate ? formatFullDate(latestPhoto.takenDate) : 'Recently'}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
                {/* Clickable Featured Image */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Open the latest site photograph"
                  onClick={() => latestPhoto && onInspect(latestPhoto)}
                  onKeyDown={activateOnKey(() => latestPhoto && onInspect(latestPhoto))}
                  className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black/5 cursor-pointer shadow-md"
                >
                  <img
                    src={latestPhoto ? photoThumbnail(latestPhoto) : undefined}
                    loading="lazy"
                    decoding="async"
                    alt={latestPhoto?.caption}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="rounded-xl bg-black/75 px-4 py-2 text-[11px] font-bold text-white backdrop-blur-sm shadow-lg flex items-center gap-2">
                      <Camera size={14} /> Click to inspect high-resolution
                    </span>
                  </div>
                </div>

                {/* Latest Photo Metadata Card */}
                <div className="rounded-2xl border border-border bg-[#fbf9f4] p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {latestPhoto?.category && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#e4f1ec] text-[#2e7c67] border border-[#cbe4d9]">
                        {latestPhoto.category}
                      </span>
                    )}
                    {latestPhoto?.stage && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white text-foreground border border-border">
                        Stage: {latestPhoto.stage}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Progress Caption
                    </h4>
                    <p className="mt-1 text-[13px] font-semibold leading-relaxed text-foreground">
                      "{latestPhoto?.caption}"
                    </p>
                  </div>

                  <div className="border-t border-border/70 pt-4 space-y-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Date Captured</span>
                      <strong className="text-foreground font-mono">
                        {latestPhoto?.takenDate ? formatFullDate(latestPhoto.takenDate) : '—'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Uploaded By</span>
                      <strong className="text-foreground">
                        {latestPhoto?.uploadedBy} ({latestPhoto?.role || 'Team'})
                      </strong>
                    </div>
                    {latestPhoto?.fileSize ? (
                      <div className="flex items-center justify-between">
                        <span>File Size</span>
                        <span className="font-mono">{Math.round(latestPhoto.fileSize / 1024)} KB</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-border/70 pt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => latestPhoto && onInspect(latestPhoto)}
                      className="rounded-xl border border-border bg-white px-3.5 py-2 text-[11px] font-bold text-foreground hover:bg-muted transition"
                    >
                      View High-Res
                    </button>
                    {editable && latestPhoto && (
                      <button
                        type="button"
                        onClick={() => onDelete(latestPhoto.id)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                      >
                        Delete Photograph
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery Grid (All Photographs) */}
            {photos.length > 1 && (
              <div className="border-t border-border/70 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold text-foreground">All Project Photographs ({photos.length})</h3>
                  <span className="text-[11px] text-muted-foreground">Click any photo to open full-screen viewer</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((ph, idx) => (
                    <div
                      key={ph.id}
                      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Open photograph: ${ph.caption || 'site photograph'}`}
                        onClick={() => onInspect(ph)}
                        onKeyDown={activateOnKey(() => onInspect(ph))}
                        className="relative aspect-video w-full overflow-hidden bg-black/5 cursor-pointer"
                      >
                        <img
                          src={photoThumbnail(ph)}
                          loading="lazy"
                          decoding="async"
                          alt={ph.caption}
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {ph.category && (
                            <span className="rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 font-mono text-[8px] font-bold text-white uppercase">
                              {ph.category}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-white/90">
                          #{idx + 1}
                        </div>
                      </div>

                      <div className="p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-foreground line-clamp-2 leading-snug">
                          {ph.caption}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                          <span>{ph.takenDate ? formatFullDate(ph.takenDate) : 'Unknown date'}</span>
                          {ph.stage && <span className="font-medium text-foreground">{ph.stage}</span>}
                        </div>
                        {editable && (
                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => onDelete(ph.id)}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <Camera size={38} className="mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-[16px] font-bold text-foreground">No Site Photographs Uploaded Yet</h3>
            <p className="mt-2 text-[12px] text-muted-foreground max-w-md mx-auto leading-relaxed">
              Upload physical progress photos, snag shots, or milestone completions directly from the site to keep
              stakeholders visually aligned. Multiple photos can be uploaded at once.
            </p>
            {editable && (
              <button
                type="button"
                onClick={onUpload}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-5 py-2.5 text-[11px] font-bold text-white hover:bg-[#205160] transition shadow-sm"
              >
                <Upload size={14} />
                Upload Site Photographs
              </button>
            )}
          </div>
        )}
      </DetailCard>
    </div>
  );
}
