import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar1, Location, Timer1 } from 'iconsax-react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { EventService } from '../../services/eventService';
import { useToast } from '../../app/ToastProvider';
import {
  Avatar,
  Button,
  CategoryIcon,
  CoverMedia,
  Field,
  SectionHeader,
  Skeleton,
  StatusTag,
  Textarea,
  Sheet,
} from '../../components/ui';
import { Event } from '../../models';
import { formatCurrency, formatDateLong } from '../../lib/format';

type Busy = 'approve' | 'reject' | null;

const eventService = new EventService();

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

export default function EventReviewScreen() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const row = useLiveQuery(async () => (id ? await db.events.get(id) : undefined), [id]);
  const owner = useLiveQuery(async () => {
    if (!row) return null;
    const uid = String(row.ownerId ?? '');
    if (uid.length === 0) return null;
    return await db.users.get(uid);
  }, [row]);
  const schedule = useLiveQuery(async () => {
    const rows = await db.eventSchedules.toArray();
    return rows
      .filter((item) => String(item.eventId ?? '') === id)
      .map((item) => ({
        id: String(item.id ?? ''),
        dayLabel: String(item.dayLabel ?? ''),
        dayNumber: Number(item.dayNumber ?? 0),
        time: String(item.time ?? ''),
        title: String(item.title ?? ''),
        details: String(item.details ?? ''),
        order: Number(item.order ?? 0),
      }))
      .sort((a, b) => a.dayNumber - b.dayNumber || a.order - b.order);
  }, [id]);

  async function approve() {
    if (!id) return;
    setBusy('approve');
    try {
      await eventService.approveEvent(id);
      toast.success('Event approved.');
    } catch (error) {
      toast.error(`Could not approve: ${String(error)}`);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!id) return;
    setBusy('reject');
    try {
      await eventService.rejectEvent(id);
      const updated = await db.events.get(id);
      if (updated) {
        await db.events.put({ ...updated, rejectionReason: reason.trim() });
      }
      setRejectOpen(false);
      setReason('');
      toast.success('Event rejected.');
    } catch (error) {
      toast.error(`Could not reject: ${String(error)}`);
    } finally {
      setBusy(null);
    }
  }

  if (row === undefined) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading event">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (row === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-subtitle text-textprimary">Event not found.</p>
      </div>
    );
  }

  const event = Event.fromMap(String(row.id ?? ''), row);
  const ownerName = String(owner?.name ?? 'Organizer');
  const pending = event.status === 'pending_review';

  return (
    <div className="space-y-5 animate-fadeup">
      <div className="h-44 w-full overflow-hidden rounded-lg bg-neutralbg tablet:h-64">
        <CoverMedia
          url={event.coverImageUrl}
          alt={event.title}
          className="h-full w-full object-cover"
          fallback={
            <span className="flex h-full w-full items-center justify-center text-textmuted">
              <Calendar1 size={48} />
            </span>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="min-w-0 flex-1 text-display text-textprimary">{event.title}</h2>
        <StatusTag status={event.status} />
      </div>

      <div className="inline-flex max-w-full items-center gap-2 rounded-pill border border-border bg-surface px-3 py-2">
        <Avatar name={ownerName} url={String(owner?.avatarUrl ?? '')} size={28} />
        <span className="min-w-0 truncate text-body font-semibold text-textprimary">
          {ownerName}
        </span>
      </div>

      <ul className="space-y-2.5">
        <li className="flex items-center gap-2.5 text-body text-textprimary">
          <Calendar1 size={18} className="shrink-0 text-textmuted" />
          <span className="min-w-0">{formatDateLong(event.date)}</span>
        </li>
        <li className="flex items-center gap-2.5 text-body text-textprimary">
          <Location size={18} className="shrink-0 text-textmuted" />
          <span className="min-w-0 break-words">{event.venue}</span>
        </li>
        <li className="flex items-center gap-2.5 text-body text-textprimary">
          <CategoryIcon category={event.category} size={18} className="shrink-0 text-textmuted" />
          <span className="min-w-0">{capitalize(event.category)}</span>
        </li>
      </ul>

      {event.ticketTypes.length > 0 && (
        <section>
          <SectionHeader title="Ticket tiers" />
          <ul className="space-y-2">
            {event.ticketTypes.map((tier) => (
              <li
                key={tier.name}
                className="flex items-center gap-3 rounded-base border border-border bg-surface px-4 py-3 shadow-card"
              >
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-textprimary">
                  {tier.name}
                </span>
                <span className="shrink-0 text-body font-bold text-primary">
                  {tier.price === 0 ? 'Free' : formatCurrency(tier.price)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title="Description" />
        <p className="whitespace-pre-line rounded-base border border-border bg-surface p-4 text-body text-textmuted shadow-card">
          {event.description}
        </p>
      </section>

      {schedule && schedule.length > 0 && (
        <section>
          <SectionHeader title="Schedule" />
          <ul className="space-y-2">
            {schedule.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-base border border-border bg-surface p-3.5 shadow-card"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-10 text-primary">
                  <Timer1 size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-bold text-textprimary">{item.title}</span>
                  <span className="block text-caption text-textmuted">
                    {item.dayLabel}
                    {item.time && item.dayLabel ? ` · ${item.time}` : item.time}
                  </span>
                  {item.details && (
                    <span className="mt-1 block text-caption text-textmuted">{item.details}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => void approve()} loading={busy === 'approve'} disabled={!pending}>
          Approve
        </Button>
        <Button
          size="lg"
          variant="danger"
          onClick={() => setRejectOpen(true)}
          disabled={!pending || busy != null}
        >
          Reject
        </Button>
      </div>

      <Sheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject event"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={busy === 'reject'}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void reject()} loading={busy === 'reject'}>
              Reject
            </Button>
          </>
        }
      >
        <Field label="Reason">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this event being rejected?"
          />
        </Field>
      </Sheet>
    </div>
  );
}
