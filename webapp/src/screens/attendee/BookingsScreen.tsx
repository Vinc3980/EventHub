import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar1, Location, Ticket } from 'iconsax-react';
import { EmptyState, ErrorState, Skeleton, StatusTag, Tabs } from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { useLive } from '../../db/live';
import { EventService, RegistrationService } from '../../services';
import { Event, type Booking } from '../../models';
import { formatDateCard } from '../../lib/format';

type Bucket = 'upcoming' | 'pending' | 'past' | 'cancelled';

/**
 * The Tickets hub links here with `?view=…`; map those shortcuts onto the tab
 * the list opens on. `refunds` is the attendee-facing name for cancelled or
 * failed bookings.
 */
const VIEW_TO_BUCKET: Record<string, Bucket> = {
  upcoming: 'upcoming',
  pending: 'pending',
  past: 'past',
  refunds: 'cancelled',
  cancelled: 'cancelled',
};

function bucketOf(booking: Booking, event: Event | null | undefined): Bucket {
  if (booking.status === 'cancelled' || booking.status === 'payment_failed') return 'cancelled';
  if (booking.status === 'pending') return 'pending';
  const finished = event
    ? event.status === 'completed' || event.date.getTime() < Date.now()
    : false;
  if (booking.status === 'confirmed' && finished) return 'past';
  return 'upcoming';
}

export default function BookingsScreen() {
  const { uid } = useAuth();
  const eventService = new EventService();
  const registrationService = new RegistrationService();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const [bucket, setBucket] = useState<Bucket>(VIEW_TO_BUCKET[viewParam ?? ''] ?? 'upcoming');
  const [retry, setRetry] = useState(0);

  // Keep the tab in sync with the URL (back/forward and hub shortcuts).
  useEffect(() => {
    const next = VIEW_TO_BUCKET[viewParam ?? ''];
    if (next) setBucket(next);
  }, [viewParam]);

  function changeBucket(next: Bucket) {
    setBucket(next);
    const query: Record<string, string> =
      next === 'upcoming' ? {} : { view: next === 'cancelled' ? 'refunds' : next };
    setSearchParams(query, { replace: true });
  }

  const { data: bookings, loading, error } = useLive<Booking[]>(
    () => registrationService.bookingsForUser(uid ?? ''),
    [uid, retry],
  );

  const bookingIds = useMemo(() => bookings ?? [], [bookings]);
  const eventIdsKey = useMemo(
    () => Array.from(new Set(bookingIds.map((booking) => booking.eventId))).join(','),
    [bookingIds],
  );

  const eventsById = useLive<Record<string, Event | null>>(
    async () => {
      const map: Record<string, Event | null> = {};
      for (const eventId of eventIdsKey.split(',').filter((id) => id.length > 0)) {
        map[eventId] = await eventService.getEvent(eventId);
      }
      return map;
    },
    [eventIdsKey, retry],
  ).data;

  const counts = useMemo(() => {
    const out: Record<Bucket, number> = { upcoming: 0, pending: 0, past: 0, cancelled: 0 };
    for (const booking of bookingIds) {
      out[bucketOf(booking, eventsById?.[booking.eventId])]++;
    }
    return out;
  }, [bookingIds, eventsById]);

  const rows = useMemo(() => {
    const matched = bookingIds.filter(
      (booking) => bucketOf(booking, eventsById?.[booking.eventId]) === bucket,
    );
    return matched.sort((a, b) => {
      const dateA = eventsById?.[a.eventId]?.date.getTime() ?? 0;
      const dateB = eventsById?.[b.eventId]?.date.getTime() ?? 0;
      return bucket === 'upcoming' ? dateA - dateB : dateB - dateA;
    });
  }, [bookingIds, eventsById, bucket]);

  if (error) {
    return <ErrorState title="Could not load bookings." onRetry={() => setRetry((n) => n + 1)} />;
  }

  return (
    <div className="animate-fadeup">
      <Tabs
        className="mb-4"
        value={bucket}
        onChange={(next) => changeBucket(next as Bucket)}
        tabs={[
          { value: 'upcoming', label: 'Upcoming', badge: counts.upcoming },
          { value: 'pending', label: 'Pending', badge: counts.pending },
          { value: 'past', label: 'Past', badge: counts.past },
          { value: 'cancelled', label: 'Cancelled', badge: counts.cancelled },
        ]}
      />

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bookings">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon={<Ticket size={26} />}
          title="No bookings yet"
          body="Your bookings will appear here after you register for an event."
          action={
            <Link
              to="/explore"
              className="rounded-md border border-border bg-surface px-4 py-2 text-button text-textprimary hover:border-primary hover:text-primary"
            >
              Explore events
            </Link>
          }
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((booking) => {
            const event = eventsById?.[booking.eventId];
            return (
              <Link
                key={booking.id}
                to={`/booking/${booking.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-shadow duration-200 hover:shadow-card"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base bg-primary-10 text-primary">
                  <Calendar1 size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-textprimary">
                    {event?.title ?? 'Booking'}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2 text-caption text-textmuted">
                    {event && (
                      <>
                        <span className="truncate">{formatDateCard(event.date)}</span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Location size={12} className="shrink-0" />
                          <span className="truncate">{event.venue}</span>
                        </span>
                      </>
                    )}
                  </span>
                  {booking.seatNumber && (
                    <span className="mt-1 block text-caption font-semibold text-textprimary">
                      Seat {booking.seatNumber}
                    </span>
                  )}
                </span>
                <StatusTag status={booking.status} className="shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
