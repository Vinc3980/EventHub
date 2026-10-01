import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRotateRight,
  Calendar1,
  Category,
  Chart2,
  CloseCircle,
  Copy,
  DocumentDownload,
  Edit,
  Flash,
  Location,
  Message,
  Profile2User,
  Scan,
  Send,
  Send2,
  Star1,
  Ticket,
  Timer,
  TickCircle,
  UserAdd,
  Warning2,
} from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { formatCurrency, formatDateLong, formatTime, relativeStamp } from '../../lib/format';
import { Booking, Event, GuestListEntry, Message as ChatMessage, Post } from '../../models';
import {
  EventService,
  RegistrationService,
  chatService,
  guestListService,
  notificationService,
  postService,
} from '../../services';
import {
  Button,
  Chip,
  ConfirmDialog,
  CoverMedia,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  SearchField,
  Sheet,
  Skeleton,
  StatusTag,
  Textarea,
} from '../../components/ui';
import { AppVideoPlayer } from '../../components/media/AppVideoPlayer';
import {
  OrgBanner,
  OrgHeading,
  OrgRows,
  OrgStatCard,
  OrgTile,
  downloadTextFile,
  useServiceLive,
} from '../../components/OrgKit';

const eventService = new EventService();
const registrationService = new RegistrationService();

type AttendeeFilter = 'all' | 'checked_in' | 'not_checked_in' | 'cancelled';
type PendingKind = 'submit' | 'cancel-event' | 'attendee' | 'collab';
type Pending = { kind: PendingKind; targetId?: string };

const CONFIRM_COPY: Record<
  PendingKind,
  { title: string; body: (event: Event) => string; confirmLabel: string; cancelLabel: string }
> = {
  submit: {
    title: 'Submit draft?',
    body: (event) => `"${event.title}" will be sent for review.`,
    confirmLabel: 'Submit',
    cancelLabel: 'Cancel',
  },
  'cancel-event': {
    title: 'Cancel this event?',
    body: () => 'Guests will no longer be able to RSVP. This cannot be undone.',
    confirmLabel: 'Cancel event',
    cancelLabel: 'Keep event',
  },
  attendee: {
    title: 'Remove attendee?',
    body: () =>
      'This will cancel their booking and free up their spot. The next person on the waitlist (if any) will be notified.',
    confirmLabel: 'Remove',
    cancelLabel: 'Keep',
  },
  collab: {
    title: 'Remove collaborator?',
    body: () => 'They will lose access to manage this event.',
    confirmLabel: 'Remove',
    cancelLabel: 'Keep',
  },
};

const FILTERS: { value: AttendeeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'not_checked_in', label: 'Not checked in' },
  { value: 'cancelled', label: 'Cancelled' },
];

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function Cover({ src, title }: { src: string; title: string }) {
  const [broken, setBroken] = useState(false);
  if (src !== '' && !broken) {
    if (Event.isVideo(src)) {
      return (
        <AppVideoPlayer
          src={src}
          className="h-44 w-full rounded-base"
          autoPlayMuted
          loop
          onError={() => setBroken(true)}
        />
      );
    }
    return (
      <CoverMedia
        url={src}
        alt={`${title} cover`}
        className="h-44 w-full rounded-base object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="flex h-44 w-full items-center justify-center rounded-base bg-neutralbg" aria-hidden="true">
      <Calendar1 size={40} className="text-textmuted" />
    </div>
  );
}

function AttendeeRow({ booking, onRemove }: { booking: Booking; onRemove: () => void }) {
  const seatLabel = booking.seatNumber === '' ? 'RSVP' : booking.seatNumber;
  const cancelled = booking.status === 'cancelled';
  const statusText = booking.checkedIn ? 'Checked in' : cancelled ? 'Cancelled' : booking.status;
  const statusClass = booking.checkedIn ? 'text-success' : cancelled ? 'text-danger' : 'text-textmuted';
  const Icon = booking.checkedIn ? TickCircle : CloseCircle;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          booking.checkedIn ? 'bg-successbg text-success' : cancelled ? 'bg-dangerbg text-danger' : 'bg-neutralbg text-textmuted'
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-textprimary">{seatLabel}</span>
        <span className={`mt-0.5 block truncate text-caption ${statusClass}`}>{statusText}</span>
      </span>
      {booking.status === 'confirmed' ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md bg-dangerbg px-2.5 py-1.5 text-caption font-semibold text-danger transition-[filter] duration-200 hover:brightness-95"
        >
          Remove
        </button>
      ) : (
        <Icon size={18} className={`shrink-0 ${statusClass}`} />
      )}
    </div>
  );
}

function GuestRow({ entry }: { entry: GuestListEntry }) {
  const detail = [entry.organization, entry.phone].filter((part) => part !== '').join(' · ');
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutralbg text-body font-bold text-textprimary">
        {entry.fullName === '' ? '?' : entry.fullName[0].toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-textprimary">{entry.fullName}</span>
        {detail !== '' && <span className="mt-0.5 block truncate text-caption text-textmuted">{detail}</span>}
      </span>
      {entry.invitedGuestCount > 0 && (
        <span className="shrink-0 rounded-md bg-primary-10 px-2 py-1 text-caption font-bold text-primary">
          +{entry.invitedGuestCount} guests
        </span>
      )}
    </div>
  );
}

export default function OrganizerEventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const { uid } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [retry, setRetry] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [thankYou, setThankYou] = useState('Thank you for celebrating with us.');
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabInput, setCollabInput] = useState('');
  const [postText, setPostText] = useState('');
  const [attendeeFilter, setAttendeeFilter] = useState<AttendeeFilter>('all');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const { data: event, loading: eventLoading, error: eventError } = useLive(async () => {
    await db.events.toArray();
    return eventService.getEvent(eventId);
  }, [eventId, retry]);

  const { data: bookingsData } = useServiceLive(
    registrationService.bookingsForEvent(eventId),
    [eventId, retry],
    [db.bookings],
  );
  const bookings = bookingsData ?? [];

  const { data: guestsData } = useServiceLive(
    guestListService.guestListForEvent(eventId),
    [eventId, retry],
    [db.guestList],
  );
  const guests = guestsData ?? [];

  const { data: postsData } = useServiceLive(postService.postsForEvent(eventId), [eventId, retry], [db.posts]);
  const posts = postsData ?? [];

  const { data: revenue } = useLive(async () => {
    const [bookingRows, paymentRows] = await Promise.all([db.bookings.toArray(), db.payments.toArray()]);
    const ids = new Set(
      bookingRows.filter((row) => String(row['eventId']) === eventId).map((row) => String(row['id'])),
    );
    return paymentRows
      .filter((row) => ids.has(String(row['bookingId'])) && String(row['status']) === 'success')
      .reduce((total, row) => total + Number(row['organizerPayout'] ?? 0), 0);
  }, [eventId, retry]);

  const { data: chatId } = useLive(async () => {
    await db.chats.toArray();
    return chatService.findChatForEvent(eventId);
  }, [eventId, retry]);

  const { data: messagesData } = useServiceLive(chatService.messagesForChat(chatId ?? ''), [chatId], [db.messages]);
  const messages = messagesData ?? [];

  const { data: senderNames } = useLive(async () => {
    const rows = await db.messages.toArray();
    const senders = [
      ...new Set(
        rows
          .filter((row) => String(row['chatId']) === (chatId ?? ''))
          .map((row) => String(row['senderId'])),
      ),
    ];
    const names: Record<string, string> = {};
    await Promise.all(
      senders.map(async (sender) => {
        names[sender] = await chatService.userName(sender);
      }),
    );
    return names;
  }, [chatId]);

  const { data: collabNames } = useLive(async () => {
    const ids = event?.collaboratorIds ?? [];
    const names: Record<string, string> = {};
    await Promise.all(
      ids.map(async (collabId) => {
        const profile = await db.users.get(collabId);
        names[collabId] = String(profile?.['name'] ?? collabId);
      }),
    );
    return names;
  }, [event, retry]);

  async function runPending() {
    if (!pending) return;
    const kind = pending.kind;
    const targetId = pending.targetId ?? '';
    setWorking(kind);
    try {
      if (kind === 'submit') {
        await eventService.submitForReview(eventId);
        toast('Submitted for review.', 'success');
      } else if (kind === 'cancel-event') {
        await eventService.cancelEvent(eventId);
        toast('Event cancelled.', 'success');
        navigate('/organizer/events');
      } else if (kind === 'attendee') {
        await registrationService.cancelBooking(targetId, { byOrganizer: true });
        toast('Attendee removed.', 'success');
      } else {
        await eventService.removeCollaborator(eventId, targetId);
        toast('Collaborator removed.', 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const prefix =
        kind === 'submit' ? 'Could not save' : kind === 'cancel-event' ? 'Could not cancel event' : 'Could not remove';
      toast(`${prefix}: ${message}`, 'error');
    } finally {
      setWorking(null);
      setPending(null);
    }
  }

  async function duplicateEvent() {
    if (!uid || !event) return;
    setWorking('duplicate');
    try {
      const newId = await eventService.duplicateEvent(eventId, uid);
      toast('Event duplicated — pending review.', 'success');
      navigate(`/organizer/events/${newId}/edit`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not duplicate: ${message}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function exportCsv() {
    setWorking('export');
    try {
      const csv = await eventService.exportAttendeeListCsv(eventId);
      downloadTextFile(`${eventId}-attendees.csv`, csv);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Export failed: ${message}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function markCompleted() {
    setWorking('complete');
    try {
      await eventService.markCompleted(eventId);
      toast('Event marked completed.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not save: ${message}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function endEvent() {
    setWorking('end');
    const message = thankYou.trim();
    try {
      await eventService.endEvent(eventId, message === '' ? 'Thank you for celebrating with us.' : message);
      setEndOpen(false);
      toast('Event ended. Thank-you messages sent.', 'success');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Could not end event: ${detail}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function postUpdate() {
    const text = postText.trim();
    if (!text || !uid || !event) return;
    setWorking('post');
    try {
      await postService.createPost(new Post({ id: '', authorId: uid, eventId, text, timestamp: new Date() }));
      for (const booking of bookings) {
        if (booking.status === 'confirmed' && booking.userId !== uid) {
          await notificationService.saveLocal({
            uid: booking.userId,
            title: `New update on ${event.title}`,
            body: text.length > 100 ? `${text.substring(0, 100)}...` : text,
            type: 'event_update',
            targetId: eventId,
          });
        }
      }
      setPostText('');
      toast('Update posted.', 'success');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Could not post update: ${detail}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function messageAttendees() {
    const message = messageText.trim();
    if (!message || !event) return;
    setWorking('message');
    let count = 0;
    try {
      for (const booking of bookings) {
        if (booking.status === 'confirmed' && booking.userId !== event.ownerId) {
          await notificationService.saveLocal({
            uid: booking.userId,
            title: `Message from ${event.title}`,
            body: message,
            type: 'event_update',
            targetId: eventId,
          });
          count += 1;
        }
      }
      setMessageOpen(false);
      setMessageText('');
      toast(`Message sent to ${count} attendees.`, 'success');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Could not send: ${detail}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function addCollaborator() {
    const input = collabInput.trim();
    if (input === '') return;
    setWorking('collab-add');
    try {
      await eventService.addCollaborator(eventId, input);
      toast('Collaborator added.', 'success');
      setCollabOpen(false);
      setCollabInput('');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Could not add collaborator: ${detail}`, 'error');
    } finally {
      setWorking(null);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (text === '' || chatId == null || !uid) return;
    setSending(true);
    try {
      await chatService.sendMessage(chatId, new ChatMessage({ id: '', chatId, senderId: uid, text }));
      setDraft('');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Could not send: ${detail}`, 'error');
    } finally {
      setSending(false);
    }
  }

  async function startChat() {
    if (!uid || !event) return;
    setSending(true);
    try {
      await chatService.ensureChatForEvent({ eventId, userId: uid, ownerId: event.ownerId });
      setRetry((n) => n + 1);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Could not start chat: ${detail}`, 'error');
    } finally {
      setSending(false);
    }
  }

  if (!uid || eventLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading event">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (eventError) {
    return <ErrorState title="Could not load event." onRetry={() => setRetry((n) => n + 1)} />;
  }

  if (!event) {
    return <EmptyState icon={<CloseCircle size={26} className="text-danger" />} title="Event not found." />;
  }

  const isTerminal = event.status === 'cancelled' || event.status === 'completed';
  const isOwner = event.ownerId === uid;
  const canManage = isOwner || event.collaboratorIds.includes(uid);
  const isPast = event.date.getTime() < Date.now();
  const checkedInCount = bookings.filter((booking) => booking.checkedIn).length;
  const confirmedCount = bookings.filter((booking) => booking.status === 'confirmed').length;
  const priceLabel = event.isFree ? 'Free' : `From ${formatCurrency(event.cheapestPrice)}`;
  const featuredLabel = event.featuredUntil ? event.featuredUntil.substring(0, 10) : '—';

  let filtered = bookings;
  if (attendeeFilter === 'checked_in') {
    filtered = filtered.filter((booking) => booking.checkedIn);
  } else if (attendeeFilter === 'not_checked_in') {
    filtered = filtered.filter((booking) => !booking.checkedIn && booking.status !== 'cancelled');
  } else if (attendeeFilter === 'cancelled') {
    filtered = filtered.filter((booking) => booking.status === 'cancelled');
  }
  if (attendeeQuery !== '') {
    const query = attendeeQuery.toLowerCase();
    filtered = filtered.filter(
      (booking) =>
        booking.seatNumber.toLowerCase().includes(query) || booking.status.toLowerCase().includes(query),
    );
  }

  const banner =
    event.status === 'draft' ? (
      <OrgBanner tone="warning" icon={<Warning2 size={20} />} title="Draft" body="Not visible to attendees yet.">
        <Button
          size="sm"
          onClick={() => setPending({ kind: 'submit' })}
          disabled={working !== null}
        >
          Submit for review
        </Button>
      </OrgBanner>
    ) : event.status === 'pending_review' ? (
      <OrgBanner tone="warning" icon={<Timer size={20} />} title="Pending review" body="Waiting for approval." />
    ) : event.status === 'published' ? (
      <OrgBanner
        tone="success"
        icon={<TickCircle size={20} />}
        title="Published"
        body="Live and open for registrations."
      />
    ) : event.status === 'cancelled' ? (
      <OrgBanner
        tone="danger"
        icon={<CloseCircle size={20} />}
        title="Cancelled"
        body="Guests will no longer be able to RSVP."
      />
    ) : (
      <OrgBanner tone="neutral" icon={<TickCircle size={20} />} title="Completed" body="This event has ended." />
    );

  return (
    <div className="space-y-5 animate-fadeup">
      <div className="space-y-3">
        <Cover key={event.coverImageUrl} src={event.coverImageUrl} title={event.title} />
        <div className="flex items-start gap-3">
          <h1 className="min-w-0 flex-1 text-title text-textprimary">{event.title}</h1>
          <StatusTag status={event.status} className="shrink-0" />
        </div>
        {banner}
        <ul className="space-y-2 text-body text-textprimary">
          <li className="flex items-center gap-2.5">
            <Category size={18} className="shrink-0 text-textmuted" />
            <span className="min-w-0 truncate">{capitalize(event.category)}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Calendar1 size={18} className="shrink-0 text-textmuted" />
            <span className="min-w-0 truncate">{formatDateLong(event.date)}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Location size={18} className="shrink-0 text-textmuted" />
            <span className="min-w-0 truncate">{event.venue}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Ticket size={18} className="shrink-0 text-textmuted" />
            <span className="min-w-0 truncate">{priceLabel}</span>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OrgStatCard value={confirmedCount} label="Registrations" loading={bookingsData === undefined} />
        <OrgStatCard
          value={checkedInCount}
          label="Checked in"
          tone="success"
          loading={bookingsData === undefined}
        />
        <OrgStatCard value={formatCurrency(revenue ?? 0)} label="Revenue" hint="After 2% fee" loading={revenue === undefined} />
        <OrgStatCard value={guests.length} label="Guests" loading={guestsData === undefined} />
      </div>

      <section>
        <OrgHeading title="Manage" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OrgTile
            to={`/organizer/events/${eventId}/analytics`}
            icon={<Chart2 size={18} />}
            label="Analytics"
          />
          <OrgTile
            to={`/organizer/events/${eventId}/discounts`}
            icon={<Ticket size={18} />}
            label="Discount codes"
          />
          <OrgTile
            to={`/organizer/events/${eventId}/refunds`}
            icon={<ArrowRotateRight size={18} />}
            label="Refund requests"
          />
          <OrgTile to={`/organizer/events/${eventId}/boost`} icon={<Flash size={18} />} label="Boost event" />
          <OrgTile
            to={`/organizer/events/${eventId}/guests`}
            icon={<Profile2User size={18} />}
            label="Guest list"
          />
          <OrgTile to={`/organizer/events/${eventId}/invite`} icon={<Send2 size={18} />} label="Invitations" />
          <OrgTile to={`/organizer/events/${eventId}/scan`} icon={<Scan size={18} />} label="Scan tickets" />
        </div>
      </section>

      <section className="rounded-base border border-border bg-surface p-4 shadow-card">
        <OrgHeading title="Event actions" />
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Edit size={16} />}
            onClick={() => navigate(`/organizer/events/${eventId}/edit`)}
            disabled={working !== null}
          >
            Edit event
          </Button>
          <Button
            variant="secondary"
            icon={<Copy size={16} />}
            onClick={() => void duplicateEvent()}
            disabled={working !== null}
          >
            Duplicate event
          </Button>
          <Button
            variant="secondary"
            icon={<DocumentDownload size={16} />}
            onClick={() => void exportCsv()}
            disabled={working !== null}
          >
            {working === 'export' ? 'Exporting…' : 'Export CSV'}
          </Button>
          {event.status === 'published' && !event.isCurrentlyFeatured && (
            <Button
              variant="secondary"
              icon={<Flash size={16} />}
              onClick={() => navigate(`/organizer/events/${eventId}/boost`)}
              disabled={working !== null}
            >
              Boost this event
            </Button>
          )}
          {canManage && !isTerminal && (
            <Button
              variant="secondary"
              icon={<Scan size={16} />}
              onClick={() => navigate(`/organizer/events/${eventId}/scan`)}
              disabled={working !== null}
            >
              Scan tickets
            </Button>
          )}
          {event.status === 'completed' && (
            <Button
              variant="secondary"
              icon={<Chart2 size={16} />}
              onClick={() => navigate(`/organizer/events/${eventId}/analytics`)}
              disabled={working !== null}
            >
              View analytics
            </Button>
          )}
        </div>
        {canManage && !isTerminal && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => setPending({ kind: 'cancel-event' })}
              disabled={working !== null}
            >
              {working === 'cancel-event' ? 'Cancelling…' : 'Cancel event'}
            </Button>
            {event.status === 'published' && isPast && (
              <Button
                variant="secondary"
                icon={<Star1 size={16} />}
                onClick={() => {
                  setThankYou('Thank you for celebrating with us.');
                  setEndOpen(true);
                }}
                disabled={working !== null}
              >
                End event
              </Button>
            )}
            {event.status === 'published' && !isPast && (
              <Button
                variant="secondary"
                icon={<TickCircle size={16} />}
                onClick={() => void markCompleted()}
                disabled={working !== null}
              >
                {working === 'complete' ? 'Saving…' : 'Mark completed'}
              </Button>
            )}
          </div>
        )}
        {event.isCurrentlyFeatured && (
          <div className="mt-3 flex items-center gap-3 rounded-base border border-border bg-primary-10 px-4 py-3 text-primary">
            <Star1 size={18} className="shrink-0" />
            <span className="min-w-0 truncate text-caption font-semibold">Featured until {featuredLabel}</span>
          </div>
        )}
      </section>

      {event.ticketTypes.length > 0 && (
        <section>
          <OrgHeading title="Tickets" />
          <OrgRows>
            {event.ticketTypes.map((ticket) => (
              <div key={ticket.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-body font-semibold text-textprimary">{ticket.name}</span>
                <span className="shrink-0 text-body font-bold text-textprimary">
                  {ticket.price === 0 ? 'Free' : formatCurrency(ticket.price)}
                </span>
              </div>
            ))}
          </OrgRows>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-subtitle text-textprimary">Attendees</h2>
          {bookings.length > 0 && (
            <span className="shrink-0 text-caption text-textmuted">
              {checkedInCount}/{bookings.length} checked in
            </span>
          )}
        </div>
        {bookings.length === 0 ? (
          <p className="text-body text-textmuted">No RSVPs yet.</p>
        ) : (
          <div className="space-y-3">
            <SearchField value={attendeeQuery} onChange={setAttendeeQuery} placeholder="Search attendees..." />
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {FILTERS.map((filter) => (
                <Chip
                  key={filter.value}
                  selected={attendeeFilter === filter.value}
                  onClick={() => setAttendeeFilter(filter.value)}
                >
                  {filter.label}
                </Chip>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="text-body text-textmuted">No attendees match your filter.</p>
            ) : (
              <OrgRows>
                {filtered.map((booking) => (
                  <AttendeeRow
                    key={booking.id}
                    booking={booking}
                    onRemove={() => setPending({ kind: 'attendee', targetId: booking.id })}
                  />
                ))}
              </OrgRows>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-subtitle text-textprimary">Guest list</h2>
          <span className="shrink-0 text-caption text-textmuted">
            {guests.length} contact{guests.length === 1 ? '' : 's'}
          </span>
        </div>
        {guests.length === 0 ? (
          <p className="text-body text-textmuted">No guests added yet.</p>
        ) : (
          <OrgRows>
            {guests.map((entry) => (
              <GuestRow key={entry.id} entry={entry} />
            ))}
          </OrgRows>
        )}
      </section>

      {isOwner && (
        <section className="rounded-base border border-border bg-surface p-4 shadow-card">
          <OrgHeading title="Post update" />
          <div className="flex items-center gap-2">
            <Input
              value={postText}
              onChange={(event_) => setPostText(event_.target.value)}
              placeholder="Share an update with attendees..."
              aria-label="Share an update with attendees"
              className="min-w-0"
            />
            <IconButton
              label="Post update"
              onClick={() => void postUpdate()}
              disabled={postText.trim() === '' || working === 'post'}
              className="shrink-0 bg-primary text-white hover:bg-primary"
            >
              <Send size={18} />
            </IconButton>
          </div>
          <div className="mt-3">
            <Button
              variant="secondary"
              fullWidth
              icon={<Send2 size={16} />}
              onClick={() => setMessageOpen(true)}
              disabled={bookings.length === 0}
            >
              Message all attendees
            </Button>
          </div>
          {posts.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {posts.slice(0, 3).map((post) => (
                <div key={post.id}>
                  <p className="whitespace-pre-wrap break-words text-body text-textprimary">{post.text}</p>
                  <p className="mt-1 text-caption text-textmuted">{relativeStamp(post.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <OrgHeading title="Chat" />
        <div className="rounded-base border border-border bg-surface shadow-card">
          {chatId == null ? (
            <EmptyState
              icon={<Message size={26} />}
              title="No messages yet."
              body="Send the first message!"
              action={
                <Button onClick={() => void startChat()} loading={sending}>
                  Start chat
                </Button>
              }
            />
          ) : (
            <>
              <div className="max-h-72 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="whitespace-pre-line text-body text-textmuted">
                    {'No messages yet.\nSend the first message!'}
                  </p>
                ) : (
                  messages.map((message) => {
                    const mine = message.senderId === uid;
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`min-w-0 max-w-[85%] rounded-base px-3 py-2 ${
                            mine ? 'bg-primary text-white' : 'bg-neutralbg text-textprimary'
                          }`}
                        >
                          {!mine && (
                            <p className="truncate text-caption font-bold text-textprimary">
                              {senderNames?.[message.senderId] ?? 'Guest'}
                            </p>
                          )}
                          <p className="break-words text-body">{message.text}</p>
                          <p className={`mt-0.5 text-caption ${mine ? 'text-white/70' : 'text-textmuted'}`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                className="flex items-center gap-2 border-t border-border p-3"
                onSubmit={(event_) => {
                  event_.preventDefault();
                  void sendMessage();
                }}
              >
                <Input
                  value={draft}
                  onChange={(event_) => setDraft(event_.target.value)}
                  placeholder="Type a message..."
                  aria-label="Type a message"
                  className="min-w-0"
                />
                <IconButton label="Send message" type="submit" disabled={sending || draft.trim() === ''} className="shrink-0">
                  <Send size={18} />
                </IconButton>
              </form>
            </>
          )}
        </div>
      </section>

      {isOwner && (
        <section>
          <OrgHeading
            title="Team"
            action={
              <button
                type="button"
                onClick={() => setCollabOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-10 px-2.5 text-caption font-bold text-primary transition-colors duration-200 hover:bg-primary-6"
              >
                <UserAdd size={14} />
                Add
              </button>
            }
          />
          {event.collaboratorIds.length === 0 ? (
            <p className="text-body text-textmuted">No collaborators added yet.</p>
          ) : (
            <OrgRows>
              {event.collaboratorIds.map((collabId) => (
                <div key={collabId} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutralbg text-body font-bold text-textprimary">
                    {(collabNames?.[collabId] ?? collabId)[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-textprimary">
                      {collabNames?.[collabId] ?? collabId}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-textmuted">Collaborator</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPending({ kind: 'collab', targetId: collabId })}
                    className="shrink-0 rounded-md bg-dangerbg px-2.5 py-1.5 text-caption font-semibold text-danger transition-[filter] duration-200 hover:brightness-95"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </OrgRows>
          )}
        </section>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? CONFIRM_COPY[pending.kind].title : ''}
        body={pending && event ? CONFIRM_COPY[pending.kind].body(event) : ''}
        confirmLabel={pending ? CONFIRM_COPY[pending.kind].confirmLabel : 'Confirm'}
        cancelLabel={pending ? CONFIRM_COPY[pending.kind].cancelLabel : 'Cancel'}
        danger={pending?.kind !== 'submit'}
        loading={working === pending?.kind}
        onCancel={() => setPending(null)}
        onConfirm={() => void runPending()}
      />

      <Sheet
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="End this event?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)} disabled={working === 'end'}>
              Cancel
            </Button>
            <Button onClick={() => void endEvent()} loading={working === 'end'}>
              End event
            </Button>
          </>
        }
      >
        <p className="text-body text-textmuted">
          This will mark the event as completed, make the chat read-only, and send thank-you messages to checked-in
          attendees.
        </p>
        <Field label="Thank-you message" className="mt-4">
          <Textarea
            value={thankYou}
            onChange={(event_) => setThankYou(event_.target.value)}
            aria-label="Thank-you message"
            className="min-h-[88px]"
          />
        </Field>
      </Sheet>

      <Sheet
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title="Message all attendees"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMessageOpen(false)} disabled={working === 'message'}>
              Cancel
            </Button>
            <Button
              onClick={() => void messageAttendees()}
              loading={working === 'message'}
              disabled={messageText.trim() === ''}
            >
              Send
            </Button>
          </>
        }
      >
        <p className="text-body text-textmuted">
          Send a message to {confirmedCount} confirmed attendees.
        </p>
        <div className="mt-4">
          <Textarea
            value={messageText}
            onChange={(event_) => setMessageText(event_.target.value)}
            placeholder="Enter your message..."
            aria-label="Enter your message"
          />
        </div>
      </Sheet>

      <Sheet
        open={collabOpen}
        onClose={() => setCollabOpen(false)}
        title="Add collaborator"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCollabOpen(false)} disabled={working === 'collab-add'}>
              Cancel
            </Button>
            <Button onClick={() => void addCollaborator()} loading={working === 'collab-add'}>
              Add
            </Button>
          </>
        }
      >
        <Input
          value={collabInput}
          onChange={(event_) => setCollabInput(event_.target.value)}
          placeholder="Enter user name or id"
          aria-label="Enter user name or id"
          onKeyDown={(event_) => {
            if (event_.key === 'Enter') {
              event_.preventDefault();
              void addCollaborator();
            }
          }}
        />
      </Sheet>
    </div>
  );
}
