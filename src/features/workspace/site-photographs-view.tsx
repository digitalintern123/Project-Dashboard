import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Camera, Search, Upload } from 'lucide-react';
import { locationOptions, photoCategories, type Project, type SitePhoto, photoThumbnail } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { formatFullDate } from '@/lib/date';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { PhotoUploadDialog } from '@/components/photo-upload-dialog';
import { activateOnKey } from '@/lib/a11y';
import { errorMessage } from '@/lib/utils';
import { PageHeader } from './page-header';

export function SitePhotographsView() {
  const { projects, canEditProject, role, addPhoto, addMultiplePhotos, deletePhoto } = useAppState();
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ photo: SitePhoto; project: Project } | null>(null);
  const [uploadProject, setUploadProject] = useState<Project | null>(null);

  // Collect all projects that have site photos
  const projectsWithPhotos = useMemo(() => {
    return projects.filter((p) => p.photos && p.photos.length > 0);
  }, [projects]);

  // Flattened photos with project metadata
  const filteredItems = useMemo(() => {
    return projects
      .flatMap((p) => (p.photos || []).map((ph) => ({ photo: ph, project: p })))
      .filter(({ photo, project }) => {
        if (selectedLocation !== 'all' && project.location !== selectedLocation) return false;
        if (selectedCategory !== 'all' && photo.category !== selectedCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchProject = project.name.toLowerCase().includes(q) || project.code.toLowerCase().includes(q);
          const matchCaption = photo.caption.toLowerCase().includes(q);
          const matchStage = (photo.stage || '').toLowerCase().includes(q);
          if (!matchProject && !matchCaption && !matchStage) return false;
        }
        return true;
      });
  }, [projects, selectedLocation, selectedCategory, search]);

  const canUploadAny = role === 'coordinator' || (role === 'lead' && projects.some((p) => canEditProject(p)));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Visual Portfolio Intelligence"
        title="Site Photographs"
        description="Physical construction, MEP progress, and fit-out verification photos uploaded from project sites across all Encalm properties."
        action={
          canUploadAny && projects.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const defaultProj = projects.find((p) => canEditProject(p)) || projects[0];
                setUploadProject(defaultProj);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173e49] px-4 py-3 text-[12px] font-bold text-white shadow-sm hover:bg-[#205160] transition"
            >
              <Upload size={14} />
              Upload Site Photograph
            </button>
          ) : undefined
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Portfolio Coverage</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight">
            {projectsWithPhotos.length} / {projects.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Projects with verified site photographs</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Active Photographs</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#2e7c67]">{filteredItems.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Verified progress photos on server</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Gallery Multi-Upload</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#2e7c67]">Active</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Multiple photos supported per project</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Location filter */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-[11px] outline-none"
          >
            <option value="all">All Locations</option>
            {locationOptions(projects).map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-[11px] outline-none"
          >
            <option value="all">All Photo Categories</option>
            {photoCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search project or caption..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-[11px] outline-none"
          />
        </div>
      </div>

      {/* Photographs Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(({ photo, project }) => (
            <div
              key={photo.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Image Container with Hover Overlay */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open photograph: ${photo.caption || 'site photograph'}`}
                  onClick={() => setLightboxPhoto({ photo, project })}
                  onKeyDown={activateOnKey(() => setLightboxPhoto({ photo, project }))}
                  className="relative aspect-video w-full overflow-hidden bg-black/5 cursor-pointer"
                >
                  <img
                    src={photoThumbnail(photo)}
                    loading="lazy"
                    decoding="async"
                    alt={photo.caption}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="rounded-xl bg-black/80 px-3.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm shadow flex items-center gap-1.5">
                      <Camera size={13} /> View High-Res
                    </span>
                  </div>
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {photo.category && (
                      <span className="rounded-full bg-[#173e49]/80 backdrop-blur-sm px-2.5 py-0.5 text-[9px] font-bold text-white">
                        {photo.category}
                      </span>
                    )}
                    {photo.stage && (
                      <span className="rounded-full bg-white/80 backdrop-blur-sm px-2.5 py-0.5 text-[9px] font-bold text-[#173e49]">
                        {photo.stage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a711f]">
                      {project.code} • {project.location}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {photo.takenDate ? formatFullDate(photo.takenDate) : 'Current'}
                    </span>
                  </div>

                  <Link href={`/project/${project.id}`}>
                    <h3 className="text-[15px] font-bold text-foreground hover:text-[#9a711f] transition cursor-pointer">
                      {project.name}
                    </h3>
                  </Link>

                  <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">"{photo.caption}"</p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="border-t border-border/70 px-4 py-3 bg-muted/20 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground text-[10px]">
                  By: <strong>{photo.uploadedBy}</strong>
                </span>
                <Link
                  href={`/project/${project.id}`}
                  className="font-bold text-[#173e49] hover:underline inline-flex items-center gap-1"
                >
                  View project →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border p-14 text-center">
          <Camera size={40} className="mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-[17px] font-bold text-foreground">No Site Photographs Found</h3>
          <p className="mt-2 text-[12px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            {search || selectedLocation !== 'all' || selectedCategory !== 'all'
              ? 'No photographs match your current filter settings. Try adjusting your search query or location filters.'
              : 'No project has uploaded a verified site photograph yet. Site leads can upload progress photos directly from their projects.'}
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto.photo}
          photos={filteredItems.map((item) => item.photo)}
          projectName={lightboxPhoto.project.name}
          projectCode={lightboxPhoto.project.code}
          canDelete={canEditProject(lightboxPhoto.project)}
          onClose={() => setLightboxPhoto(null)}
          onDelete={async (photoId) => {
            const ok = await deletePhoto(lightboxPhoto.project.id, photoId);
            if (ok) {
              toast({
                title: 'Photograph deleted',
                description: 'The site photograph was permanently removed from the server.',
              });
            }
          }}
        />
      )}

      {/* Upload Dialog Modal */}
      {uploadProject && (
        <PhotoUploadDialog
          projectId={uploadProject.id}
          projectName={uploadProject.name}
          stages={uploadProject.phases}
          existingPhotoUrl={uploadProject.photos?.[0]?.url}
          onClose={() => setUploadProject(null)}
          onUploadBatch={async (photos) => {
            try {
              await addMultiplePhotos(uploadProject.id, photos);
              toast({
                title: `${photos.length} photograph${photos.length > 1 ? 's' : ''} uploaded`,
                description: 'Successfully added to project site gallery.',
              });
            } catch (err) {
              toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: errorMessage(err, 'Failed to upload photographs.'),
              });
              throw err;
            }
          }}
          onUpload={async (data) => {
            try {
              await addPhoto(uploadProject.id, data);
              toast({
                title: 'Site photograph added',
                description: 'New photograph uploaded to project site gallery.',
              });
            } catch (err) {
              toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: errorMessage(err, 'Failed to upload photograph.'),
              });
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}
