/**
 * Compact chrome for <1024px (section 3.2): a slim top bar (logo · search ·
 * notifications · menu) and the bottom tab bar with the four daily
 * destinations plus the Menu tab that opens the drawer.
 *
 * The Menu tab is a <button>, not an anchor — the tab bar deliberately keeps
 * exactly four links (asserted by `smoke.test.tsx`).
 */
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu as MenuIcon, SearchNormal } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { BOTTOM_TABS } from './navConfig';
import { NotificationBell } from './NotificationBell';
import { SearchOverlay } from './SearchOverlay';

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
      className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur tablet:hidden"
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
