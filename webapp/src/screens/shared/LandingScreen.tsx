/**
 * Public discovery landing (`/`, and the legacy `/landing` URL).
 *
 * The first screen a logged-out visitor sees: a hero, the four categories,
 * a live preview of published events, and a hosting pitch. "Log in" stays a
 * <button> (not a link) so the navigation test's contract holds.
 *
 * The footer and top nav come from the AppShell — this is normal page
 * content, not a full-bleed splash.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Add,
  ArrowRight2,
  Calendar1,
  Heart,
  Location,
  Money,
  SearchNormal,
  Star,
  Ticket,
  UserAdd,
} from 'iconsax-react';
import { Button, EventGridTile, Skeleton } from '../../components/ui';
import { useSavedEvents } from '../../hooks/useSavedEvents';
import { useLive } from '../../db/live';
import { EventService } from '../../services';
import { CATEGORY_META } from '../../layouts/nav/navConfig';
import { CATEGORIES } from '../../lib/constants';
import type { Event } from '../../models';

function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundImage: 'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
      }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

const QUICK_LINKS = [
  { to: '/explore?date=weekend', label: 'This weekend', icon: Calendar1 },
  { to: '/explore?free=1', label: 'Free events', icon: Money },
  { to: '/explore?featured=1', label: 'Featured', icon: Star },
  { to: '/explore?category=wedding', label: 'Weddings', icon: Heart },
  { to: '/explore?category=corporate', label: 'Corporate', icon: Ticket },
  { to: '/explore?near=1', label: 'Near me', icon: Location },
];

export default function LandingScreen() {
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedEvents();
  const [term, setTerm] = useState('');
  const eventService = useMemo(() => new EventService(), []);

  const { data: events } = useLive<Event[]>(() => eventService.publishedEventsFeed(), []);

  const preview = useMemo(() => {
    const rows = [...(events ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime());
    return rows.slice(0, 8);
  }, [events]);

  const featured = useMemo(() => preview.filter((ev) => ev.isCurrentlyFeatured).slice(0, 4), [preview]);
  const showcase = featured.length > 0 ? featured : preview.slice(0, 4);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    navigate(query.length > 0 ? `/explore?q=${encodeURIComponent(query)}` : '/explore');
  }

  return (
    <div className="animate-fadeup">
      {/* ---- Hero --------------------------------------------------------- */}
      <section className="-mx-4 -mt-4 px-4 pb-10 pt-10 tablet:-mx-6 tablet:px-6 tablet:pt-14 wide:px-8">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="flex justify-center">
            <BrandMark size={64} />
          </div>
          <h1 className="mt-5 text-display tracking-tight text-textprimary tablet:text-[34px]">
            Book, connect and celebrate together
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-body text-textmuted">
            Weddings, funerals, corporate and social events — find something near you, or host
            your own in minutes.
          </p>

          <form
            role="search"
            onSubmit={submitSearch}
            className="relative mx-auto mt-6 flex max-w-[520px] items-center"
          >
            <SearchNormal size={20} className="pointer-events-none absolute left-4 text-textmuted" />
            <input
              type="search"
              value={term}
              aria-label="Search events, venues, organizers"
              placeholder="Search events, venues or organizers"
              onChange={(event) => setTerm(event.target.value)}
              className="h-14 w-full rounded-pill border border-border bg-surface pl-12 pr-32 text-body text-textprimary shadow-card placeholder:text-neutral focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1.5 h-11 shrink-0 rounded-pill bg-primary px-5 text-button text-white transition-[filter] duration-200 hover:brightness-95"
            >
              Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" icon={<UserAdd size={18} />} onClick={() => navigate('/signup')}>
              Get started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              Log in
            </Button>
          </div>
        </div>
      </section>

      {/* ---- Quick links --------------------------------------------------- */}
      <section aria-label="Quick links" className="pb-8">
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 tablet:-mx-6 tablet:px-6 wide:px-8">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-pill border border-border bg-surface px-4 text-[13px] font-semibold text-textmuted shadow-card transition-colors duration-200 hover:border-primary hover:text-primary"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Categories ---------------------------------------------------- */}
      <section aria-label="Browse by category" className="pb-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-title text-textprimary">Browse by category</h2>
          <Link
            to="/explore"
            className="inline-flex shrink-0 items-center gap-1 text-button text-primary transition-opacity duration-200 hover:opacity-80"
          >
            See all
            <ArrowRight2 size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
          {CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <Link
                key={category}
                to={`/explore?category=${category}`}
                className="flex min-w-0 flex-col rounded-[20px] border border-border bg-surface p-4 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-popover"
              >
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-primary-6 text-primary">
                  <Icon size={24} />
                </span>
                <span className="mt-3 block min-w-0 truncate text-subtitle text-textprimary">
                  {meta.label}
                </span>
                <span className="mt-1 block min-w-0 line-clamp-2 text-caption text-textmuted">
                  {meta.description}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- Live event preview -------------------------------------------- */}
      <section aria-label="Events on EventHub" className="pb-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-title text-textprimary">
            {featured.length > 0 ? 'Featured events' : 'Newest events'}
          </h2>
          <Link
            to="/explore"
            className="inline-flex shrink-0 items-center gap-1 text-button text-primary transition-opacity duration-200 hover:opacity-80"
          >
            Explore
            <ArrowRight2 size={14} />
          </Link>
        </div>

        {events === undefined ? (
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 wide:grid-cols-4" aria-busy="true" aria-label="Loading events">
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-56 w-full" />
            ))}
          </div>
        ) : showcase.length === 0 ? (
          <div className="rounded-[20px] border border-border bg-surface p-6 text-center shadow-card">
            <p className="text-body text-textmuted">No published events yet — be the first to list one.</p>
            <div className="mt-4 flex justify-center">
              <Button icon={<Add size={18} />} onClick={() => navigate('/signup')}>
                Create an account to host
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 wide:grid-cols-4">
            {showcase.map((ev) => (
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
      </section>

      {/* ---- Hosting pitch -------------------------------------------------- */}
      <section aria-label="Host on EventHub" className="pb-4">
        <div className="flex flex-col gap-4 rounded-[20px] p-6 text-white shadow-popover tablet:flex-row tablet:items-center tablet:justify-between"
          style={{ backgroundImage: 'var(--eh-tile-gradient)' }}
        >
          <div className="min-w-0">
            <h2 className="min-w-0 truncate text-title font-extrabold">Hosting an event?</h2>
            <p className="mt-1 min-w-0 text-body text-white/85">
              Sell tickets, send SMS invitations and check guests in at the door.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-base bg-white px-4 text-button text-primary transition-[filter] duration-200 hover:brightness-95"
            >
              <Add size={18} />
              Create event
            </Link>
            <Link
              to="/help/hosting-basics"
              className="inline-flex h-11 items-center gap-2 rounded-base border border-white/40 px-4 text-button text-white transition-colors duration-200 hover:bg-white/10"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
