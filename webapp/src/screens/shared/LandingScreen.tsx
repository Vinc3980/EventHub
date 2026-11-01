/**
 * Public discovery landing (`/`, and the legacy `/landing` URL).
 *
 * The first screen a logged-out visitor sees (section 5.1):
 *  - Hero with headline, search, and category pills over cobalt->deepViolet gradient;
 *  - "Happening this week" row;
 *  - Featured events carousel/grid;
 *  - Browse by category tiles;
 *  - "Why EventHub" row showcasing differentiators (group chats, MoMo, plus-ones, QR);
 *  - "Host your event" banner linking to signup.
 *
 * "Log in" stays a <button> (not a link) so the navigation test's contract holds.
 * The footer and top nav come from AppShell.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Add,
  ArrowRight2,
  Calendar1,
  Heart,
  Location,
  Message,
  Money,
  People,
  Scan,
  SearchNormal,
  Star,
  Ticket,
  UserAdd,
  Wallet1,
} from 'iconsax-react';
import { Button, EventGridTile, Skeleton } from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { useSavedEvents } from '../../hooks/useSavedEvents';
import { useLive } from '../../db/live';
import { EventService } from '../../services';
import { CATEGORY_META } from '../../layouts/nav/navConfig';
import { CATEGORIES } from '../../lib/constants';
import { BACKGROUND_CONFIG } from '../../theme/backgrounds';
import type { Event } from '../../models';

const QUICK_LINKS = [
  { to: '/explore?date=weekend', label: 'This weekend', icon: Calendar1 },
  { to: '/explore?free=1', label: 'Free events', icon: Money },
  { to: '/explore?featured=1', label: 'Featured', icon: Star },
  { to: '/explore?category=wedding', label: 'Weddings', icon: Heart },
  { to: '/explore?category=corporate', label: 'Corporate', icon: Ticket },
  { to: '/explore?near=1', label: 'Near me', icon: Location },
];

const DIFFERENTIATORS = [
  {
    icon: Message,
    title: 'Per-event group chats',
    description: 'Coordinate with organizers and fellow attendees directly in built-in event group chats.',
  },
  {
    icon: Wallet1,
    title: 'MoMo-first payments',
    description: 'Frictionless Mobile Money checkout across MTN, Telecel, and AT with instant tickets.',
  },
  {
    icon: People,
    title: 'Plus-ones & guest lists',
    description: 'Manage invited guests, tracked plus-ones, and send bulk SMS invitations with RSVP links.',
  },
  {
    icon: Scan,
    title: 'QR & seat check-in',
    description: 'Rapid camera ticket scanning and real-time door check-in numbers on event day.',
  },
];

export default function LandingScreen() {
  const { uid } = useAuth();
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedEvents();
  const [term, setTerm] = useState('');
  const eventService = useMemo(() => new EventService(), []);

  // Redirect signed-in users hitting / or /landing to /home (section 5.1)
  useEffect(() => {
    if (uid) {
      navigate('/home', { replace: true });
    }
  }, [uid, navigate]);

  const { data: events } = useLive<Event[]>(() => eventService.publishedEventsFeed(), []);

  const sortedEvents = useMemo(() => {
    const rows = [...(events ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime());
    return rows;
  }, [events]);

  const featured = useMemo(
    () => sortedEvents.filter((ev) => ev.isCurrentlyFeatured).slice(0, 4),
    [sortedEvents],
  );

  const thisWeekEvents = useMemo(() => {
    const now = Date.now();
    const sevenDays = now + 7 * 86_400_000;
    return sortedEvents
      .filter((ev) => ev.date.getTime() >= now && ev.date.getTime() <= sevenDays)
      .slice(0, 4);
  }, [sortedEvents]);

  const showcase = featured.length > 0 ? featured : sortedEvents.slice(0, 4);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    navigate(query.length > 0 ? `/explore?q=${encodeURIComponent(query)}` : '/explore');
  }

  return (
    <div className="animate-fadeup space-y-12">
      {/* ---- Hero (auth photo under cobalt -> deepViolet gradient) --------- */}
      <section className="relative -mx-4 -mt-4 overflow-hidden rounded-[24px] p-6 text-white shadow-popover tablet:-mx-6 tablet:p-10 wide:px-12">
        <picture className="pointer-events-none absolute inset-0 -z-10 block h-full w-full select-none">
          <source type="image/webp" srcSet={BACKGROUND_CONFIG.auth.srcSet} sizes="100vw" />
          <img
            src={BACKGROUND_CONFIG.auth.src}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
        </picture>
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(43, 95, 255, 0.88) 0%, rgba(95, 59, 126, 0.94) 100%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-[760px] text-center">
          <span className="inline-block rounded-pill bg-white/15 px-3.5 py-1 text-caption font-bold tracking-wider uppercase text-white/90 backdrop-blur">
            Made for Ghana
          </span>
          <h1 className="mt-4 text-display font-extrabold tracking-tight text-white tablet:text-[38px] tablet:leading-tight">
            Book, connect and celebrate together
          </h1>
          <p className="mx-auto mt-3 max-w-[580px] text-body text-white/85 tablet:text-[16px]">
            From weddings and memorials to corporate workshops and parties — discover gatherings across Ghana or host your own.
          </p>

          <form
            role="search"
            onSubmit={submitSearch}
            className="relative mx-auto mt-8 flex max-w-[560px] items-center"
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

          {/* Category pills under the search bar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((category) => {
              const meta = CATEGORY_META[category];
              return (
                <Link
                  key={category}
                  to={`/explore?category=${category}`}
                  className="rounded-pill border border-white/25 bg-white/15 px-3.5 py-1 text-[13px] font-semibold text-white backdrop-blur transition-colors duration-200 hover:bg-white/25"
                >
                  {meta.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" icon={<UserAdd size={18} />} onClick={() => navigate('/signup')}>
              Get started
            </Button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex h-12 items-center justify-center rounded-base border border-white/40 bg-white/10 px-6 text-button font-bold text-white backdrop-blur transition-colors duration-200 hover:bg-white/20"
            >
              Log in
            </button>
          </div>
        </div>
      </section>

      {/* ---- Quick links --------------------------------------------------- */}
      <section aria-label="Quick links" className="-my-4">
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

      {/* ---- Happening this week (section 5.1) ------------------------------ */}
      {thisWeekEvents.length > 0 && (
        <section aria-label="Happening this week">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="min-w-0 truncate text-title text-textprimary">Happening this week</h2>
              <p className="text-caption text-textmuted">Upcoming events happening over the next 7 days</p>
            </div>
            <Link
              to="/explore?date=weekend"
              className="inline-flex shrink-0 items-center gap-1 text-button text-primary transition-opacity duration-200 hover:opacity-80"
            >
              See more
              <ArrowRight2 size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 wide:grid-cols-4">
            {thisWeekEvents.map((ev) => (
              <EventGridTile
                key={ev.id}
                ev={ev}
                saved={isSaved(ev.id)}
                onSave={() => toggleSave(ev.id)}
                href={`/event/${ev.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Featured / Newest events carousel ----------------------------- */}
      <section aria-label="Events on EventHub">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="min-w-0 truncate text-title text-textprimary">
              {featured.length > 0 ? 'Featured events' : 'Newest events'}
            </h2>
            <p className="text-caption text-textmuted">Handpicked and trending events across Ghana</p>
          </div>
          <Link
            to="/explore"
            className="inline-flex shrink-0 items-center gap-1 text-button text-primary transition-opacity duration-200 hover:opacity-80"
          >
            Explore all
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

      {/* ---- Browse by category -------------------------------------------- */}
      <section aria-label="Browse by category">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="min-w-0 truncate text-title text-textprimary">Browse by category</h2>
            <p className="text-caption text-textmuted">Events tailored for each celebration and milestone</p>
          </div>
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
                className="flex min-w-0 flex-col rounded-[20px] border border-border bg-surface p-4 shadow-card transition-colors duration-200 hover:border-primary-14 hover:shadow-popover"
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

      {/* ---- Why EventHub (Differentiators - section 5.1 & section 2) ------- */}
      <section aria-label="Why EventHub">
        <div className="mb-4">
          <h2 className="text-title font-extrabold text-textprimary">Why EventHub?</h2>
          <p className="mt-1 text-body text-textmuted">
            Built specifically for Ghanaian events with modern tools Eventbrite doesn&apos;t offer.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
          {DIFFERENTIATORS.map((diff) => {
            const Icon = diff.icon;
            return (
              <div
                key={diff.title}
                className="flex min-w-0 flex-col rounded-[20px] border border-border bg-surface p-5 shadow-card"
              >
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-primary-6 text-primary">
                  <Icon size={24} />
                </span>
                <h3 className="mt-3 text-subtitle font-bold text-textprimary">{diff.title}</h3>
                <p className="mt-1 text-caption leading-relaxed text-textmuted">{diff.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Hosting pitch -------------------------------------------------- */}
      <section aria-label="Host on EventHub" className="pb-4">
        <div
          className="flex flex-col gap-4 rounded-[20px] p-6 text-white shadow-popover tablet:flex-row tablet:items-center tablet:justify-between"
          style={{ backgroundImage: 'var(--eh-tile-gradient)' }}
        >
          <div className="min-w-0">
            <h2 className="min-w-0 truncate text-title font-extrabold">Hosting an event?</h2>
            <p className="mt-1 min-w-0 text-body text-white/85">
              Sell tickets with MoMo, send SMS invitations and check guests in at the door with just 2% platform fee.
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
