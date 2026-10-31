/**
 * Tickets hub (section 3.6) — one tile per booking view, each carrying the
 * live count the destination list shows. The next upcoming event is pinned
 * as a featured countdown tile.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Calendar1, Receipt, Refresh, Star1, Ticket, Timer } from 'iconsax-react';
import { HubPage, type HubTileData } from '../../components/hub';
import { useSavedCount, useTicketCounts } from '../../components/hubCounts';
import { useAuth } from '../../app/AuthProvider';
import { useBookings } from '../../components/SocialData';
import { useLive } from '../../db/live';
import { EventService } from '../../services/eventService';
import { formatDateCard } from '../../lib/format';
import type { Event } from '../../models';

const eventService = new EventService();

/** Featured strip: the next event the user is going to, with a live countdown. */
function NextEventCard() {
  const { uid } = useAuth();
  const { data: bookings } = useBookings(uid);
  const upcomingIds = useMemo(
    () => (bookings ?? []).filter((booking) => booking.status === 'confirmed').map((b) => b.eventId),
    [bookings],
  );

  const nextEvent = useLive<Event | null>(async () => {
    let best: Event | null = null;
    for (const id of Array.from(new Set(upcomingIds))) {
      const event = await eventService.getEvent(id);
      if (!event) continue;
      if (event.date.getTime() < Date.now()) continue;
      if (!best || event.date.getTime() < best.date.getTime()) best = event;
    }
    return best;
  }, [upcomingIds.join(',')]);

  const event = nextEvent.data;
  if (!event) return null;

  const ms = Math.max(0, event.date.getTime() - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);

  return (
    <Link
      to={`/event/${event.id}`}
      className="flex min-w-0 flex-col gap-3 rounded-[20px] p-5 text-white shadow-popover tablet:flex-row tablet:items-center tablet:justify-between"
      style={{ backgroundImage: 'var(--eh-tile-gradient)' }}
    >
      <span className="min-w-0">
        <span className="block text-caption uppercase tracking-wider text-white/80">Your next event</span>
        <span className="mt-1 block min-w-0 truncate text-title font-extrabold">{event.title}</span>
        <span className="mt-0.5 block min-w-0 truncate text-caption text-white/85">
          <Calendar1 size={13} className="mr-1 inline-block align-[-2px]" />
          {formatDateCard(event.date)} · {event.venue}
        </span>
      </span>
      <span className="shrink-0 rounded-base bg-white/15 px-4 py-2 text-center backdrop-blur">
        <span className="block text-caption text-white/80">Starts in</span>
        <span className="block text-subtitle font-extrabold">
          {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
        </span>
      </span>
    </Link>
  );
}

export default function TicketsHub() {
  const counts = useTicketCounts();
  const saved = useSavedCount();

  const tiles: HubTileData[] = [
    {
      id: 'upcoming',
      label: 'Upcoming tickets',
      description: 'Events you are going to.',
      icon: Ticket,
      to: '/tickets?view=upcoming',
      count: counts.upcoming,
    },
    {
      id: 'past',
      label: 'Past events',
      description: 'Tickets you have already used.',
      icon: Calendar1,
      to: '/tickets?view=past',
      count: counts.past,
    },
    {
      id: 'pending',
      label: 'Pending payment',
      description: 'Bookings waiting for MoMo approval.',
      icon: Receipt,
      to: '/tickets?view=pending',
      count: counts.pending,
    },
    {
      id: 'refunds',
      label: 'Refunds & cancellations',
      description: 'Refund requests and cancelled bookings.',
      icon: Refresh,
      to: '/tickets?view=refunds',
      count: counts.cancelled,
    },
    {
      id: 'saved',
      label: 'Saved events',
      description: 'Events you bookmarked.',
      icon: Bookmark,
      to: '/saved',
      count: saved,
    },
    {
      id: 'waitlists',
      label: 'Waitlists',
      description: 'Sold-out tickets you are queued for.',
      icon: Timer,
      to: '/tickets?view=waitlists',
    },
    {
      id: 'reviews',
      label: 'Rate events',
      description: 'Leave a review after you attend.',
      icon: Star1,
      to: '/bookings',
    },
  ];

  return (
    <HubPage
      intro={<NextEventCard />}
      sections={[{ id: 'tickets', title: 'Your tickets', tiles }]}
    />
  );
}
