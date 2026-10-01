import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Profile2User, TickCircle } from 'iconsax-react';
import {
  EmptyState,
  ErrorState,
  EventGridTile,
  SearchField,
  Skeleton,
} from '../../components/ui';
import { SuggestedUsers } from '../../components/SuggestedUsers';
import { useAuth } from '../../app/AuthProvider';
import { useLive } from '../../db/live';
import { useSavedEvents } from '../../hooks/useSavedEvents';
import { db } from '../../db/db';
import { EventService } from '../../services';
import { Event, type EventCategory } from '../../models';

type CategoryFilter = EventCategory | 'all';
type DateFilter = 'any' | 'weekend';

function isThisWeekend(date: Date): boolean {
  const endOfToday = new Date();
  const startOfToday = new Date(endOfToday.getFullYear(), endOfToday.getMonth(), endOfToday.getDate());
  const daysUntilSaturday = (6 - startOfToday.getDay() + 7) % 7;
  const saturday = startOfToday.getTime() + daysUntilSaturday * 86400000;
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return day >= saturday && day <= saturday + 2 * 86400000 - 1;
}

function BackdropChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center rounded-pill border px-3.5 text-[13px] font-semibold backdrop-blur transition-colors duration-200 ${
        selected
          ? 'border-white bg-white text-primary'
          : 'border-white/30 bg-black/20 text-white hover:border-white'
      }`}
    >
      {children}
    </button>
  );
}

export default function ExploreScreen() {
  const { isSaved, toggleSave } = useSavedEvents();
  const { uid } = useAuth();
  const eventService = new EventService();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [freeOnly, setFreeOnly] = useState(false);
  const [peopleOnly, setPeopleOnly] = useState(false);
  const [retry, setRetry] = useState(0);

  const { data: events, loading, error } = useLive<Event[]>(
    () => eventService.publishedEventsFeed(),
    [retry],
  );

  const ownerNames = useLive<Record<string, string>>(
    async () => {
      const rows = await db.users.toArray();
      const map: Record<string, string> = {};
      for (const row of rows) map[String(row.uid ?? '')] = String(row.name ?? '');
      return map;
    },
    [retry],
  ).data;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (events ?? []).filter((ev) => {
      if (category !== 'all' && ev.category !== category) return false;
      if (freeOnly && !ev.isFree) return false;
      if (dateFilter === 'weekend' && !isThisWeekend(ev.date)) return false;
      if (needle.length === 0) return true;
      const organizerName = (ownerNames?.[ev.ownerId] ?? '').toLowerCase();
      return (
        ev.title.toLowerCase().includes(needle) ||
        ev.venue.toLowerCase().includes(needle) ||
        organizerName.includes(needle)
      );
    });
  }, [events, ownerNames, query, category, dateFilter, freeOnly]);

  const hasFilters =
    category !== 'all' ||
    dateFilter !== 'any' ||
    freeOnly ||
    peopleOnly ||
    query.trim().length > 0;
  const sectionTitle = peopleOnly
    ? 'People to follow'
    : dateFilter === 'weekend'
      ? 'This weekend'
      : 'All events';

  function clearAll() {
    setQuery('');
    setCategory('all');
    setDateFilter('any');
    setFreeOnly(false);
    setPeopleOnly(false);
  }

  function showEvents() {
    setPeopleOnly(false);
  }

  return (
    <div className="animate-fadeup">

      <div className="-mx-4 -mt-4 rounded-b-lg bg-explore-gradient px-4 pb-5 pt-5 tablet:-mx-6 tablet:px-6">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search events, venues, categories"
        />

        <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'wedding', 'funeral', 'corporate', 'social'] as CategoryFilter[]).map(
            (value) => (
              <BackdropChip
                key={value}
                selected={!peopleOnly && category === value}
                onClick={() => {
                  showEvents();
                  setCategory(value);
                }}
              >
                {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
              </BackdropChip>
            ),
          )}

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/30" />

          <BackdropChip
            selected={!peopleOnly && dateFilter === 'any'}
            onClick={() => {
              showEvents();
              setDateFilter('any');
            }}
          >
            Any date
          </BackdropChip>
          <BackdropChip
            selected={!peopleOnly && dateFilter === 'weekend'}
            onClick={() => {
              showEvents();
              setDateFilter('weekend');
            }}
          >
            This weekend
          </BackdropChip>
          <BackdropChip
            selected={!peopleOnly && freeOnly}
            onClick={() => {
              showEvents();
              setFreeOnly((v) => !v);
            }}
          >
            Free only
          </BackdropChip>

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/30" />

          <BackdropChip selected={peopleOnly} onClick={() => setPeopleOnly((v) => !v)}>
            Who to follow
          </BackdropChip>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-caption text-white/85">{sectionTitle}</p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 text-caption font-semibold text-white transition-opacity duration-200 hover:opacity-80"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="pt-4">
        {error && (
          <ErrorState title="Could not load events." onRetry={() => setRetry((n) => n + 1)} />
        )}

        {!error && peopleOnly && !uid && (
          <EmptyState
            icon={<Profile2User size={26} />}
            title="Sign in to follow people."
            body="Follow organizers and attendees to see their posts in your Home feed."
            action={
              <Link
                to="/login"
                className="rounded-md border border-border bg-surface px-4 py-2 text-button text-textprimary transition-colors duration-200 hover:border-primary hover:text-primary"
              >
                Sign in
              </Link>
            }
          />
        )}

        {!error && peopleOnly && uid && (
          <SuggestedUsers
            layout="grid"
            limit={12}
            showHeading={false}
            searchQuery={query}
            className="animate-fadeup"
          />
        )}

        {!peopleOnly && !error && (loading || events === undefined) && (
          <div
            className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4"
            aria-busy="true"
            aria-label="Loading events"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={n} className="h-56 w-full" />
            ))}
          </div>
        )}

        {!peopleOnly && !error && events !== undefined && filtered.length === 0 && (
          <EmptyState
            icon={<TickCircle size={26} />}
            title="No events found"
            body="Try adjusting your filters or search."
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-button text-textprimary hover:border-primary hover:text-primary"
                >
                  Clear all
                </button>
              ) : undefined
            }
          />
        )}

        {!peopleOnly && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
            {filtered.map((ev) => (
              <EventGridTile
                key={ev.id}
                ev={ev}
                saved={isSaved(ev.id)}
                onSave={() => toggleSave(ev.id)}
                href={`/event/${ev.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
