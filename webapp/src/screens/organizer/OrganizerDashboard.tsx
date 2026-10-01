import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AddCircle, Calendar1, Profile2User, Ticket, Wallet1 } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { formatCurrency, formatDateCard } from '../../lib/format';
import { Event } from '../../models';
import { EventService } from '../../services';
import { CoverMedia, EmptyState, ErrorState, Skeleton, StatusTag } from '../../components/ui';
import {
  OrgHeading,
  OrgRowLink,
  OrgRows,
  OrgSectionNav,
  OrgStatCard,
  useServiceLive,
} from '../../components/OrgKit';

const eventService = new EventService();

function RecentRow({ ev }: { ev: Event }) {
  return (
    <Link
      to={`/organizer/events/${ev.id}`}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-primary-6"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutralbg text-textmuted [&>svg]:block">
        {ev.coverImageUrl ? (
          <CoverMedia url={ev.coverImageUrl} className="h-full w-full object-cover" />
        ) : (
          <Calendar1 size={20} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-textprimary">{ev.title}</span>
        <span className="mt-0.5 block truncate text-caption text-textmuted">
          {formatDateCard(ev.date)} · {ev.venue}
        </span>
      </span>
      <StatusTag status={ev.status} />
    </Link>
  );
}

export default function OrganizerDashboard() {
  const { uid, user } = useAuth();
  const [retry, setRetry] = useState(0);

  const { data: owned, loading, error } = useServiceLive(
    eventService.eventsByOwner(uid ?? ''),
    [uid, retry],
    [db.events],
  );
  const bookings = useLiveQuery(() => db.bookings.toArray(), [uid], [] as Record<string, unknown>[]) ?? [];
  const payments = useLiveQuery(() => db.payments.toArray(), [uid], [] as Record<string, unknown>[]) ?? [];

  const events = owned ?? [];
  const myEventIds = new Set(events.map((ev) => ev.id));
  const myBookings = bookings.filter((row) => myEventIds.has(String(row.eventId ?? '')));
  const registrations = myBookings.filter((row) => row.status === 'confirmed').length;
  const bookingById = new Map(bookings.map((row) => [String(row.id), row]));
  const revenue = payments.reduce((total, row) => {
    if (row.status !== 'success') return total;
    const booking = bookingById.get(String(row.bookingId ?? ''));
    if (!booking || !myEventIds.has(String(booking.eventId ?? ''))) return total;
    return total + Number(row.organizerPayout ?? 0);
  }, 0);
  const followers = user?.followers ?? 0;
  const recent = events.slice(0, 3);

  if (!uid || loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load events." onRetry={() => setRetry((n) => n + 1)} />;
  }

  return (
    <div className="space-y-6 animate-fadeup">
      <OrgSectionNav current="/organizer" />

      <section>
        <OrgHeading title="Overview" />
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
          <OrgStatCard value={String(events.length)} label="Events" />
          <OrgStatCard value={String(registrations)} label="Registrations" />
          <OrgStatCard value={formatCurrency(revenue)} label="Revenue" hint="After 2% fee" />
          <OrgStatCard value={String(followers)} label="Followers" />
        </div>
      </section>

      <section>
        <OrgHeading title="Quick actions" />
        <OrgRows>
          <OrgRowLink
            to="/organizer/events/new"
            icon={<AddCircle size={18} />}
            title="Create event"
            subtitle="Start a new listing"
          />
          <OrgRowLink
            to="/organizer/events"
            icon={<Ticket size={18} />}
            title="My events"
            subtitle={`${events.length} ${events.length === 1 ? 'event' : 'events'}`}
          />
          <OrgRowLink
            to="/organizer/payouts"
            icon={<Wallet1 size={18} />}
            title="Payouts"
            subtitle="Earnings and payout details"
          />
        </OrgRows>
      </section>

      <section>
        <OrgHeading
          title="Recent events"
          action={
            <Link
              to="/organizer/events"
              className="shrink-0 text-button text-primary transition-opacity duration-200 hover:opacity-80"
            >
              See all
            </Link>
          }
        />
        {events.length === 0 ? (
          <div className="rounded-base border border-border bg-surface shadow-card">
            <EmptyState
              icon={<Ticket size={26} />}
              title="No events yet"
              body="Create your first event and it will show up here."
              action={
                <Link
                  to="/organizer/events/new"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-button text-white transition-[filter] duration-200 hover:brightness-95"
                >
                  <AddCircle size={18} />
                  Create event
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <OrgRows>
              {recent.map((ev) => (
                <RecentRow key={ev.id} ev={ev} />
              ))}
            </OrgRows>
            <p className="mt-2 text-caption text-textmuted">
              {`Showing ${recent.length} of ${events.length} ${events.length === 1 ? 'event' : 'events'}`}
            </p>
          </>
        )}
      </section>

      <section>
        <OrgHeading title="Your profile" />
        <OrgRows>
          <OrgRowLink
            to="/profile"
            icon={<Profile2User size={18} />}
            title={user?.name || 'Your profile'}
            subtitle="Public organizer page"
          />
        </OrgRows>
      </section>
    </div>
  );
}
