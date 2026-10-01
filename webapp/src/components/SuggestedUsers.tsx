import { Link } from 'react-router-dom';
import { Profile2User } from 'iconsax-react';
import { useAuth } from '../app/AuthProvider';
import { useLive } from '../db/live';
import { db } from '../db/db';
import { followService } from '../services/followService';
import { User } from '../models';
import { formatCount } from '../lib/format';
import { SocialFollowButton, SocialFollowPill } from './SocialProfile';
import { Avatar, Skeleton } from './ui';

export interface SuggestedUsersProps {
  /** How many people to recommend. */
  limit?: number;
  /** `list` = compact rows (Home rail / empty states), `grid` = cards (Explore). */
  layout?: 'list' | 'grid';
  title?: string;
  subtitle?: string;
  /** Set false when the parent already renders a heading. */
  showHeading?: boolean;
  /** Optional name/bio filter (Explore's search box). */
  searchQuery?: string;
  className?: string;
}

/**
 * Organizer-ness comes from owning events (roles no longer distinguish
 * organizer from attendee), so the badges read off the events table.
 */
function roleLabel(user: User, organizerIds: Set<string> | undefined): string {
  return organizerIds?.has(user.uid) === true ? 'Organizer' : 'Member';
}

function metaLine(user: User, organizerIds: Set<string> | undefined): string {
  return `${roleLabel(user, organizerIds)} · ${formatCount(user.followers)} followers`;
}

function SuggestedSkeletons({ layout }: { layout: 'list' | 'grid' }) {
  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-52 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
          <Skeleton className="h-10 w-10 shrink-0" radius="rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20" radius="rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * "People to follow" recommendations — shown when the Home feed has nobody to
 * follow (or nothing to show), and as the `Who to follow` filter in Explore.
 * Ranking lives in `followService.suggestions()`.
 */
export function SuggestedUsers({
  limit = 5,
  layout = 'list',
  title = 'People to follow',
  subtitle = 'Suggested for you',
  showHeading = true,
  searchQuery = '',
  className = '',
}: SuggestedUsersProps) {
  const { uid } = useAuth();
  const { data: suggestions, loading } = useLive<User[]>(
    () => followService.suggestions(uid ?? '', limit),
    [uid, limit],
  );
  const { data: organizerIds } = useLive<Set<string>>(async () => {
    const events = await db.events.toArray();
    return new Set(events.map((event) => String(event.ownerId)));
  }, []);

  if (!uid) return null;

  if (loading || suggestions === undefined) {
    return (
      <section className={className} aria-busy="true" aria-label="Loading suggestions">
        <SuggestedSkeletons layout={layout} />
      </section>
    );
  }

  const needle = searchQuery.trim().toLowerCase();
  const visible =
    needle.length === 0
      ? suggestions
      : suggestions.filter(
          (user) =>
            user.name.toLowerCase().includes(needle) ||
            user.bio.toLowerCase().includes(needle),
        );

  if (visible.length === 0) {
    if (suggestions.length === 0) return null;
    return (
      <section className={className} aria-label={title}>
        <p className="text-body text-textmuted">No people match that search.</p>
      </section>
    );
  }

  const heading = showHeading ? (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-section text-textprimary">
          <Profile2User size={18} className="shrink-0 text-primary" variant="Bold" />
          <span className="truncate">{title}</span>
        </h2>
        {subtitle.trim().length > 0 && (
          <p className="mt-0.5 text-caption text-textmuted">{subtitle}</p>
        )}
      </div>
      <Link
        to="/explore"
        className="shrink-0 text-caption font-semibold text-primary transition-opacity duration-200 hover:opacity-80"
      >
        See more
      </Link>
    </div>
  ) : null;

  if (layout === 'grid') {
    return (
      <section className={className} aria-label={title}>
        {heading}
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
          {visible.map((user) => (
            <article
              key={user.uid}
              className="flex min-w-0 flex-col items-center rounded-lg border border-border bg-surface p-4 text-center shadow-card"
            >
              <Link to={`/u/${user.uid}`} className="min-w-0">
                <Avatar name={user.name} url={user.avatarUrl} size={64} ring />
              </Link>
              <Link
                to={`/u/${user.uid}`}
                className="mt-3 block w-full min-w-0 truncate text-body font-bold text-textprimary hover:text-primary"
              >
                {user.name}
              </Link>
              <p className="mt-1 w-full text-caption text-textmuted">
                {metaLine(user, organizerIds)}
              </p>
              <p
                className="mt-1 line-clamp-2 w-full text-caption text-textmuted"
                title={user.bio}
              >
                {user.bio}
              </p>
              <div className="mt-3 w-full">
                <SocialFollowButton targetUserId={user.uid} />
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={className} aria-label={title}>
      {heading}
      <ul className="space-y-2">
        {visible.map((user) => (
          <li
            key={user.uid}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card"
          >
            <Link to={`/u/${user.uid}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={user.name} url={user.avatarUrl} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-body font-bold text-textprimary">
                    {user.name}
                  </span>
                  {organizerIds?.has(user.uid) === true && (
                    <span className="shrink-0 rounded-pill bg-primary-10 px-2 py-0.5 text-caption font-semibold text-primary">
                      Organizer
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-caption text-textmuted">
                  {metaLine(user, organizerIds)}
                </span>
                {user.bio.trim().length > 0 && (
                  <span className="mt-0.5 block truncate text-caption text-textmuted">
                    {user.bio}
                  </span>
                )}
              </span>
            </Link>
            <SocialFollowPill targetUserId={user.uid} currentUserId={uid} />
          </li>
        ))}
      </ul>
    </section>
  );
}
