import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Add,
  Bookmark,
  Calendar2,
  CalendarTick,
  Message,
  SearchNormal,
  Ticket,
  User,
} from 'iconsax-react';
import {
  EmptyState,
  ErrorState,
  Segmented,
  Sheet,
} from '../../components/ui';
import { CommentsPanel } from '../../components/feed/CommentsPanel';
import { Composer } from '../../components/feed/Composer';
import { PostFrame, PostFrameSkeleton } from '../../components/feed/PostFrame';
import { SuggestedUsers } from '../../components/SuggestedUsers';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { followService, postService } from '../../services';
import { Post } from '../../models';

type FeedTab = 'foryou' | 'following';

interface AuthorBrief {
  name: string;
  avatarUrl: string;
}

/** Compact launcher tiles — the fast paths off Home (section 3.1). */
const LAUNCHERS = [
  { to: '/explore', label: 'Explore', icon: SearchNormal, description: 'Find something to go to' },
  { to: '/tickets', label: 'Tickets', icon: Ticket, description: 'Your upcoming events' },
  { to: '/bookings', label: 'Bookings', icon: CalendarTick, description: 'Past and pending' },
  { to: '/saved', label: 'Saved', icon: Bookmark, description: 'Bookmarked events' },
  { to: '/chats', label: 'Chats', icon: Message, description: 'Event group chats' },
  { to: '/host', label: 'Host', icon: Add, description: 'Create and manage events' },
];

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { uid, user } = useAuth();
  const { error: showError } = useToast();
  const breakpoint = useBreakpoint();
  const [params, setParams] = useSearchParams();
  const initialTab: FeedTab = params.get('feed') === 'following' ? 'following' : 'foryou';
  const [tab, setTab] = useState<FeedTab>(initialTab);
  const [retry, setRetry] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [sheetPostId, setSheetPostId] = useState<string | null>(null);
  // `?compose=1` opens the composer once; the param is dropped so a reload
  // does not reopen it.
  const [composeOnMount] = useState(params.get('compose') === '1');
  // Set when the user explicitly closes the comments (via the post icon), so
  // the auto-select effect below does not immediately reopen the first post.
  const manuallyClosed = useRef(false);

  const followingIds =
    useLive<string[]>(() => followService.followingIds(uid ?? ''), [uid]).data ?? [];
  const followKey = followingIds.join(',');

  const { data: posts, loading, error } = useLive<Post[]>(
    () =>
      tab === 'foryou'
        ? postService.feedPosts()
        : postService.feedPostsByAuthors(followingIds.filter((id) => id.length > 0)),
    [tab, followKey, retry],
  );

  const profiles =
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

  const eventTitles =
    useLive<Record<string, string>>(
      async () => {
        const rows = await db.events.toArray();
        const map: Record<string, string> = {};
        for (const row of rows) {
          map[String(row.id ?? '')] = String(row.title ?? '');
        }
        return map;
      },
      [retry],
    ).data ?? {};

  const feed = posts ?? [];

  // Keep the comment panel pointed at a post that is actually on screen — but
  // never reopen a selection the user just closed on purpose.
  useEffect(() => {
    if (posts === undefined) return;
    if (posts.length === 0) {
      setSelectedPostId(null);
      return;
    }
    if (manuallyClosed.current) return;
    if (selectedPostId === null || !posts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(posts[0].id);
    }
  }, [posts, selectedPostId]);

  // Drop `?compose=1` from the URL once it has been honoured.
  useEffect(() => {
    if (params.get('compose') !== '1') return;
    const next = new URLSearchParams(params);
    next.delete('compose');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
  const greeting = greetingForHour(new Date().getHours());

  function toggleComments(postId: string) {
    const isOpen =
      selectedPostId === postId && (breakpoint === 'desktop' || sheetPostId === postId);
    if (isOpen) {
      // Second click on the open post: close the panel (desktop) / dismiss the
      // Sheet (mobile & tablet).
      setSelectedPostId(null);
      setSheetPostId(null);
      manuallyClosed.current = true;
      return;
    }
    manuallyClosed.current = false;
    setSelectedPostId(postId);
    // Below the desktop breakpoint the panel is hidden, so comments open in a
    // Sheet instead (useBreakpoint matches the `desktop:` Tailwind screen).
    if (breakpoint !== 'desktop') setSheetPostId(postId);
  }

  function handleLike(post: Post) {
    if (!uid) {
      showError('Sign in to like posts.');
      return;
    }
    postService.toggleLike(post.id, uid).catch((err: unknown) => {
      showError(`Could not update like: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  function renderFeed() {
    if (error) {
      return (
        <ErrorState title="Could not load posts." onRetry={() => setRetry((n) => n + 1)} />
      );
    }
    if (loading && posts === undefined) {
      return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading posts">
          <PostFrameSkeleton />
          <PostFrameSkeleton />
          <PostFrameSkeleton />
        </div>
      );
    }
    if (feed.length === 0) {
      const recommend = <SuggestedUsers limit={5} className="mt-4" />;
      if (tab === 'foryou') {
        return (
          <div>
            <EmptyState
              icon={<Calendar2 size={26} />}
              title="No posts yet — check back soon."
              body="Follow people below — their posts will show up here."
            />
            {recommend}
          </div>
        );
      }
      if (!uid) {
        return (
          <EmptyState
            icon={<User size={26} />}
            title="Sign in to see posts from people you follow."
          />
        );
      }
      if (followingIds.length === 0) {
        return (
          <div>
            <EmptyState
              icon={<User size={26} />}
              title="You are not following anyone yet."
              body="Start with these suggestions — their posts will fill your Following feed."
            />
            {recommend}
          </div>
        );
      }
      return (
        <div>
          <EmptyState
            icon={<Calendar2 size={26} />}
            title="No posts from people you follow yet."
            body="Follow a few more people below and their posts will show up here."
          />
          {recommend}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {feed.map((post) => (
          <PostFrame
            key={post.id}
            post={post}
            author={profiles[post.authorId]}
            eventTitle={post.eventId ? eventTitles[post.eventId] : undefined}
            liked={uid !== null && post.likeIds.includes(uid)}
            selected={post.id === selectedPostId}
            onLike={handleLike}
            onComment={(target) => toggleComments(target.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fadeup">
      <header className="mb-4">
        <h1 className="text-title text-textprimary">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
      </header>

      {/* Launcher strip — six fast paths off Home. */}
      <nav aria-label="Quick actions" className="mb-5">
        <div className="no-scrollbar -mx-4 flex items-stretch gap-3 overflow-x-auto px-4 pb-1 tablet:-mx-6 tablet:px-6 wide:px-8">
          {LAUNCHERS.map(({ to, label, icon: Icon, description }) => (
            <Link
              key={to}
              to={to}
              className="flex min-w-[148px] shrink-0 flex-col rounded-base border border-border bg-surface p-3 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-popover"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                <Icon size={18} />
              </span>
              <span className="mt-2 block min-w-0 truncate text-body font-bold text-textprimary">
                {label}
              </span>
              <span className="mt-0.5 block min-w-0 truncate text-caption text-textmuted">
                {description}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <Segmented
        ariaLabel="Feed"
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'foryou', label: 'For You' },
          { value: 'following', label: 'Following' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full min-w-0 max-w-[840px] space-y-4">
          <Composer autoOpen={composeOnMount} />
          {renderFeed()}
        </div>

        <aside className="hidden desktop:block" aria-label="Comments">
          <div className="sticky top-4 h-[calc(100vh-140px)] overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            {selectedPostId ? (
              <CommentsPanel postId={selectedPostId} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="text-body text-textmuted">
                  Select a post to read its comments.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Sheet open={sheetPostId !== null} onClose={() => setSheetPostId(null)}>
        {sheetPostId && <CommentsPanel postId={sheetPostId} className="h-[62vh]" />}
      </Sheet>
    </div>
  );
}
