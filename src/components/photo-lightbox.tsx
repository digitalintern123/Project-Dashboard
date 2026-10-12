import { useEffect, useState } from 'react';
import {
  X,
  Download,
  Trash2,
  Calendar,
  User,
  Tag,
  Maximize2,
  Minimize2,
  Layers,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { SitePhoto, PhotoCategory } from '@/data/projects';
import { formatFullDate } from '@/lib/date';

interface PhotoLightboxProps {
  photo: SitePhoto;
  photos?: SitePhoto[];
  projectName?: string;
  projectCode?: string;
  canDelete?: boolean;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
}

const categoryStyles: Record<PhotoCategory, { bg: string; text: string; border: string }> = {
  Progress: { bg: 'bg-[#e4f1ec]', text: 'text-[#2e7c67]', border: 'border-[#cbe4d9]' },
  'Snag / Issue': { bg: 'bg-[#fae5e1]', text: 'text-[#b2473d]', border: 'border-[#f0c8c2]' },
  Milestone: { bg: 'bg-[#f8edcf]', text: 'text-[#9a711f]', border: 'border-[#eadcb1]' },
  'Before / After': { bg: 'bg-[#e8f1f5]', text: 'text-[#2c6e8a]', border: 'border-[#c6dbe5]' },
  Inspection: { bg: 'bg-[#f0eaf7]', text: 'text-[#6b3ba6]', border: 'border-[#dccbe8]' },
  General: { bg: 'bg-[#eef0ed]', text: 'text-[#69716b]', border: 'border-[#d9ded8]' },
};

export function PhotoLightbox({
  photo: initialPhoto,
  photos,
  projectName,
  projectCode,
  canDelete = false,
  onClose,
  onDelete,
}: PhotoLightboxProps) {
  const photoList = photos && photos.length > 0 ? photos : [initialPhoto];
  const initialIdx = photoList.findIndex((p) => p.id === initialPhoto.id);
  const [currentIndex, setCurrentIndex] = useState(initialIdx >= 0 ? initialIdx : 0);

  const currentPhoto = photoList[currentIndex] || initialPhoto;

  const [zoomed, setZoomed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasMultiple = photoList.length > 1;

  const goToPrevious = () => {
    setZoomed(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photoList.length - 1));
  };

  const goToNext = () => {
    setZoomed(false);
    setCurrentIndex((prev) => (prev < photoList.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDelete) {
          setConfirmDelete(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        goToPrevious();
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDelete, onClose, hasMultiple, photoList.length]);

  const catStyle =
    currentPhoto.category && categoryStyles[currentPhoto.category]
      ? categoryStyles[currentPhoto.category]
      : categoryStyles.General;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentPhoto.url;
    link.download = `${projectCode || 'project'}-site-photo-${currentPhoto.takenDate || 'current'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(currentPhoto.id);
      if (hasMultiple) {
        setConfirmDelete(false);
        setIsDeleting(false);
        goToNext();
      } else {
        onClose();
      }
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md text-white animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {projectCode && (
                <span className="font-mono text-[11px] font-bold text-[#d19b35] tracking-wider uppercase">
                  {projectCode}
                </span>
              )}
              {projectName && (
                <span className="text-[13px] font-medium text-white/90 truncate max-w-[260px] md:max-w-md">
                  {projectName}
                </span>
              )}
              {hasMultiple && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-white/80">
                  {currentIndex + 1} of {photoList.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/60 truncate max-w-lg mt-0.5">
              {currentPhoto.caption || 'Verified Site Progress Photograph'}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoomed(!zoomed)}
            title={zoomed ? 'Zoom Out' : 'Zoom In'}
            className="grid size-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white/90 transition"
          >
            {zoomed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download photograph"
            className="grid size-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white/90 transition"
          >
            <Download size={16} />
          </button>

          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Delete photograph"
              className="grid size-9 place-items-center rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="grid size-9 place-items-center rounded-xl bg-white/15 hover:bg-white/30 text-white transition ml-2"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Area with Previous / Next Arrows */}
      <div className="relative flex-1 overflow-auto flex items-center justify-center p-4 md:p-8">
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 grid size-12 place-items-center rounded-2xl bg-black/60 hover:bg-black/90 text-white border border-white/20 transition shadow-xl"
              title="Previous photograph (Left Arrow)"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 grid size-12 place-items-center rounded-2xl bg-black/60 hover:bg-black/90 text-white border border-white/20 transition shadow-xl"
              title="Next photograph (Right Arrow)"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setZoomed(!zoomed)}
          aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          aria-pressed={zoomed}
          className="cursor-pointer"
        >
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || 'Site photograph'}
            className={`transition-all duration-200 object-contain rounded-lg shadow-2xl ${
              zoomed ? 'max-w-none scale-125' : 'max-h-[75vh] max-w-full'
            }`}
          />
        </button>
      </div>

      {/* Bottom Metadata Drawer */}
      <div className="border-t border-white/10 bg-black/60 px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {currentPhoto.category && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                >
                  <Tag size={10} />
                  {currentPhoto.category}
                </span>
              )}
              {currentPhoto.stage && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/90 border border-white/15">
                  <Layers size={10} />
                  Stage: {currentPhoto.stage}
                </span>
              )}
              {hasMultiple && (
                <span className="text-[10px] text-white/50 font-mono">
                  Photograph {currentIndex + 1} of {photoList.length}
                </span>
              )}
            </div>
            <p className="text-[13px] font-medium leading-relaxed text-white">
              {currentPhoto.caption || 'Site progress photograph'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px] text-white/70">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-white/50" />
              <span>
                Captured:{' '}
                <strong className="text-white">
                  {currentPhoto.takenDate ? formatFullDate(currentPhoto.takenDate) : 'Unknown'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <User size={13} className="text-white/50" />
              <span>
                Uploaded by:{' '}
                <strong className="text-white">
                  {currentPhoto.uploadedBy || 'Team'} ({currentPhoto.role || 'Lead'})
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="grid size-10 place-items-center rounded-xl bg-rose-500/20">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-white">Delete Photograph</h3>
                <p className="text-[11px] text-white/60">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[12px] text-white/80 leading-relaxed">
              Are you sure you want to permanently delete this site photograph?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl border border-white/20 px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 transition"
              >
                {isDeleting ? 'Deleting...' : 'Delete Photograph'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
