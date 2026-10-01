import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Star, TickCircle } from 'iconsax-react';
import { useAuth } from '../app/AuthProvider';
import { followService } from '../services/followService';
import { type Event } from '../models';
import { useIsFollowing } from './SocialData';
import { Avatar, EventGridTile, StatusTag } from './ui';

export function SocialProfileBanner({ url, className = '' }: { url: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-profile-duotone ${className}`}>
      {url.trim().length > 0 && (
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="absolute inset-0 bg-profile-wash" aria-hidden="true" />
    </div>
  );
}

export function SocialVerifiedBadge() {
  return <TickCircle size={18} variant="Bold" className="shrink-0 text-primary" />;
}

export function SocialStatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const body = (
    <div className="w-full rounded-base bg-primary-6 px-2 py-3 text-center">
      <p className="truncate text-title font-extrabold text-textprimary">{value}</p>
      <p className="mt-0.5 truncate text-caption text-textmuted">{label}</p>
    </div>
  );
  if (!onClick) return body;
  return (
    <button type="button" onClick={onClick} className="min-w-0 flex-1">
      {body}
    </button>
  );
}

export function SocialRatingRow({ avg, count }: { avg: number; count: number }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5">
      <span className="inline-flex shrink-0 items-center gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => {
          const star = index + 1;
          const filled = star <= Math.round(avg);
          const half = !filled && star - 0.5 <= avg;
          return (
            <span
              key={star}
              className={filled ? 'text-accent' : half ? 'text-accent opacity-45' : 'text-neutral'}
            >
              <Star size={18} variant={filled || half ? 'Bold' : 'Linear'} />
            </span>
          );
        })}
      </span>
      <span className="min-w-0 truncate text-caption text-textmuted">
        {count > 0 ? `${avg.toFixed(1)} (${count} reviews)` : 'No reviews yet'}
      </span>
    </div>
  );
}

export function SocialFollowButton({
  targetUserId,
  fullWidth = true,
}: {
  targetUserId: string;
  fullWidth?: boolean;
}) {
  const { uid } = useAuth();
  const following = useIsFollowing(uid, targetUserId);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!uid) return;
    setBusy(true);
    try {
      await followService.toggleFollow(uid, targetUserId);
    } finally {
      setBusy(false);
    }
  }

  if (!uid) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-base px-6 text-button font-bold transition-[filter,background-color,border-color,color] duration-200 disabled:cursor-not-allowed ${
        fullWidth ? 'w-full' : ''
      } ${
        following
          ? 'border border-border bg-neutralbg text-textmuted hover:text-textprimary'
          : 'bg-primary text-white hover:brightness-95'
      }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

export function SocialFollowPill({
  targetUserId,
  currentUserId,
}: {
  targetUserId: string;
  currentUserId: string;
}) {
  const following = useIsFollowing(currentUserId, targetUserId);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!currentUserId) return;
    setBusy(true);
    try {
      await followService.toggleFollow(currentUserId, targetUserId);
    } finally {
      setBusy(false);
    }
  }

  if (!currentUserId) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        void toggle();
      }}
      className={`inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-4 text-caption font-semibold transition-colors duration-200 disabled:cursor-not-allowed ${
        following
          ? 'border-border bg-neutralbg text-textmuted'
          : 'border-primary bg-surface text-primary hover:bg-primary-6'
      }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

export function SocialEventGrid({
  events,
  savedIds,
  onToggleSave,
  statuses,
  stagger,
  className = '',
}: {
  events: Event[];
  savedIds: string[];
  onToggleSave: (eventId: string) => void;
  statuses?: Record<string, string>;
  stagger?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-3 gap-[3px] ${className}`}>
      {events.map((event, index) => (
        <div
          key={event.id}
          className={`relative min-w-0 ${stagger ? 'animate-fadeup' : ''}`}
          style={stagger ? { animationDelay: `${Math.min(index * 40, 200)}ms` } : undefined}
        >
          <EventGridTile
            ev={event}
            saved={savedIds.includes(event.id)}
            onSave={() => onToggleSave(event.id)}
            href={`/event/${event.id}`}
          />
          {statuses && statuses[event.id] && statuses[event.id] !== 'published' && (
            <span className="absolute left-2 top-2 z-10">
              <StatusTag status={statuses[event.id]} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function SocialProfileAvatar({ name, url }: { name: string; url: string }) {
  return (
    <span className="flex justify-center">
      <Avatar name={name} url={url} size={96} ring />
    </span>
  );
}

export function SocialBannerLink({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur transition-colors duration-200 hover:bg-white/25"
    >
      {children}
    </Link>
  );
}
