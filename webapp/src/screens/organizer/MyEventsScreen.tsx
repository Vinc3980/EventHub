import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddCircle, Calendar1, Edit } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { formatDateCard } from '../../lib/format';
import { Event } from '../../models';
import { EventService } from '../../services';
import { ConfirmDialog, CoverMedia, EmptyState, ErrorState, Skeleton, StatusTag, Tabs } from '../../components/ui';
import { OrgRowLink, OrgRows, useServiceLive } from '../../components/OrgKit';

const eventService = new EventService();

type TabKey = 'published' | 'pending_review' | 'draft';

const TABS: { value: TabKey; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
];

function EventRow({ ev, onSubmit }: { ev: Event; onSubmit: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex w-full items-center gap-2 px-4 py-3">
      <Link
        to={`/organizer/events/${ev.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
      </Link>
      <StatusTag status={ev.status} className="shrink-0" />
      {ev.status === 'draft' && (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(`/organizer/events/${ev.id}/edit`)}
            aria-label={`Edit ${ev.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-textmuted transition-colors duration-200 hover:bg-primary-6 hover:text-primary"
          >
            <Edit size={16} />
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-md bg-primary px-2.5 py-1.5 text-caption font-bold text-white transition-[filter] duration-200 hover:brightness-95"
          >
            Submit
          </button>
        </span>
      )}
    </div>
  );
}

export default function MyEventsScreen() {
  const { uid } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('published');
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<Event | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: owned, loading, error } = useServiceLive(
    eventService.eventsByOwner(uid ?? ''),
    [uid, retry],
    [db.events],
  );

  const events = owned ?? [];
  const counts: Record<TabKey, number> = {
    published: events.filter((ev) => ev.status === 'published').length,
    pending_review: events.filter((ev) => ev.status === 'pending_review').length,
    draft: events.filter((ev) => ev.status === 'draft').length,
  };
  const visible = events.filter((ev) => ev.status === tab);

  async function confirmSubmit() {
    if (!pending) return;
    setSubmitting(true);
    try {
      await eventService.submitForReview(pending.id);
    } catch (err) {
      toast(`Could not save: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  }

  if (!uid || loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading events">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load events." onRetry={() => setRetry((n) => n + 1)} />;
  }

  return (
    <div className="space-y-4 animate-fadeup">
      <Tabs
        tabs={TABS.map((item) => ({ ...item, badge: counts[item.value] }))}
        value={tab}
        onChange={(next) => setTab(next as TabKey)}
      />

      <OrgRowLink
        to="/organizer/events/new"
        icon={<AddCircle size={18} />}
        title="Create event"
        subtitle="Set up tickets, agenda and venue"
      />

      {visible.length === 0 ? (
        <div className="rounded-base border border-border bg-surface shadow-card">
          <EmptyState
            icon={<Calendar1 size={26} />}
            title="No events here yet"
            body="Events you create will be listed under this tab."
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
        <OrgRows className="animate-fadeup">
          {visible.map((ev) => (
            <EventRow key={ev.id} ev={ev} onSubmit={() => setPending(ev)} />
          ))}
        </OrgRows>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Submit draft?"
        body={pending ? `"${pending.title}" will be sent for review.` : ''}
        confirmLabel="Submit"
        cancelLabel="Cancel"
        loading={submitting}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmSubmit()}
      />
    </div>
  );
}
