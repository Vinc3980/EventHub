/**
 * Desktop top navigation (≥1024px) — the Eventbrite-style horizontal bar that
 * replaces the old left navigation (section 3.2). 72px sticky, active item carries a
 * 2px primary underline, submenus open as mega/list panels.
 *
 * Header layout:
 *   - Logo (shrink-0)
 *   - Nav (flex-1 min-w-0 justify-center, menus centred in free space)
 *   - Right cluster (shrink-0)
 *   - Shared page-container with --eh-gutter (identical x-alignment with <main>)
 *   - Search: inline 260px at ≥1536, 200px at wide–1535, icon button + overlay below wide
 *   - Create event: Bold 18px Add icon, shrinks to 40×40 icon-only below 1180px
 *   - Account: 36px avatar-only with primary ring when open
 *   - Help: hover+click menu managed by centralized useHoverIntent
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Add,
  Bookmark,
  Logout,
  Message,
  MessageQuestion,
  SearchNormal,
  Setting2,
  ShieldTick,
  Ticket,
} from 'iconsax-react';
import { effectiveRole, useAuth } from '../../app/AuthProvider';
import { Avatar } from '../../components/ui';
import { useChats, useChatMeta } from '../../components/SocialData';
import { navGroupFor } from '../../routes/routeMeta';
import { NavMenu } from './NavMenu';
import { NavSearch } from './NavSearch';
import { NotificationBell } from './NotificationBell';
import { ListDropdown } from './ListDropdown';
import { SearchOverlay } from './SearchOverlay';
import { useHoverIntent } from './useHoverIntent';
import { HELP_MENU_ITEMS, NAV_MENUS, LOGGED_OUT_MENUS } from './navConfig';

function BrandMark({ size = 34 }: { size?: number }) {
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

export interface TopNavProps {
  /** Event-scoped nav entries hand their template here (opens the event picker). */
  onEventTool?: (template: string) => void;
}

export function TopNav({ onEventTool }: TopNavProps) {
  const { user, uid, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeGroup = navGroupFor(location.pathname);
  const role = effectiveRole(user);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);

  const hoverIntent = useHoverIntent();
  const {
    openMenu,
    isPinned,
    onPointerEnterItem,
    onPointerLeaveItem,
    onPointerLeaveNav,
    onPointerEnterPanel,
    onTriggerClick,
    onOpenChange,
    closeAll,
  } = hoverIntent;

  // Close any open submenu on navigation.
  useEffect(() => closeAll(), [location.pathname, location.search, closeAll]);

  const { data: chats } = useChats(uid);
  const chatMeta = useChatMeta(chats, uid);
  const hasUnreadChats = (chats ?? []).some((chat) => chatMeta[chat.id]?.unread);

  const menus = useMemo(() => (user ? NAV_MENUS : LOGGED_OUT_MENUS), [user]);

  const joinedLabel = useMemo(() => {
    const createdAt = user?.createdAt;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return '';
    return `Joined ${createdAt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
  }, [user]);

  const openEventTool = (template: string) => {
    if (onEventTool) onEventTool(template);
    else navigate('/organizer/events');
  };

  return (
    <header className="sticky top-0 z-40 hidden h-[72px] shrink-0 border-b border-border bg-surface/95 backdrop-blur desktop:block">
      <div className="page-container flex h-full items-center gap-8">
        {/* Left: Brand / Logo */}
        <Link to={user ? '/home' : '/'} className="flex shrink-0 items-center gap-2.5">
          <BrandMark />
          <span className="text-title font-extrabold tracking-tight text-textprimary">EventHub</span>
        </Link>

        {/* Center: Primary Navigation (centered in available space) */}
        <nav
          className="flex flex-1 min-w-0 items-center justify-center gap-1"
          aria-label="Primary"
          onPointerLeave={(e) => {
            if (e.pointerType !== 'touch') {
              onPointerLeaveNav(e.pointerType);
            }
          }}
        >
          {menus.map((menu) =>
            menu.adminOnly && role !== 'admin' ? null : (
              <NavMenu
                key={menu.id}
                menu={menu}
                active={activeGroup === menu.id}
                uid={uid}
                open={openMenu === menu.id}
                isPinned={isPinned(menu.id)}
                onOpenChange={(next) => onOpenChange(menu.id, next)}
                onTriggerClick={onTriggerClick}
                onPointerEnterItem={onPointerEnterItem}
                onPointerLeaveItem={onPointerLeaveItem}
                onPointerEnterPanel={onPointerEnterPanel}
                onEventTool={openEventTool}
              />
            ),
          )}

          <ListDropdown
            id="help"
            label="Help"
            icon={<MessageQuestion size={18} />}
            items={HELP_MENU_ITEMS}
            widthClass="w-[340px]"
            hoverable={true}
            open={openMenu === 'help'}
            onOpenChange={(next) => onOpenChange('help', next)}
            onTriggerClick={onTriggerClick}
            onPointerEnterItem={onPointerEnterItem}
            onPointerLeaveItem={onPointerLeaveItem}
            onPointerEnterPanel={onPointerEnterPanel}
          />
        </nav>

        {/* Right cluster (order: search · Create event · Chats · bell · account) */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Below wide: search icon button that opens SearchOverlay */}
          <button
            type="button"
            aria-label="Search events"
            title="Search events"
            onClick={() => setSearchOverlayOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6 wide:hidden"
          >
            <SearchNormal size={20} />
          </button>

          {/* Wide and above: inline search box */}
          <NavSearch className="hidden items-center wide:flex" />

          {user ? (
            <>
              {/* Create event: full pill with text at ≥1180px; 40x40 icon-only below 1180px */}
              <Link
                to="/organizer/events/new"
                aria-label="Create event"
                title="Create event"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-base bg-primary text-button leading-none text-white transition-[filter] duration-200 hover:brightness-95 w-10 px-0 compactCreate:w-auto compactCreate:px-5 compactCreate:gap-2"
              >
                <Add size={18} variant="Bold" className="shrink-0" />
                <span className="hidden whitespace-nowrap compactCreate:inline">Create event</span>
              </Link>

              {/* Chats */}
              <Link
                to="/chats"
                aria-label="Chats"
                title="Chats"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
              >
                <Message size={22} />
                {hasUnreadChats && (
                  <span
                    className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                )}
              </Link>

              {/* Notifications */}
              <NotificationBell />

              {/* Account dropdown (avatar only trigger, 36px) */}
              <ListDropdown
                id="account"
                label="Account"
                align="right"
                widthClass="w-[280px]"
                hoverable={false}
                triggerClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-primary-6"
                triggerContent={
                  <>
                    <Avatar
                      name={user?.name ?? 'Guest'}
                      url={user?.avatarUrl}
                      size={36}
                      className="transition-all duration-200"
                    />
                    <span className="sr-only">
                      {role === 'admin' ? 'Admin' : joinedLabel}
                    </span>
                  </>
                }
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="min-w-0 truncate text-body font-bold text-textprimary">
                    {user?.name ?? 'Guest'}
                  </p>
                  {role === 'admin' ? (
                    <p className="min-w-0 truncate text-caption text-textmuted">Admin</p>
                  ) : (
                    joinedLabel !== '' && (
                      <p className="min-w-0 truncate text-caption text-textmuted">{joinedLabel}</p>
                    )
                  )}
                </div>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                >
                  <Avatar name={user?.name ?? 'Guest'} url={user?.avatarUrl} size={28} />
                  <span className="min-w-0 truncate">Profile</span>
                </Link>
                <Link
                  to="/tickets"
                  className="flex items-center gap-3 px-4 py-2.5 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                >
                  <Ticket size={20} className="shrink-0 text-textmuted" />
                  <span className="min-w-0 truncate">My tickets</span>
                </Link>
                <Link
                  to="/saved"
                  className="flex items-center gap-3 px-4 py-2.5 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                >
                  <Bookmark size={20} className="shrink-0 text-textmuted" />
                  <span className="min-w-0 truncate">Saved</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                >
                  <Setting2 size={20} className="shrink-0 text-textmuted" />
                  <span className="min-w-0 truncate">Settings</span>
                </Link>
                {role === 'admin' && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 px-4 py-2.5 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                  >
                    <ShieldTick size={20} className="shrink-0 text-textmuted" />
                    <span className="min-w-0 truncate">Admin console</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                  }}
                  className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-body font-semibold text-danger transition-colors duration-200 hover:bg-primary-6"
                >
                  <Logout size={20} className="shrink-0" />
                  <span className="min-w-0 truncate">Sign out</span>
                </button>
              </ListDropdown>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex h-10 items-center rounded-base px-4 text-button text-primary transition-colors duration-200 hover:bg-primary-6"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-10 items-center rounded-base bg-primary px-4 text-button text-white transition-[filter] duration-200 hover:brightness-95"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Full-screen search overlay */}
      <SearchOverlay open={searchOverlayOpen} onClose={() => setSearchOverlayOpen(false)} />
    </header>
  );
}
