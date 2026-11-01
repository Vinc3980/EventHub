import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown2,
  Calendar1,
  Flag,
  Gallery,
  InfoCircle,
  Location,
  Map,
  More,
  NotificationBing,
  People,
  Star,
  Timer,
} from 'iconsax-react';
import {
  Avatar,
  Button,
  CoverMedia,
  EmptyState,
  ErrorState,
  FeaturedBadge,
  IconButton,
  SaveButton,
  SectionHeader,
  Sheet,
  Skeleton,
  Stars,
} from '../../components/ui';
import EventReportDialog from '../../components/EventReportDialog';
import { AppVideoPlayer } from '../../components/media/AppVideoPlayer';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import { db } from '../../db/db';
import { useSavedEvents } from '../../hooks/useSavedEvents';
import {
  EventService,
  eventScheduleService,
  followService,
  guestListService,
  postService,
  RegistrationService,
  reviewService,
  WaitlistService,
} from '../../services';
import {
  Event,
  WaitlistEntry,
  type EventScheduleItem,
  type GuestListEntry,
  type Post,
  type Review,
} from '../../models';
import { formatCurrency, formatDateLong, formatListStamp } from '../../lib/format';

function Section({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-neutralbg"
      >
        <span className="shrink-0 text-primary [&>svg]:block">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-subtitle text-textprimary">{title}</span>
        {count != null && <span className="shrink-0 text-caption text-textmuted">{count}</span>}
        <ArrowDown2
          size={18}
          className={`shrink-0 text-textmuted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
    </section>
  );
}

export default function EventDetailScreen() {
  const { eventId = '' } = useParams();
  const { uid } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedEvents();

  const eventService = new EventService();
  const registrationService = new RegistrationService();
  const waitlistService = new WaitlistService();

  const [retry, setRetry] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const {
    data: event,
    loading,
    error,
  } = useLive<Event | null>(() => eventService.getEvent(eventId), [eventId, retry]);

  const profiles = useLive<Record<string, { name: string; avatarUrl: string }>>(
    async () => {
      const rows = await db.users.toArray();
      const map: Record<string, { name: string; avatarUrl: string }> = {};
      for (const row of rows) {
        map[String(row.uid ?? '')] = {
          name: String(row.name ?? ''),
          avatarUrl: String(row.avatarUrl ?? ''),
        };
      }
      return map;
    },
    [retry],
  ).data;

  const guestList =
    useLive<GuestListEntry[]>(() => guestListService.guestListForEvent(eventId), [eventId, retry])
      .data ?? [];

  const schedule =
    useLive<EventScheduleItem[]>(
      () => eventScheduleService.scheduleForEvent(eventId),
      [eventId, retry],
    ).data ?? [];

  const updates =
    useLive<Post[]>(() => postService.postsForEvent(eventId), [eventId, retry]).data ?? [];

  const reviews =
    useLive<Review[]>(() => reviewService.reviewsForEvent(eventId), [eventId, retry]).data ?? [];

  const bookings =
    useLive(() => registrationService.bookingsForEvent(eventId), [eventId, retry]).data ?? [];

  const bookingKey = bookings.map((booking) => booking.id).join(',');

  const attendeeCount =
    useLive<number>(() => eventService.confirmedAttendeeCount(eventId), [eventId, retry, bookingKey])
      .data ?? 0;

  const capacity = useLive<Record<string, number>>(
    async () => {
      if (!event) return {};
      const out: Record<string, number> = {};
      for (const tier of event.ticketTypes) {
        out[tier.name] = await eventService.remainingCapacity(eventId, tier.name);
      }
      return out;
    },
    [eventId, event?.ticketTypes.map((tier) => tier.name).join('|') ?? ''],
  ).data;

  const attendeeRows = useLive<{ id: string; name: string; seat: string; checkedIn: boolean }[]>(
    async () => {
      const rows: { id: string; name: string; seat: string; checkedIn: boolean }[] = [];
      for (const booking of bookings) {
        const reg = await db.registrations.get(booking.regId);
        rows.push({
          id: booking.id,
          name: String(reg?.fullName ?? 'Attendee'),
          seat: booking.seatNumber,
          checkedIn: booking.checkedIn,
        });
      }
      return rows;
    },
    [bookingKey],
  ).data;

  const organizerId = event?.ownerId ?? '';
  const isFollowing =
    useLive<boolean>(
      () => followService.isFollowingStream(uid ?? '', organizerId),
      [uid, organizerId],
    ).data ?? false;

  const organizer = profiles?.[organizerId];

  const mapHref = useMemo(() => {
    if (!event) return '';
    return `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`;
  }, [event]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading event">
        <Skeleton className="h-56 w-full" radius="rounded-lg" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load event." onRetry={() => setRetry((n) => n + 1)} />;
  }

  if (!event) {
    return <EmptyState title="Event not found." />;
  }

  const isFree = event.isFree;
  const cheapest = event.cheapestPrice;

  async function joinWaitlist(tierName: string) {
    if (!uid) return;
    setJoining(tierName);
    try {
      const position = await waitlistService.joinWaitlist(
        new WaitlistEntry({
          id: '',
          eventId,
          userId: uid,
          ticketType: tierName,
          position: 0,
          createdAt: new Date(),
        }),
      );
      success(`You're #${position} on the waitlist for ${tierName}.`);
    } catch {
      showError('Something went wrong.');
    } finally {
      setJoining(null);
    }
  }

  async function toggleFollow() {
    if (!uid || !organizerId) return;
    try {
      await followService.toggleFollow(uid, organizerId);
    } catch {
      showError('Something went wrong.');
    }
  }

  /**
   * Ticket panel — rendered in the sticky right column on desktop and inline
   * above the sections on phones/tablets. `withCta` is false on mobile because
   * the sticky bottom bar carries the same call to action there.
   */
  const renderTickets = (withCta: boolean) => {
    return (
      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-subtitle text-textprimary">Select ticket</h2>
        </div>
        {event.ticketTypes.length === 0 && (
          <p className="px-4 py-4 text-body text-textmuted">Free entry</p>
        )}
        {event.ticketTypes.map((tier) => {
          const remaining = capacity?.[tier.name];
          const soldOut = remaining === 0;
          return (
            <div
              key={tier.name}
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-body font-bold text-textprimary">{tier.name}</p>
                <p className="truncate text-caption text-textmuted">
                  {soldOut
                    ? 'Sold out'
                    : remaining != null && remaining >= 0
                      ? `${remaining} of ${tier.capacity} left`
                      : `${tier.capacity} left`}
                </p>
                <span className="mt-1 inline-block">
                  {tier.effectivePrice > 0 ? (
                    <span className="text-body font-bold text-primary">
                      {formatCurrency(tier.effectivePrice)}
                    </span>
                  ) : (
                    <span className="text-body font-bold text-success">Free</span>
                  )}
                </span>
              </div>
              {soldOut ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={joining === tier.name}
                  onClick={() => void joinWaitlist(tier.name)}
                >
                  Join waitlist
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(`/event/${eventId}/register`, { state: { tier: tier.name } })
                  }
                >
                  {tier.effectivePrice > 0
                    ? formatCurrency(tier.effectivePrice, { compact: true })
                    : 'Free'}
                </Button>
              )}
            </div>
          );
        })}
        {withCta && (
          <div className="border-t border-border p-4">
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate(`/event/${eventId}/register`)}
            >
              {isFree ? 'RSVP Free' : `Get Tickets — ${formatCurrency(cheapest, { compact: true })}`}
            </Button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="animate-fadeup pb-4">
      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---- Main column -------------------------------------------- */}
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="relative aspect-video w-full overflow-hidden bg-neutralbg">
          {event.isVideoUrl ? (
            <AppVideoPlayer
              src={event.coverImageUrl}
              className="h-full w-full"
              autoPlayMuted
              loop
            />
          ) : (
            <CoverMedia
              url={event.coverImageUrl}
              className="h-full w-full object-cover"
              fallback={
                <div
                  className="h-full w-full"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
                  }}
                  aria-hidden="true"
                />
              }
            />
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-pill bg-surface/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-textprimary backdrop-blur">
              {event.category}
            </span>
            {event.isCurrentlyFeatured && <FeaturedBadge />}
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <SaveButton saved={isSaved(event.id)} onClick={() => toggleSave(event.id)} />
            <IconButton
              label="More"
              className="bg-surface/90 backdrop-blur"
              onClick={() => setMenuOpen(true)}
            >
              <More size={20} />
            </IconButton>
          </div>
        </div>

        <div className="p-4">
          <h1 className="text-display text-textprimary">{event.title}</h1>

          <div className="mt-3 flex flex-col gap-2 text-body text-textmuted">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Calendar1 size={16} className="shrink-0 text-primary" />
              <span className="min-w-0 truncate">{formatDateLong(event.date)}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-2">
              <Location size={16} className="shrink-0 text-primary" />
              <span className="min-w-0 truncate">{event.venue}</span>
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-base border border-border bg-neutralbg p-3">
            <Avatar name={organizer?.name ?? 'Organizer'} url={organizer?.avatarUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption text-textmuted">Organized by</p>
              <Link
                to={`/u/${organizerId}`}
                className="block truncate text-body font-bold text-textprimary hover:text-primary"
              >
                {organizer?.name ?? 'Organizer'}
              </Link>
            </div>
            <Button
              size="sm"
              variant={isFollowing ? 'outline' : 'primary'}
              onClick={() => void toggleFollow()}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>

          {attendeeCount > 0 && (
            <p className="mt-3 text-caption text-textmuted">
              {attendeeCount === 1
                ? '1 person is attending'
                : `${attendeeCount} people are attending`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Phones and tablets: tickets sit inline above the sections. */}
        <div className="desktop:hidden">{renderTickets(false)}</div>

        <Section
          title="About this event"
          icon={<InfoCircle size={18} />}
          defaultOpen
        >
          <p className="whitespace-pre-line text-body text-textmuted">{event.description}</p>
        </Section>

        <Section title="Guest list" icon={<People size={18} />} count={guestList.length + (attendeeRows?.length ?? 0)}>
          <div className="space-y-4">
            <div>
              <p className="text-section uppercase tracking-wide text-textmuted">
                Honored guests · {guestList.length}
              </p>
              <div className="mt-2 space-y-2">
                {guestList.length === 0 && <p className="text-body text-textmuted">No guests yet.</p>}
                {guestList.map((guest) => (
                  <div key={guest.id} className="flex items-center gap-3">
                    <Avatar name={guest.fullName} size={32} />
                    <span className="min-w-0 truncate text-body text-textprimary">
                      {guest.fullName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-section uppercase tracking-wide text-textmuted">
                Attendees · {attendeeRows?.length ?? 0}
              </p>
              <div className="mt-2 space-y-2">
                {(attendeeRows ?? []).length === 0 && (
                  <p className="text-body text-textmuted">No guests yet.</p>
                )}
                {(attendeeRows ?? []).map((row) => (
                  <div key={row.id} className="flex items-center gap-3">
                    <Avatar name={row.name} size={32} />
                    <span className="min-w-0 flex-1 truncate text-body text-textprimary">
                      {row.name}
                    </span>
                    <span className="shrink-0 text-caption text-textmuted">
                      {row.checkedIn ? `Checked in · ${row.seat}` : row.seat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Schedule" icon={<Timer size={18} />} count={schedule.length}>
          {schedule.length === 0 ? (
            <p className="text-body text-textmuted">No schedule yet.</p>
          ) : (
            <div className="space-y-3">
              {schedule.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="w-24 shrink-0 text-caption font-bold text-primary">
                    {item.dayLabel}
                    {item.time ? ` · ${item.time}` : ''}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body font-bold text-textprimary">{item.title}</span>
                    {item.details && (
                      <span className="block text-caption text-textmuted">{item.details}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Updates" icon={<NotificationBing size={18} />} count={updates.length}>
          {updates.length === 0 ? (
            <p className="text-body text-textmuted">No updates yet.</p>
          ) : (
            <div className="space-y-4">
              {updates.map((post) => (
                <article key={post.id} className="flex gap-3">
                  <Avatar name={profiles?.[post.authorId]?.name ?? 'Organizer'} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-body font-bold text-textprimary">
                        {profiles?.[post.authorId]?.name ?? 'Organizer'}
                      </span>
                      <span className="shrink-0 text-caption text-textmuted">
                        {formatListStamp(post.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-body text-textmuted">
                      {post.text}
                    </p>
                    {post.mediaUrl &&
                      (post.isVideo ? (
                        <AppVideoPlayer
                          src={post.mediaUrl}
                          className="mt-2 max-h-64 w-full rounded-md"
                          muted
                          loop
                        />
                      ) : (
                        <img
                          src={post.mediaUrl}
                          alt=""
                          loading="lazy"
                          className="mt-2 max-h-64 w-full rounded-md object-cover"
                        />
                      ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="Reviews" icon={<Star size={18} />} count={reviews.length}>
          {reviews.length === 0 ? (
            <p className="text-body text-textmuted">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="flex gap-3">
                  <Avatar name={profiles?.[review.userId]?.name ?? 'Guest'} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-body font-bold text-textprimary">
                        {profiles?.[review.userId]?.name ?? 'Guest'}
                      </span>
                      <Stars value={review.rating} size={14} />
                    </div>
                    {review.comment && (
                      <p className="mt-0.5 text-body text-textmuted">{review.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {event.status === 'completed' && (
          <Section title="Photos" icon={<Gallery size={18} />} count={event.allMediaUrls.length}>
            <div className="grid grid-cols-3 gap-2">
              {event.allMediaUrls.slice(0, 6).map((url) => (
                <CoverMedia
                  key={url}
                  url={url}
                  className="aspect-square w-full rounded-md object-cover"
                />
              ))}
            </div>
            <div className="mt-3">
              <Link
                to={`/event/${eventId}/photos`}
                className="text-button text-primary transition-opacity duration-200 hover:opacity-80"
              >
                See all photos
              </Link>
            </div>
          </Section>
        )}

        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeader title="Venue" />
          <p className="text-body text-textprimary">{event.venue}</p>
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-button text-primary transition-opacity duration-200 hover:opacity-80"
          >
            <Map size={16} />
            View on map
          </a>
        </section>
      </div>
        </div>

        {/* ---- Sticky ticket panel (desktop) -------------------------- */}
        <aside className="hidden desktop:block" aria-label="Tickets">
          <div className="sticky top-[88px]">{renderTickets(true)}</div>
        </aside>
      </div>

      <div className="sticky bottom-[68px] z-30 -mx-4 mt-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur desktop:hidden">
        <Button
          fullWidth
          size="lg"
          onClick={() => navigate(`/event/${eventId}/register`)}
        >
          {isFree ? 'RSVP Free' : `Get Tickets — ${formatCurrency(cheapest, { compact: true })}`}
        </Button>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Event options">
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setReportOpen(true);
          }}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-body text-danger transition-colors duration-200 hover:bg-dangerbg"
        >
          <Flag size={18} />
          Report event
        </button>
      </Sheet>

      <EventReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="event"
        targetId={eventId}
      />
    </div>
  );
}
