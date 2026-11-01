/**
 * Explore (section 3.7) — public discovery. Every filter lives in the URL
 * (`q, category, date, free, featured, sort, near, region, people`) so a
 * filtered view is shareable and survives a reload; the filter bar is sticky
 * under the top nav and the results can be shown as a grid or a list.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar1,
  ElementPlus,
  Location,
  Profile2User,
  Sort,
  TickCircle,
  Ticket,
} from 'iconsax-react';
import {
  CoverMedia,
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
import { formatCurrency, formatDateCard } from '../../lib/format';
import { Event, type EventCategory } from '../../models';

type CategoryFilter = EventCategory | 'all';
type DateFilter = 'any' | 'weekend';
type SortKey = 'new' | 'date' | 'price';
type ViewMode = 'grid' | 'list';

const SORT_LABEL: Record<SortKey, string> = {
  new: 'Newest',
  date: 'Soonest',
  price: 'Cheapest',
};

function isThisWeekend(date: Date): boolean {
  const endOfToday = new Date();
  const startOfToday = new Date(endOfToday.getFullYear(), endOfToday.getMonth(), endOfToday.getDate());
  const daysUntilSaturday = (6 - startOfToday.getDay() + 7) % 7;
  const saturday = startOfToday.getTime() + daysUntilSaturday * 86400000;
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return day >= saturday && day <= saturday + 2 * 86400000 - 1;
}

/** Chip used by the sticky filter bar. */
function FilterChip({
  selected,
  onClick,
  children,
  leading,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] font-semibold transition-colors duration-200 ${
        selected
          ? 'border-primary bg-primary-10 text-primary'
          : 'border-border bg-surface text-textmuted hover:border-primary hover:text-primary'
      }`}
    >
      {leading}
      {children}
    </button>
  );
}

/** Compact horizontal event row used by the list view. */
function EventListRow({
  ev,
  saved,
  onSave,
}: {
  ev: Event;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="flex min-w-0 items-stretch gap-3 rounded-base border border-border bg-surface p-3 transition-shadow duration-200 hover:shadow-card">
      <Link to={`/event/${ev.id}`} className="block shrink-0">
        <div className="relative h-[84px] w-[112px] overflow-hidden rounded-md bg-neutralbg">
          <CoverMedia url={ev.coverImageUrl} className="h-full w-full object-cover" />
        </div>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <Link to={`/event/${ev.id}`} className="block min-w-0">
          <h3 className="truncate text-body font-bold text-textprimary">{ev.title}</h3>
        </Link>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-textmuted">
          <Calendar1 size={13} className="shrink-0" />
          <span className="truncate">{formatDateCard(ev.date)}</span>
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-textmuted">
          <Location size={13} className="shrink-0" />
          <span className="truncate">{ev.venue}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <button
          type="button"
          aria-label={saved ? 'Remove from saved' : 'Save event'}
          aria-pressed={saved}
          onClick={onSave}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ${
            saved ? 'bg-dangerbg text-danger' : 'text-textmuted hover:bg-neutralbg'
          }`}
        >
          <Ticket size={16} />
        </button>
        <span className="truncate text-caption font-bold text-primary">
          {ev.isFree ? 'Free' : formatCurrency(ev.cheapestPrice, { compact: true })}
        </span>
      </div>
    </article>
  );
}

export default function ExploreScreen() {
  const { isSaved, toggleSave } = useSavedEvents();
  const { uid } = useAuth();
  const eventService = useMemo(() => new EventService(), []);
  const [params, setParams] = useSearchParams();

  // ---- URL-backed filter state -------------------------------------------
  const query = params.get('q') ?? '';
  const category = (params.get('category') ?? 'all') as CategoryFilter;
  const dateFilter: DateFilter = params.get('date') === 'weekend' ? 'weekend' : 'any';
  const freeOnly = params.get('free') === '1';
  const featuredOnly = params.get('featured') === '1';
  const peopleOnly = params.get('people') === '1';
  const region = params.get('region') ?? '';
  const near = params.get('near') === '1';
  const sort = (params.get('sort') ?? 'new') as SortKey;
  const view: ViewMode = params.get('view') === 'list' ? 'list' : 'grid';

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const [retry, setRetry] = useState(0);

  const { data: events, loading, error } = useLive<Event[]>(
    () => eventService.publishedEventsFeed(),
    [retry],
  );

  const ownerDirectory = useLive<Record<string, { name: string; region: string }>>(
    async () => {
      const rows = await db.users.toArray();
      const map: Record<string, { name: string; region: string }> = {};
      for (const row of rows) {
        map[String(row.uid ?? '')] = {
          name: String(row.name ?? ''),
          region: String(row.region ?? ''),
        };
      }
      return map;
    },
    [retry],
  ).data;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = (events ?? []).filter((ev) => {
      if (category !== 'all' && ev.category !== category) return false;
      if (freeOnly && !ev.isFree) return false;
      if (featuredOnly && !ev.isCurrentlyFeatured) return false;
      if (dateFilter === 'weekend' && !isThisWeekend(ev.date)) return false;
      if (region.length > 0 && !(ownerDirectory?.[ev.ownerId]?.region === region)) return false;
      if (needle.length === 0) return true;
      const organizerName = (ownerDirectory?.[ev.ownerId]?.name ?? '').toLowerCase();
      return (
        ev.title.toLowerCase().includes(needle) ||
        ev.venue.toLowerCase().includes(needle) ||
        organizerName.includes(needle)
      );
    });
    // `near` would sort by device distance; with no location backend it falls
    // back to the soonest date so the control still does something honest.
    if (near || sort === 'date') return [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sort === 'price') return [...rows].sort((a, b) => a.cheapestPrice - b.cheapestPrice);
    return [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [events, ownerDirectory, query, category, dateFilter, freeOnly, featuredOnly, region, sort, near]);

  // Regions are derived from the signed-in directory (after the last comma).
  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const value of Object.values(ownerDirectory ?? {})) {
      const parts = value.region.split(',');
      const last = (parts[parts.length - 1] ?? '').trim();
      if (last.length > 0) set.add(last);
    }
    return Array.from(set).sort();
  }, [ownerDirectory]);

  const hasFilters =
    category !== 'all' ||
    dateFilter !== 'any' ||
    freeOnly ||
    featuredOnly ||
    peopleOnly ||
    region.length > 0 ||
    query.trim().length > 0;

  const sectionTitle = peopleOnly
    ? 'People to follow'
    : dateFilter === 'weekend'
      ? 'This weekend'
      : category !== 'all'
        ? `${category.charAt(0).toUpperCase()}${category.slice(1)} events`
        : 'All events';

  function clearAll() {
    setParams(new URLSearchParams(), { replace: true });
  }

  return (
    <div className="animate-fadeup">
      {/* Search + sticky filter bar */}
      <div className="-mx-4 -mt-4 px-4 pt-4 tablet:-mx-6 tablet:px-6 wide:px-8">
        <SearchField
          value={query}
          onChange={(value) => patch({ q: value })}
          placeholder="Search events, venues, categories"
        />
      </div>

      <div className="sticky top-14 z-30 -mx-4 mt-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur tablet:-mx-6 tablet:top-[72px] tablet:px-6 wide:px-8">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          <FilterChip
            selected={!peopleOnly && category === 'all'}
            onClick={() => patch({ category: null, people: null })}
            leading={<ElementPlus size={14} />}
          >
            All
          </FilterChip>
          {(['wedding', 'funeral', 'corporate', 'social'] as CategoryFilter[]).map((value) => (
            <FilterChip
              key={value}
              selected={!peopleOnly && category === value}
              onClick={() => patch({ category: value, people: null })}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </FilterChip>
          ))}

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />

          <FilterChip
            selected={dateFilter === 'weekend'}
            onClick={() => patch({ date: dateFilter === 'weekend' ? null : 'weekend', people: null })}
            leading={<Calendar1 size={14} />}
          >
            This weekend
          </FilterChip>
          <FilterChip
            selected={freeOnly}
            onClick={() => patch({ free: freeOnly ? null : '1', people: null })}
          >
            Free
          </FilterChip>
          <FilterChip
            selected={featuredOnly}
            onClick={() => patch({ featured: featuredOnly ? null : '1', people: null })}
          >
            Featured
          </FilterChip>

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />

          <FilterChip
            selected={sort !== 'new'}
            onClick={() => patch({ sort: sort === 'new' ? 'date' : sort === 'date' ? 'price' : 'new' })}
            leading={<Sort size={14} />}
          >
            {SORT_LABEL[sort]}
          </FilterChip>
          {regions.length > 0 && (
            <FilterChip
              selected={region.length > 0}
              onClick={() => patch({ region: region.length > 0 ? null : regions[0] })}
              leading={<Location size={14} />}
            >
              {region.length > 0 ? region : 'Region'}
            </FilterChip>
          )}

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />

          <FilterChip selected={peopleOnly} onClick={() => patch({ people: peopleOnly ? null : '1' })}>
            <Profile2User size={14} />
            Who to follow
          </FilterChip>

          {/* Grid/list toggle (desktop only; phones stay on the grid). */}
          <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-border desktop:block" />
          <span className="hidden items-center gap-1 desktop:flex">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => patch({ view: null })}
              className={`flex h-9 w-9 items-center justify-center rounded-pill border transition-colors duration-200 ${
                view === 'grid'
                  ? 'border-primary bg-primary-10 text-primary'
                  : 'border-border bg-surface text-textmuted hover:border-primary'
              }`}
            >
              <ElementPlus size={16} />
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => patch({ view: 'list' })}
              className={`flex h-9 w-9 items-center justify-center rounded-pill border transition-colors duration-200 ${
                view === 'list'
                  ? 'border-primary bg-primary-10 text-primary'
                  : 'border-border bg-surface text-textmuted hover:border-primary'
              }`}
            >
              <Sort size={16} />
            </button>
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-caption text-textmuted">{sectionTitle}</p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 text-caption font-semibold text-primary transition-opacity duration-200 hover:opacity-80"
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
          <SuggestedUsers layout="grid" limit={12} showHeading={false} searchQuery={query} className="animate-fadeup" />
        )}

        {!peopleOnly && !error && (loading || events === undefined) && (
          <div
            className="grid grid-cols-2 gap-3 tablet:grid-cols-3 wide:grid-cols-4"
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

        {!peopleOnly && !error && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 wide:grid-cols-4">
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

        {!peopleOnly && !error && filtered.length > 0 && view === 'list' && (
          <div className="space-y-3">
            {filtered.map((ev) => (
              <EventListRow
                key={ev.id}
                ev={ev}
                saved={isSaved(ev.id)}
                onSave={() => toggleSave(ev.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
