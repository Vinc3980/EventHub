import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CloseCircle, Image as ImageIcon, Video } from 'iconsax-react';
import { Avatar, Button } from '../ui';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { Post } from '../../models';
import { postService } from '../../services';
import {
  MAX_IMAGE_BYTES,
  MAX_POST_VIDEO_BYTES,
  MediaSizeError,
  mediaKindOf,
  readFileAsDataUrl,
  type MediaKind,
} from '../../lib/media';

const SOFT_CHAR_LIMIT = 280;

/**
 * "Share an update…" card at the top of the Home feed. Collapsed it is an
 * avatar + prompt; expanded it is an auto-growing textarea with an optional
 * image (≤1.5 MB) or video (≤15 MB) attachment.
 */
export function Composer() {
  const { uid, user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(kind: MediaKind) {
    const input = fileRef.current;
    if (!input) return;
    input.accept = kind === 'video' ? 'video/*' : 'image/*';
    input.click();
  }

  async function pickMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const kind = mediaKindOf(file);
    if (!kind) {
      toast.error('Choose an image or a video file.');
      return;
    }
    try {
      const url = await readFileAsDataUrl(
        file,
        kind === 'video' ? MAX_POST_VIDEO_BYTES : MAX_IMAGE_BYTES,
      );
      setMediaUrl(url);
      setMediaKind(kind);
    } catch (err) {
      if (err instanceof MediaSizeError) {
        toast.error(
          kind === 'video'
            ? 'That video is too large — keep it under 15 MB.'
            : 'That image is too large — keep it under 1.5 MB.',
        );
        return;
      }
      toast.error(kind === 'video' ? 'Could not read that video.' : 'Could not read that image.');
    }
  }

  function cancel() {
    setOpen(false);
    setText('');
    setMediaUrl('');
    setMediaKind(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!uid) {
      toast.error('Sign in to share an update.');
      return;
    }
    const trimmed = text.trim();
    if (trimmed === '' && mediaUrl === '') return;
    setBusy(true);
    try {
      await postService.createPost(
        new Post({
          id: '',
          authorId: uid,
          text: trimmed,
          mediaUrl,
          isVideo: mediaKind === 'video',
          timestamp: new Date(),
        }),
      );
      cancel();
      toast.success('Your update is live.');
    } catch (err) {
      toast.error(`Could not post: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const name = (user?.name ?? '').trim() || 'Guest';

  if (!open) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 shadow-card">
        <div className="flex items-center gap-3">
          <Avatar name={name} url={user?.avatarUrl} size={40} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-10 min-w-0 flex-1 truncate rounded-pill border border-border px-4 text-left text-body text-textmuted transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            Share an update…
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-surface p-3 shadow-card animate-fadeup"
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} url={user?.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            autoFocus
            rows={3}
            aria-label="Share an update"
            placeholder="What is happening in your circle?"
            onChange={(event) => {
              const el = event.currentTarget;
              setText(el.value);
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            className="min-h-[72px] w-full resize-none rounded-md border border-border bg-surface px-3.5 py-3 text-body text-textprimary placeholder:text-neutral transition-colors duration-200 focus:border-primary focus:outline-none"
          />

          {mediaUrl !== '' && (
            <div className="relative mt-2 inline-block">
              {mediaKind === 'video' ? (
                <video
                  src={mediaUrl}
                  aria-label="Video attachment preview"
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="h-24 w-[160px] rounded-md border border-border bg-neutralbg object-cover"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt="Attachment preview"
                  className="h-24 w-24 rounded-md border border-border object-cover"
                />
              )}
              <button
                type="button"
                aria-label={mediaKind === 'video' ? 'Remove video' : 'Remove image'}
                title={mediaKind === 'video' ? 'Remove video' : 'Remove image'}
                onClick={() => {
                  setMediaUrl('');
                  setMediaKind(null);
                }}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-textmuted shadow-card transition-colors duration-200 hover:text-danger"
              >
                <CloseCircle size={18} />
              </button>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ImageIcon size={16} />}
                onClick={() => pick('image')}
              >
                Photo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Video size={16} />}
                onClick={() => pick('video')}
              >
                Video
              </Button>
              {text.length >= SOFT_CHAR_LIMIT && (
                <span className="text-caption text-textmuted">{text.length} characters</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={busy}
                disabled={text.trim() === '' && mediaUrl === ''}
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickMedia} />
    </form>
  );
}
