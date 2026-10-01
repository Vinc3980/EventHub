import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Calendar, Setting2, Ticket } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useSavedEvents } from '../../hooks/useSavedEvents';
import { EmptyState, Segmented, Skeleton } from '../../components/ui';
import {
  SocialBannerLink,
  SocialEventGrid,
  SocialProfileAvatar,
  SocialProfileBanner,
  SocialStatCard,
  SocialVerifiedBadge,
} from '../../components/SocialProfile';
import {
  useBookings,
  useEventsByIds,
  useOwnedEvents,
  useUniqueBookingEventIds,
} from '../../components/SocialData';

type ProfileTab = 'events' | 'tickets' | 'saved';

function GridSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-3 gap-[3px]" aria-busy="true" aria-label={label}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <Skeleton key={n} className="aspect-[4/3] w-full" />
      ))}
    </div>
  );
}

export default function ProfileScreen() {
  const { user, uid } = useAuth();
  const { savedIds, toggleSave } = useSavedEvents();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProfileTab>('events');

  const { data: ownedEvents, error: eventsError } = useOwnedEvents(uid);
  const { data: bookings, error: bookingsError } = useBookings(uid);
  const bookingEventIds = useUniqueBookingEventIds(bookings);
  const { data: bookingEvents } = useEventsByIds(bookingEventIds);
  const { data: savedEvents, error: savedError } = useEventsByIds(savedIds);

  const statusByEvent = useMemo(() => {
    const map: Record<string, string> = {};
    for (const booking of bookings ?? []) {
      if (!(booking.eventId in map)) map[booking.eventId] = booking.status;
    }
    return map;
  }, [bookings]);

  if (!user) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading profile">
        <Skeleton className="h-[180px] w-full" />
        <Skeleton radius="rounded-full" className="mx-auto h-24 w-24" />
        <Skeleton className="mx-auto h-5 w-40" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const name = user.name || 'Profile';
  const eventCount = ownedEvents?.length ?? 0;

  function renderOrganizerEvents(): ReactNode {
    if (eventsError) return <EmptyState title="Could not load events." />;
    if (ownedEvents === undefined) return <GridSkeleton label="Loading events" />;
    if (ownedEvents.length === 0) {
      return (
        <EmptyState
          icon={<Calendar size={26} />}
          title="No events yet"
          body="Your events will appear here."
        />
      );
    }
    return (
      <SocialEventGrid events={ownedEvents} savedIds={savedIds} onToggleSave={toggleSave} stagger />
    );
  }

  function renderAttendeeBookings(): ReactNode {
    if (bookingsError) return <EmptyState title="Could not load bookings." />;
    if (bookings === undefined) return <GridSkeleton label="Loading bookings" />;
    if (bookingEventIds.length === 0) {
      return (
        <EmptyState
          icon={<Ticket size={26} />}
          title="No bookings yet"
          body="Your bookings will appear here."
        />
      );
    }
    if (bookingEvents === undefined) return <GridSkeleton label="Loading bookings" />;
    if (bookingEvents.length === 0) return <EmptyState title="Bookings could not be loaded." />;
    return (
      <SocialEventGrid
        events={bookingEvents}
        savedIds={savedIds}
        onToggleSave={toggleSave}
        statuses={statusByEvent}
        stagger
      />
    );
  }

  function renderSaved(): ReactNode {
    if (savedIds.length === 0) {
      return (
        <EmptyState
          icon={<Bookmark size={26} />}
          title="No saved events"
          body="Bookmark events to find them here later."
        />
      );
    }
    if (savedError) return <EmptyState title="Could not load events." />;
    if (savedEvents === undefined) return <GridSkeleton label="Loading saved events" />;
    if (savedEvents.length === 0) {
      return <EmptyState title="Saved events could not be loaded." />;
    }
    return (
      <SocialEventGrid events={savedEvents} savedIds={savedIds} onToggleSave={toggleSave} stagger />
    );
  }

  return (
    <div className="animate-fadeup">
      <div className="-mx-4 -mt-4 tablet:-mx-6">
        <div className="relative">
          <SocialProfileBanner url={user.bannerUrl} className="h-[180px] tablet:h-[240px]" />
          <SocialBannerLink to="/settings" label="Settings">
            <Setting2 size={20} />
          </SocialBannerLink>
        </div>
      </div>

      <div className="relative -mt-12">
        <SocialProfileAvatar name={name} url={user.avatarUrl} />
      </div>

      <div className="mt-3 px-6 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h2 className="min-w-0 truncate text-display text-textprimary">{name}</h2>
          {user.verified && <SocialVerifiedBadge />}
        </div>
        {user.bio.trim().length > 0 && (
          <p className="mx-auto mt-1 max-w-[52ch] text-body text-textprimary">{user.bio}</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 px-5">
        <SocialStatCard label="Events" value={eventCount} />
        <SocialStatCard
          label="Followers"
          value={user.followers}
          onClick={() => navigate(`/u/${uid}/followers`)}
        />
        <SocialStatCard
          label="Following"
          value={user.following}
          onClick={() => navigate(`/u/${uid}/following`)}
        />
      </div>

      <div className="mt-4">
        <Segmented<ProfileTab>
          ariaLabel="Profile sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'events', label: 'Events' },
            { value: 'tickets', label: 'Tickets' },
            { value: 'saved', label: 'Saved' },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === 'events'
          ? renderOrganizerEvents()
          : tab === 'tickets'
            ? renderAttendeeBookings()
            : renderSaved()}
      </div>
    </div>
  );
}
