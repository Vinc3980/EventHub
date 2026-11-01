import { useState, type FormEvent } from 'react';
import { CloseSquare, Message, Send2, Trash } from 'iconsax-react';
import { Avatar, Button, EmptyState, ErrorState, IconButton, Input, Skeleton } from '../ui';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import { db } from '../../db/db';
import { Post, type PostComment } from '../../models';
import { postService } from '../../services';
import { relativeStamp } from '../../lib/format';

interface AuthorBrief {
  name: string;
  avatarUrl: string;
}

/**
 * Comment panel for a single post — used both in the desktop right column and
 * inside the mobile `Sheet`. Self-contained: it streams the post, the author
 * directory and handles its own composer.
 */
export function CommentsPanel({
  postId,
  onClose,
  className = 'h-full',
}: {
  postId: string;
  onClose?: () => void;
  className?: string;
}) {
  const { uid } = useAuth();
  const { error: showError } = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  const { data: post, loading, error } = useLive<Post | null>(
    () => postService.postById(postId),
    [postId, retry],
  );

  const directory =
    useLive<Record<string, AuthorBrief>>(
      async () => {
        const rows = await db.users.toArray();
        const map: Record<string, AuthorBrief> = {};
        for (const row of rows) {
          map[String(row.uid ?? '')] = {
            name: String(row.name ?? ''),
            avatarUrl: String(row.avatarUrl ?? ''),
          };
        }
        return map;
      },
      [retry],
    ).data ?? {};

  const comments: PostComment[] = post?.comments ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === '' || busy) return;
    if (!uid) {
      showError('Sign in to join the conversation.');
      return;
    }
    setBusy(true);
    try {
      await postService.addComment(postId, uid, trimmed);
      setDraft('');
    } catch (err) {
      showError(`Could not post your comment: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    if (!uid) return;
    try {
      const removed = await postService.removeComment(postId, commentId, uid);
      if (!removed) showError('You can only delete your own comments.');
    } catch (err) {
      showError(`Could not delete comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section className={`flex min-h-0 flex-col ${className}`} aria-label="Comments">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="min-w-0 truncate text-subtitle text-textprimary">
          Comments{' '}
          <span className="font-medium text-textmuted">({comments.length})</span>
        </h3>
        {onClose && (
          <IconButton label="Close comments" onClick={onClose}>
            <CloseSquare size={20} />
          </IconButton>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <ErrorState
            title="Could not load comments."
            onRetry={() => setRetry((n) => n + 1)}
          />
        )}

        {loading && (
          <div className="space-y-4" aria-busy="true" aria-label="Loading comments">
            {[0, 1, 2].map((n) => (
              <div key={n} className="flex items-start gap-2.5">
                <Skeleton className="h-8 w-8 shrink-0" radius="rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && post === null && (
          <EmptyState icon={<Message size={26} />} title="This post is unavailable." />
        )}

        {!loading && post !== undefined && post !== null && comments.length === 0 && (
          <EmptyState
            icon={<Message size={26} />}
            title="No comments yet."
            body="Be the first to comment."
            className="py-8"
          />
        )}

        {!loading && post !== undefined && post !== null && comments.length > 0 && (
          <ul className="space-y-4">
            {comments.map((comment) => {
              const author = directory[comment.authorId];
              const name = (author?.name ?? '').trim() || 'Unknown';
              const mine = comment.authorId === uid;
              return (
                <li key={comment.id} className="flex items-start gap-2.5">
                  <Avatar name={name} url={author?.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1 rounded-base bg-neutralbg px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-caption font-bold text-textprimary">
                        {name}
                      </span>
                      <span className="shrink-0 text-caption text-textmuted">
                        {relativeStamp(comment.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-line break-words text-body text-textprimary">
                      {comment.text}
                    </p>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      title="Delete comment"
                      onClick={() => void remove(comment.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-textmuted transition-colors duration-200 hover:bg-dangerbg hover:text-danger"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex shrink-0 items-stretch gap-2 border-t border-border px-3 py-3"
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a comment…"
          aria-label="Write a comment"
          disabled={busy || post === null}
        />
        <Button
          type="submit"
          size="md"
          icon={<Send2 size={18} />}
          disabled={draft.trim().length === 0}
          loading={busy}
        >
          Post
        </Button>
      </form>
    </section>
  );
}
