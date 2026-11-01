import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Add,
  Bookmark,
  Calendar1,
  Calendar2,
  Location,
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
import { useBookings } from '../../components/SocialData';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { followService, postService } from '../../services';
import { formatDateCard } from '../../lib/format';
import { Event, type Post } from '../../models';

type FeedTab = 'foryou' | 'following';

interface AuthorBrief {
  name: string;
  avatarUrl: string;
}

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

  // User bookings and next upcoming event text
  const { data: bookings } = useBookings(uid);
  const upcomingEventIds = useMemo(
    () => (bookings ?? []).filter((b) => b.status === 'confirmed').map((b) => b.eventId),
    [bookings],
  );

  const nextEvent = useLive<Event | null>(async () => {
    let best: Event | null = null;
    for (const eventId of Array.from(new Set(upcomingEventIds))) {
      const raw = await db.events.get(eventId);
      if (!raw) continue;
      const event = new Event(raw as unknown as Event);
      const eventTime = event.date.getTime();
      if (eventTime < Date.now()) continue;
      if (!best || eventTime < best.date.getTime()) {
        best = event;
      }
    }
    return best;
  }, [upcomingEventIds.join(',')]);

  const nextEventText = useMemo(() => {
    if (!nextEvent.data) return null;
    const event = nextEvent.data;
    const ms = Math.max(0, event.date.getTime() - Date.now());
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return `Next: ${event.title} · ${days > 0 ? `${days} days` : 'today'}`;
  }, [nextEvent.data]);

  // Trending events for the right rail default view
  const trendingEvents = useLive<Event[]>(async () => {
    const all = await db.events.toArray();
    return all
      .map((row) => new Event(row as unknown as Event))
      .filter((e) => e.date.getTime() >= Date.now())
      .slice(0, 3);
  }, []).data ?? [];

  // Shortcuts list (Tickets merged with Bookings; lift hover removed; calm shadow + border)
  const shortcuts = useMemo(
    () => [
      { to: '/explore', label: 'Explore', icon: SearchNormal, description: 'Find something to go to' },
      {
        to: '/tickets',
        label: 'Tickets',
        icon: Ticket,
        description: nextEventText ?? 'Your upcoming events',
      },
      { to: '/saved', label: 'Saved', icon: Bookmark, description: 'Bookmarked events' },
      { to: '/chats', label: 'Chats', icon: Message, description: 'Event group chats' },
      { to: '/host', label: 'Host', icon: Add, description: 'Create and manage events' },
    ],
    [nextEventText],
  );

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
      // Second click on the open post: close the panel (desktop) / dismiss the Sheet (mobile/tablet).
      setSelectedPostId(null);
      setSheetPostId(null);
      manuallyClosed.current = true;
      return;
    }
    manuallyClosed.current = false;
    setSelectedPostId(postId);
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
      {/* Top Greeting — left-aligned with shared container edge */}
      <header className="mb-5">
        <h1 className="text-display text-textprimary on-backdrop-title">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
      </header>

      {/* Shortcuts below wide: scrolling strip on mobile, compact row on tablet/desktop */}
      <nav aria-label="Quick actions" className="mb-6 wide:hidden">
        <div className="no-scrollbar -mx-4 flex items-stretch gap-3 overflow-x-auto px-4 pb-1 desktop:mx-0 desktop:grid desktop:grid-cols-5 desktop:px-0">
          {shortcuts.map(({ to, label, icon: Icon, description }) => (
            <Link
              key={to}
              to={to}
              className="flex min-w-[148px] shrink-0 flex-col rounded-base border border-border bg-surface p-3.5 shadow-card transition-colors duration-200 hover:border-primary-14 hover:shadow-popover"
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

      {/* Main content grid:
          ≥wide: 3 columns (left rail 280px · feed max 760px · right rail 360px, gap-8)
          desktop: 2 columns (feed + right rail 340px, gap-8)
          mobile/tablet: 1 column
      */}
      <div className="grid grid-cols-1 gap-8 desktop:grid-cols-[minmax(0,1fr)_340px] wide:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* Left shortcuts rail (≥wide) */}
        <aside className="hidden wide:block" aria-label="Shortcuts">
          <div className="sticky top-4 space-y-2.5">
            <p className="px-1 text-section uppercase tracking-wider text-textmuted on-backdrop-muted">
              Shortcuts
            </p>
            {shortcuts.map(({ to, label, icon: Icon, description }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-base border border-border bg-surface p-3.5 shadow-card transition-colors duration-200 hover:border-primary-14 hover:shadow-popover"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-textprimary">{label}</span>
                  <span className="block truncate text-caption text-textmuted">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>

        {/* Center feed column (centered in its track, max-w-[760px]) */}
        <div className="mx-auto w-full min-w-0 max-w-[760px] space-y-4">
          {/* For You / Following segmented bar (fit width, left-aligned) */}
          <div className="flex items-center justify-between">
            <Segmented
              fit
              ariaLabel="Feed"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'foryou', label: 'For You' },
                { value: 'following', label: 'Following' },
              ]}
            />
          </div>

          <Composer autoOpen={composeOnMount} />
          {renderFeed()}
        </div>

        {/* Right rail: Comments when selected; Upcoming + Trending + Hosts to follow when empty */}
        <aside className="hidden desktop:block" aria-label="Comments and Discover">
          <div className="sticky top-4 space-y-4">
            {selectedPostId ? (
              <div className="h-[calc(100vh-140px)] overflow-hidden rounded-lg border border-border bg-surface shadow-card">
                <CommentsPanel postId={selectedPostId} />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Fallback placeholder text strictly required by test contract */}
                <div className="rounded-base border border-border bg-surface p-4 shadow-card">
                  <p className="text-center text-body text-textmuted">
                    Select a post to read its comments.
                  </p>
                </div>

                {/* Upcoming for you */}
                {nextEvent.data && (
                  <div className="rounded-base border border-border bg-surface p-4 shadow-card">
                    <p className="mb-2 text-section uppercase tracking-wider text-textmuted">
                      Upcoming for you
                    </p>
                    <Link
                      to={`/event/${nextEvent.data.id}`}
                      className="group block rounded-md bg-primary-6 p-3 transition-colors hover:bg-primary-10"
                    >
                      <p className="font-bold text-textprimary group-hover:text-primary">
                        {nextEvent.data.title}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-caption text-textmuted">
                        <Calendar1 size={14} className="shrink-0 text-primary" />
                        {formatDateCard(nextEvent.data.date)}
                      </p>
                    </Link>
                  </div>
                )}

                {/* Trending this week */}
                {trendingEvents.length > 0 && (
                  <div className="rounded-base border border-border bg-surface p-4 shadow-card">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-subtitle font-bold text-textprimary">Trending this week</h3>
                      <Link
                        to="/explore"
                        className="text-caption font-semibold text-primary hover:underline"
                      >
                        See all
                      </Link>
                    </div>
                    <div className="space-y-2.5">
                      {trendingEvents.map((evt) => (
                        <Link
                          key={evt.id}
                          to={`/event/${evt.id}`}
                          className="group flex items-start gap-2.5 rounded-md p-1.5 transition-colors hover:bg-neutralbg"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                            <Calendar1 size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-caption font-bold text-textprimary group-hover:text-primary">
                              {evt.title}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-textmuted">
                              <Location size={12} className="shrink-0" />
                              <span className="truncate">{evt.venue}</span>
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hosts to follow */}
                <div className="rounded-base border border-border bg-surface p-4 shadow-card">
                  <h3 className="mb-3 text-subtitle font-bold text-textprimary">Hosts to follow</h3>
                  <SuggestedUsers limit={3} layout="list" showHeading={false} />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Sheet for mobile/tablet comments */}
      <Sheet open={sheetPostId !== null} onClose={() => setSheetPostId(null)}>
        {sheetPostId && <CommentsPanel postId={sheetPostId} className="h-[62vh]" />}
      </Sheet>
    </div>
  );
}
