import { useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { type ProjectStatus, type SitePhoto } from '@/data/projects';
import { useAppState } from '@/state/app-state';
import { useToast } from '@/hooks/use-toast';
import { todayLabel } from '@/lib/date';
import { leadName } from '@/data/users';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { PhotoUploadDialog } from '@/components/photo-upload-dialog';
import { ProjectAreaProgram } from '@/components/project-area-program';
import { EmailHubModal } from '@/components/email-hub-modal';
import { errorMessage } from '@/lib/utils';
import { type Tab } from './styles';
import { clampPercent } from './helpers';
import { StageProgressPanel } from './stages/stage-progress-panel';
import { StageTimelinePanel } from './stages/stage-timeline-panel';
import { StageMilestonesPanel } from './stages/stage-milestones-panel';
import { StageIssuesPanel } from './stages/stage-issues-panel';
import { StageUpdatesPanel } from './stages/stage-updates-panel';
import { StagePhotosPanel } from './stages/stage-photos-panel';
import { EditProjectForm } from './edit-project-form';
import { OverviewPanel } from './overview-panel';
import { CommercialPanel } from './commercial/commercial-panel';
import { ProjectNotFound } from './project-not-found';
import { ProjectHeader } from './project-header';
import { ProjectMetrics } from './project-metrics';
import { ProjectTabBar } from './project-tab-bar';
import { DeleteProjectDialog } from './delete-project-dialog';
import { currentStage } from '@/lib/stage-status';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    projects,
    role,
    user,
    updateProject,
    deleteProject,
    updatePhase,
    addPhase,
    removePhase,
    movePhase,
    addMilestone,
    addIssue,
    updateIssue,
    addUpdate,
    addPhoto,
    addMultiplePhotos,
    deletePhoto,
  } = useAppState();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<SitePhoto | null>(null);
  const project = projects.find((item) => item.id === projectId);
  if (!project) return <ProjectNotFound />;
  const isAllottedToMe = !project.leadId || project.leadId === user?.id;
  const canEdit = role === 'coordinator' || (role === 'lead' && isAllottedToMe);
  // Tagging (in-app notice + email): coordinators and HODs on any project, leads on their own.
  const canTag = role === 'coordinator' || role === 'hod' || canEdit;
  const activePhase = currentStage(project.phases)?.name ?? 'planning';
  const saveProgress = (progress: number, comment: string, nextMilestone: string) => {
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description:
          role === 'hod' || role === 'viewer'
            ? 'This account is view-only.'
            : `You can only update projects allotted to you. This project is assigned to ${leadName(project.leadId)}.`,
      });
      return;
    }
    const saved = updateProject(project.id, {
      progress: clampPercent(progress),
      nextMilestone: nextMilestone.trim() || project.nextMilestone,
    });
    if (!saved) {
      toast({
        variant: 'destructive',
        title: 'Not saved',
        description: 'Project edits require Lead or Coordinator permissions.',
      });
      return;
    }
    if (comment.trim()) {
      addUpdate(project.id, {
        date: todayLabel(),
        author: user?.name ?? 'Project Lead',
        role: user?.title ?? 'Project Lead',
        text: comment.trim(),
        stage: activePhase,
        kind: 'Progress',
      });
    }
    toast({ title: 'Progress updated', description: `${project.name} is now at ${clampPercent(progress)}%.` });
  };
  const changeStatus = (newStatus: ProjectStatus) => {
    updateProject(project.id, { status: newStatus });
    toast({
      title: 'Status updated',
      description: `${project.name} is now set to "${newStatus}".`,
    });
  };
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const success = await deleteProject(project.id);
      if (success) {
        toast({
          title: 'Project deleted',
          description: `"${project.name}" has been permanently removed.`,
        });
        setLocation('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: 'Could not delete project from database.',
        });
        setIsDeleting(false);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: errorMessage(err, 'An error occurred.'),
      });
      setIsDeleting(false);
    }
  };
  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-7 md:px-10 md:pt-9">
      <Link
        href="/"
        className="fade-up inline-flex items-center gap-2 text-[11px] font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to portfolio
      </Link>
      <ProjectHeader
        project={project}
        role={role}
        canEdit={canEdit}
        activePhase={activePhase}
        onStatusChange={changeStatus}
        onOpenEmail={() => setEmailModalOpen(true)}
        onToggleEdit={() => setEditing((value) => !value)}
        onRequestDelete={() => setShowDeleteConfirm(true)}
      />

      {editing && canEdit && (
        <EditProjectForm
          project={project}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            updateProject(project.id, patch);
            setEditing(false);
          }}
        />
      )}

      <ProjectMetrics project={project} />

      <ProjectTabBar project={project} tab={tab} onSelectTab={setTab} />
      <div className="fade-up mt-6">
        {tab === 'overview' && (
          <OverviewPanel
            project={project}
            canEdit={canEdit}
            onSelectTab={setTab}
            onUpload={() => setUploadOpen(true)}
            onInspect={(photo) => setLightboxPhoto(photo)}
          />
        )}
        {tab === 'program' && (
          <ProjectAreaProgram
            project={project}
            editable={canEdit}
            onSave={(patch) => updateProject(project.id, patch)}
          />
        )}
        {tab === 'progress' && <StageProgressPanel project={project} editable={canEdit} onSave={saveProgress} />}
        {tab === 'timeline' && (
          <StageTimelinePanel
            project={project}
            editable={canEdit}
            canTag={canTag}
            onSave={(index, patch) => updatePhase(project.id, index, patch)}
            onAdd={(phase) => addPhase(project.id, phase)}
            onRemove={(index) => removePhase(project.id, index)}
            onMove={(index, direction) => movePhase(project.id, index, direction)}
          />
        )}
        {tab === 'milestones' && (
          <StageMilestonesPanel
            project={project}
            editable={canEdit}
            canTag={canTag}
            onAdd={(milestone) => addMilestone(project.id, milestone)}
          />
        )}
        {tab === 'photos' && (
          <StagePhotosPanel
            project={project}
            editable={canEdit}
            onUpload={() => setUploadOpen(true)}
            onDelete={async (photoId) => {
              const ok = await deletePhoto(project.id, photoId);
              if (ok) {
                toast({
                  title: 'Photograph deleted',
                  description: 'The site photograph was permanently removed from the server.',
                });
              } else {
                toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete photograph.' });
              }
            }}
            onInspect={(photo) => setLightboxPhoto(photo)}
          />
        )}
        {tab === 'commercial' && (
          <CommercialPanel project={project} editable={canEdit} onSave={(patch) => updateProject(project.id, patch)} />
        )}
        {tab === 'issues' && (
          <StageIssuesPanel
            project={project}
            editable={canEdit}
            canTag={canTag}
            onAdd={(issue) => addIssue(project.id, issue)}
            onUpdate={(index, patch) => updateIssue(project.id, index, patch)}
          />
        )}
        {tab === 'updates' && (
          <StageUpdatesPanel project={project} editable={canEdit} onAdd={(update) => addUpdate(project.id, update)} />
        )}
      </div>

      <EmailHubModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        defaultTab="send"
      />

      {showDeleteConfirm && (
        <DeleteProjectDialog
          projectName={project.name}
          isDeleting={isDeleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      )}

      {uploadOpen && (
        <PhotoUploadDialog
          projectId={project.id}
          projectName={project.name}
          stages={project.phases}
          existingPhotoUrl={project.photos?.[0]?.url}
          onClose={() => setUploadOpen(false)}
          onUploadBatch={async (photos) => {
            try {
              await addMultiplePhotos(project.id, photos);
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
              await addPhoto(project.id, data);
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

      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          photos={project.photos || []}
          projectName={project.name}
          projectCode={project.code}
          canDelete={canEdit}
          onClose={() => setLightboxPhoto(null)}
          onDelete={async (photoId) => {
            const ok = await deletePhoto(project.id, photoId);
            if (ok) {
              toast({ title: 'Photograph deleted', description: 'The site photograph was permanently removed.' });
            }
          }}
        />
      )}
    </div>
  );
}
