import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Call, Calendar, More } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { AuthService } from '../../services/authService';
import { EmptyState, Skeleton } from '../../components/ui';
import {
  SocialEventGrid,
  SocialFollowButton,
  SocialProfileAvatar,
  SocialProfileBanner,
  SocialRatingRow,
  SocialStatCard,
  SocialVerifiedBadge,
} from '../../components/SocialProfile';
import { useOwnedEvents, useOrganizerReviews, useUserRow } from '../../components/SocialData';
import { useSavedEvents } from '../../hooks/useSavedEvents';

export default function UserProfileScreen() {
  const { uid: target } = useParams<{ uid: string }>();
  const { uid: me, user } = useAuth();
  const { savedIds, toggleSave } = useSavedEvents();
  const { toast } = useToast();
  const authService = useMemo(() => new AuthService(), []);
  const [menuOpen, setMenuOpen] = useState(false);

  const targetUser = useUserRow(target);
  const { data: events } = useOwnedEvents(target);
  const { data: reviews } = useOrganizerReviews(target);

  const rating = useMemo(() => {
    const list = reviews ?? [];
    if (list.length === 0) return { avg: 0, count: 0 };
    const total = list.reduce((sum, review) => sum + review.rating, 0);
    return { avg: total / list.length, count: list.length };
  }, [reviews]);

  const isSelf = Boolean(target && me === target);
  const blocked = (user?.blockedUids ?? []).includes(target ?? '');
  const published = (events ?? []).filter((event) => event.status === 'published').length;
  const completed = (events ?? []).filter((event) => event.status === 'completed').length;

  async function toggleBlock() {
    if (!me || !target) return;
    const name = targetUser?.name || 'this organizer';
    if (blocked) {
      await authService.unblockUser(me, target);
    } else {
      await authService.blockUser(me, target);
    }
    setMenuOpen(false);
    toast(`${name} ${blocked ? 'unblocked' : 'blocked'}.`);
  }

  if (targetUser === undefined) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading profile">
        <Skeleton className="h-[180px] w-full" />
        <Skeleton radius="rounded-full" className="mx-auto h-24 w-24" />
        <Skeleton className="mx-auto h-5 w-40" />
        <Skeleton className="mx-auto h-4 w-56" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (targetUser === null || !target) {
    return <EmptyState title="Profile not found." body="This account may have been removed." />;
  }

  const name = targetUser.name || 'Organizer';

  return (
    <div className="animate-fadeup">
      <div className="-mx-4 -mt-4 tablet:-mx-6">
        <div className="relative">
          <SocialProfileBanner url={targetUser.bannerUrl} className="h-[180px] tablet:h-[240px]" />
          {!isSelf && (
            <>
              <div className="absolute right-4 top-4 flex gap-2">
                <button
                  type="button"
                  aria-label="More"
                  title="More"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur transition-colors duration-200 hover:bg-white/25"
                >
                  <More size={20} />
                </button>
              </div>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute right-4 top-16 z-20 w-44 animate-fadeup rounded-base border border-border bg-surface py-1 shadow-card">
                    <button
                      type="button"
                      onClick={() => void toggleBlock()}
                      className="w-full px-4 py-2.5 text-left text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-neutralbg"
                    >
                      {blocked ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="relative -mt-12">
        <SocialProfileAvatar name={name} url={targetUser.avatarUrl} />
      </div>

      <div className="mt-3 px-6 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h2 className="min-w-0 truncate text-display text-textprimary">{name}</h2>
          {targetUser.verified && <SocialVerifiedBadge />}
        </div>
        {targetUser.email.trim().length > 0 && (
          <p className="mt-1 truncate text-caption text-textmuted">{targetUser.email}</p>
        )}

        <div className="mt-2">
          <SocialRatingRow avg={rating.avg} count={rating.count} />
        </div>

        {!isSelf && (
          <div className="mt-4">
            <SocialFollowButton targetUserId={target} />
          </div>
        )}
      </div>

      {targetUser.bio.trim().length > 0 && (
        <p className="mt-6 px-6 text-center text-body text-textprimary">{targetUser.bio}</p>
      )}

      {targetUser.phone.trim().length > 0 && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-caption text-textmuted">
          <Call size={14} />
          <span className="min-w-0 truncate">{targetUser.phone}</span>
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2 px-5">
        <SocialStatCard label="Published" value={published} />
        <SocialStatCard label="Completed" value={completed} />
      </div>

      <h3 className="mb-3 mt-8 px-1 text-title text-textprimary">Events</h3>

      {events === undefined ? (
        <div className="grid grid-cols-3 gap-[3px]" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title="No events yet." />
      ) : (
        <SocialEventGrid
          events={events}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          stagger
        />
      )}
    </div>
  );
}
