/**
 * Event picker sheet (section 3.6). Nav entries such as "Guest lists" or
 * "Analytics" are event-scoped (`/organizer/events/:id/<tool>`) but have no
 * event yet — this sheet asks which event, then navigates.
 *
 * Owned by AppShell so the desktop submenu, the mobile drawer and the hub
 * tiles all share one instance.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar1, SearchNormal } from 'iconsax-react';
import { useAuth } from '../app/AuthProvider';
import { useOwnedEvents } from './SocialData';
import { EmptyState, SearchField, Sheet, Skeleton, StatusTag } from './ui';
import { formatDateCard } from '../lib/format';
import type { Event } from '../models';

/** Replace the `:id` placeholder with the chosen event's id. */
export function resolveEventTool(template: string, eventId: string): string {
  return template.replace(':id', encodeURIComponent(eventId));
}

export function EventPickerSheet({
  template,
  onClose,
}: {
  /** The `/organizer/events/:id/<tool>` template; null closes the sheet. */
  template: string | null;
  onClose: () => void;
}) {
  const { uid } = useAuth();
  const navigate = useNavigate();
  const { data: events } = useOwnedEvents(uid);
  const [query, setQuery] = useState('');
  const loading = events === undefined;

  const title = useMemo(() => {
    if (!template) return 'Choose an event';
    const tail = template.split('/').pop() ?? '';
    return `Choose an event for ${tail.replace(/-/g, ' ')}`;
  }, [template]);

  const rows = useMemo(() => {
    const all = [...(events ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime());
    const needle = query.trim().toLowerCase();
    return needle.length > 0
      ? all.filter((event) => event.title.toLowerCase().includes(needle))
      : all;
  }, [events, query]);

  const pick = (event: Event) => {
    if (!template) return;
    const target = resolveEventTool(template, event.id);
    onClose();
    navigate(target);
  };

  return (
    <Sheet open={template !== null} onClose={onClose} title={title}>
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading events">
          <Skeleton className="h-[52px] w-full" />
          <Skeleton className="h-[52px] w-full" />
          <Skeleton className="h-[52px] w-full" />
        </div>
      ) : (events ?? []).length === 0 ? (
        <EmptyState
          icon={<Calendar1 size={26} />}
          title="No events yet"
          body="Create your first event to use this tool."
          action={
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/organizer/events/new');
              }}
              className="rounded-base bg-primary px-4 py-2 text-button text-white hover:brightness-95"
            >
              Create event
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search your events" />
          <ul className="space-y-2">
            {rows.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => pick(event)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-base border border-border bg-surface px-3 py-2.5 text-left transition-colors duration-200 hover:border-primary hover:bg-primary-6"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                    <Calendar1 size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-textprimary">{event.title}</span>
                    <span className="block truncate text-caption text-textmuted">{formatDateCard(event.date)}</span>
                  </span>
                  <StatusTag status={event.status} className="shrink-0" />
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="flex items-center gap-2 px-1 py-6 text-body text-textmuted">
                <SearchNormal size={16} />
                <span className="min-w-0 truncate">No events match “{query}”.</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
