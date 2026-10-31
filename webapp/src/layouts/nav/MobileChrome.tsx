/**
 * Compact chrome for <1024px (section 3.2): a slim top bar (logo · search ·
 * notifications · menu) and the bottom tab bar with the four daily
 * destinations plus the Menu tab that opens the drawer.
 *
 * The Menu tab is a <button>, not an anchor — the tab bar deliberately keeps
 * exactly four links (asserted by `smoke.test.tsx`).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu as MenuIcon, SearchNormal } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { BOTTOM_TABS } from './navConfig';
import { NotificationBell } from './NotificationBell';

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundImage:
          'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
      }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

/** Full-screen search overlay used by the compact top bar. */
function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const query = term.trim();
    onClose();
    navigate(query.length > 0 ? `/explore?q=${encodeURIComponent(query)}` : '/explore');
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Search">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary hover:bg-primary-6"
        >
          <ArrowLeft size={22} />
        </button>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="relative flex min-w-0 flex-1 items-center"
        >
          <SearchNormal size={18} className="pointer-events-none absolute left-3.5 text-textmuted" />
          <input
            ref={inputRef}
            type="search"
            value={term}
            aria-label="Search events, venues, organizers"
            placeholder="Search events"
            onChange={(e) => setTerm(e.target.value)}
            className="h-11 w-full rounded-pill border border-border bg-background pl-11 pr-4 text-body text-textprimary placeholder:text-neutral focus:border-primary focus:outline-none"
          />
        </form>
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded-base px-2 py-2 text-button text-primary hover:bg-primary-6"
        >
          Search
        </button>
      </div>
    </div>
  );
}

/** Slim top bar shown below the desktop breakpoint. */
export function CompactTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur desktop:hidden">
        <Link to={user ? '/home' : '/'} aria-label="EventHub home" className="shrink-0">
          <BrandMark />
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="ml-1 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-pill border border-border bg-background px-4 text-left text-caption text-textmuted transition-colors duration-200 hover:border-primary"
        >
          <SearchNormal size={16} className="shrink-0" />
          <span className="min-w-0 truncate">Search events</span>
        </button>
        {user && <NotificationBell />}
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
        >
          <MenuIcon size={22} />
        </button>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

/** Bottom tab bar — exactly four anchors plus the Menu button. */
export function BottomTabs({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur desktop:hidden"
      aria-label="Primary"
    >
      {BOTTOM_TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/home'}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200 ${
              isActive ? 'text-primary' : 'text-textmuted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} variant={isActive ? 'Bold' : 'Linear'} />
              <span className="truncate">{label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-textmuted transition-colors duration-200 hover:text-textprimary"
      >
        <MenuIcon size={22} />
        <span className="truncate">Menu</span>
      </button>
    </nav>
  );
}
