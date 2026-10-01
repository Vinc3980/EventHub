import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Calendar1 } from 'iconsax-react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { CoverMedia, EmptyState, SearchField, Skeleton, StatusTag, Tabs } from '../../components/ui';
import { Event } from '../../models';

interface EventRow {
  event: Event;
  ownerName: string;
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_FOR_TAB: Record<string, string | null> = {
  all: null,
  pending: 'pending_review',
  published: 'published',
  rejected: 'rejected',
  completed: 'completed',
};

function shortDate(value: Date): string {
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AdminEventsScreen() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');

  const rows = useLiveQuery(async () => {
    const [events, users] = await Promise.all([db.events.toArray(), db.users.toArray()]);
    const nameById = new Map<string, string>();
    for (const user of users) {
      nameById.set(String(user.uid ?? ''), String(user.name ?? 'Unknown'));
    }
    const items: EventRow[] = events.map((row) => ({
      event: Event.fromMap(String(row.id ?? ''), row),
      ownerName: nameById.get(String(row.ownerId ?? '')) ?? 'Unknown',
    }));
    items.sort((a, b) => b.event.date.getTime() - a.event.date.getTime());
    return items;
  }, []);

  if (!rows) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading events">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const wanted = STATUS_FOR_TAB[tab] ?? null;
  const filtered = rows.filter(({ event }) => {
    if (wanted != null && event.status !== wanted) return false;
    if (query.length === 0) return true;
    return (
      event.title.toLowerCase().includes(query) ||
      event.venue.toLowerCase().includes(query) ||
      event.category.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4 animate-fadeup">
      <SearchField value={search} onChange={setSearch} placeholder="Search events..." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Calendar1 size={26} />} title="No events found." />
      ) : (
        <ul className="space-y-2">
          {filtered.map(({ event, ownerName }) => (
            <li key={event.id}>
              <Link
                to={`/admin/events/${event.id}/review`}
                className="flex items-center gap-3 rounded-base border border-border bg-surface p-3.5 shadow-card transition-shadow duration-200 hover:shadow-card"
              >
                <span
                  className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutralbg"
                  style={{ width: 52, height: 52 }}
                >
                  {event.coverImageUrl ? (
                    <CoverMedia
                      url={event.coverImageUrl}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Calendar size={20} className="text-textmuted" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-textprimary">
                    {event.title}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">
                    {shortDate(event.date)} · {capitalize(event.category)}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">
                    by {ownerName}
                  </span>
                </span>
                <StatusTag status={event.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
