import { Link } from 'react-router-dom';
import { Heart, Message } from 'iconsax-react';
import { Avatar, Skeleton } from '../ui';
import { AppVideoPlayer } from '../media/AppVideoPlayer';
import { Post } from '../../models';
import { formatCount, relativeStamp } from '../../lib/format';

export interface PostAuthor {
  name: string;
  avatarUrl: string;
}

export interface PostFrameProps {
  post: Post;
  author?: PostAuthor;
  eventTitle?: string;
  liked: boolean;
  selected?: boolean;
  onLike: (post: Post) => void;
  onComment: (post: Post) => void;
}

/**
 * One vertical post frame in the Home feed: author header → centred media →
 * caption → like/comment action row.
 */
export function PostFrame({
  post,
  author,
  eventTitle,
  liked,
  selected = false,
  onLike,
  onComment,
}: PostFrameProps) {
  const name = (author?.name ?? '').trim() || 'Unknown';
  const commentCount = post.comments.length;
  // Seed videos ship a generated `<name>.poster.jpg` (npm run seed:posters);
  // device uploads have no poster frame, so the attribute is omitted.
  const poster =
    post.isVideo && post.mediaUrl.includes('/seed/') && post.mediaUrl.endsWith('.mp4')
      ? `${post.mediaUrl.slice(0, -4)}.poster.jpg`
      : undefined;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar name={name} url={author?.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold text-textprimary">{name}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {post.eventId && (
              <Link
                to={`/event/${post.eventId}`}
                className="max-w-[190px] shrink-0 truncate rounded-pill bg-primary-10 px-2 py-0.5 text-caption font-semibold text-primary transition-colors duration-200 hover:bg-primary-14"
              >
                {eventTitle && eventTitle.trim().length > 0 ? eventTitle : 'View event'}
              </Link>
            )}
            <span className="shrink-0 text-caption text-textmuted">
              {relativeStamp(post.timestamp)}
            </span>
          </div>
        </div>
      </div>

      {post.mediaUrl.length > 0 && (
        <div className="mt-3 flex items-center justify-center bg-black/5">
          {post.isVideo ? (
            <AppVideoPlayer
              src={post.mediaUrl}
              poster={poster}
              className="max-h-[70vh] w-full"
              autoPlayMuted
              loop
            />
          ) : (
            <img
              className="max-h-[70vh] w-full object-contain"
              src={post.mediaUrl}
              alt=""
              loading="lazy"
            />
          )}
        </div>
      )}

      {post.text.trim().length > 0 && (
        <p className="whitespace-pre-line px-4 pb-1 pt-3 text-body text-textprimary">{post.text}</p>
      )}

      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          aria-label={liked ? 'Unlike post' : 'Like post'}
          aria-pressed={liked}
          onClick={() => onLike(post)}
          className={`flex h-10 items-center gap-1.5 rounded-pill px-3 transition-colors duration-200 ${
            liked ? 'text-accent' : 'text-textmuted hover:bg-primary-6 hover:text-primary'
          }`}
        >
          <Heart size={20} variant={liked ? 'Bold' : 'Linear'} />
          <span className="text-caption font-semibold">{formatCount(post.likeIds.length)}</span>
        </button>
        <button
          type="button"
          aria-label="View comments"
          aria-pressed={selected}
          onClick={() => onComment(post)}
          className={`flex h-10 items-center gap-1.5 rounded-pill px-3 transition-colors duration-200 ${
            selected
              ? 'bg-primary-6 text-primary'
              : 'text-textmuted hover:bg-primary-6 hover:text-primary'
          }`}
        >
          <Message size={20} variant={selected ? 'Bold' : 'Linear'} />
          <span className="text-caption font-semibold">{formatCount(commentCount)}</span>
        </button>
      </div>
    </article>
  );
}

/** Loading placeholder shaped like a PostFrame. */
export function PostFrameSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-card"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <Skeleton className="h-10 w-10 shrink-0" radius="rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="mt-3 h-56 w-full" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
