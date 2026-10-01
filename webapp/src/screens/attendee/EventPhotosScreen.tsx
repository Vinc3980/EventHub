import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Add, Flag, Star1 } from 'iconsax-react';
import { Button, EmptyState, ErrorState, Sheet, Skeleton } from '../../components/ui';
import { AppVideoPlayer } from '../../components/media/AppVideoPlayer';
import EventReportDialog from '../../components/EventReportDialog';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import { postService } from '../../services';
import { Post } from '../../models';
import { formatListStamp } from '../../lib/format';

export default function EventPhotosScreen() {
  const { eventId = '' } = useParams();
  const { uid } = useAuth();
  const { success, error: showError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [retry, setRetry] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: posts, loading, error } = useLive<Post[]>(
    () => postService.postsForEvent(eventId),
    [eventId, retry],
  );

  const photos = (posts ?? []).filter((post) => post.mediaUrl.length > 0);
  const active = photos.find((post) => post.id === activeId) ?? null;

  async function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !uid) return;
    setUploading(true);
    try {
      const mediaUrl = URL.createObjectURL(file);
      await postService.createPost(
        new Post({
          id: '',
          authorId: uid,
          eventId,
          text: '',
          mediaUrl,
          isVideo: file.type.startsWith('video/'),
          timestamp: new Date(),
        }),
      );
      success('Photo uploaded.');
    } catch (err) {
      showError(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="animate-fadeup pb-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-caption text-textmuted">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to={`/event/${eventId}/rate`}
            aria-label="Rate this event"
            title="Rate this event"
            className="flex h-10 w-10 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6 hover:text-primary"
          >
            <Star1 size={20} />
          </Link>
          <button
            type="button"
            aria-label="Report event"
            title="Report event"
            onClick={() => setReportOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6 hover:text-primary"
          >
            <Flag size={20} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => void pickPhoto(event)}
          />
          <Button
            size="sm"
            icon={<Add size={16} />}
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            Add photo
          </Button>
        </div>
      </div>

      {error && <ErrorState title="Could not load photos." onRetry={() => setRetry((n) => n + 1)} />}

      {loading && (
        <div className="grid grid-cols-3 gap-2 tablet:grid-cols-4 desktop:grid-cols-6" aria-busy="true" aria-label="Loading photos">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="aspect-square w-full" radius="rounded-md" />
          ))}
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <EmptyState
          icon={<Star1 size={26} />}
          title="No photos yet"
          body="Be the first to share a photo."
          action={
            <Button icon={<Add size={16} />} loading={uploading} onClick={() => fileRef.current?.click()}>
              Add photo
            </Button>
          }
        />
      )}

      {!loading && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 tablet:grid-cols-4 desktop:grid-cols-6">
          {photos.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setActiveId(post.id)}
              className="group relative aspect-square overflow-hidden rounded-md bg-neutralbg transition-transform duration-200 hover:scale-105"
            >
              {post.isVideo ? (
                <video src={post.mediaUrl} muted className="h-full w-full object-cover" />
              ) : (
                <img src={post.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      <Sheet open={active != null} onClose={() => setActiveId(null)} title="Photos" variant="center" wide>
        {active && (
          <div>
            {active.isVideo ? (
              <AppVideoPlayer
                src={active.mediaUrl}
                className="max-h-[70vh] w-full rounded-md bg-black"
              />
            ) : (
              <img src={active.mediaUrl} alt="" className="max-h-[70vh] w-full rounded-md object-contain" />
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-body text-textmuted">{active.text}</p>
              <span className="shrink-0 text-caption text-textmuted">
                {formatListStamp(active.timestamp)}
              </span>
            </div>
          </div>
        )}
      </Sheet>

      <EventReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="event"
        targetId={eventId}
      />
    </div>
  );
}
