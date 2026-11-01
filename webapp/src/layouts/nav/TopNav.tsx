/**
 * Desktop top navigation (≥1024px) — the Eventbrite-style horizontal bar that
 * replaces the old left navigation (section 3.2). 72px sticky, active item carries a
 * 2px primary underline, submenus open as mega/list panels.
 *
 * The account button's caption is what carries the merged-role signal: a plain
 * date line ("Joined Mar 2024") for users, the exact word "Admin" for admins.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Add, Bookmark, Logout, Message, MessageQuestion, Setting2, ShieldTick, Ticket } from 'iconsax-react';
import { effectiveRole, useAuth } from '../../app/AuthProvider';
import { Avatar } from '../../components/ui';
import { useChats, useChatMeta } from '../../components/SocialData';
import { navGroupFor } from '../../routes/routeMeta';
import { NavMenu } from './NavMenu';
import { NavSearch } from './NavSearch';
import { NotificationBell } from './NotificationBell';
import { DropdownPanel, useDismissOnOutside, useEscape } from './Dropdown';
import { HELP_MENU_ITEMS, NAV_MENUS, LOGGED_OUT_MENUS, type NavEntry } from './navConfig';

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

function ListDropdown({
  label,
  icon,
  items,
  align = 'right',
  widthClass = 'w-[320px]',
  children,
  triggerContent,
  triggerClassName,
}: {
  label: string;
  icon?: React.ReactNode;
  align?: 'left' | 'right';
  widthClass?: string;
  items?: NavEntry[];
  children?: React.ReactNode;
  /** Replaces the default icon+label trigger body (e.g. the avatar block). */
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `${label}-menu`;
  const triggerId = `${label}-trigger`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useDismissOnOutside(open, [triggerRef, panelRef], close);
  useEscape(open, close);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          'flex h-[72px] items-center gap-1.5 px-3 text-body font-semibold text-textmuted transition-colors duration-200 hover:text-textprimary'
        }
      >
        {triggerContent ?? (
          <>
            {icon}
            {label}
          </>
        )}
      </button>
      {open && (
        <div ref={panelRef}>
          <DropdownPanel id={panelId} labelledBy={triggerId} align={align} widthClass={widthClass}>
            {/* Any click inside (link or button) closes the panel. */}
            <div onClick={() => setOpen(false)} role="presentation">
              {children}
              {items?.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.id}
                    to={entry.to ?? '/help'}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-primary-6"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-bold text-textprimary">{entry.label}</span>
                      {entry.description && (
                        <span className="block truncate text-caption text-textmuted">{entry.description}</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </DropdownPanel>
        </div>
      )}
    </div>
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const role = effectiveRole(user);

  // Close any open submenu on navigation.
  useEffect(() => setOpenMenu(null), [location.pathname, location.search]);

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
      <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-1 px-6 wide:px-8">
        <Link to={user ? '/home' : '/'} className="mr-2 flex shrink-0 items-center gap-2.5">
          <BrandMark />
          <span className="text-title font-extrabold tracking-tight text-textprimary">EventHub</span>
        </Link>

        <nav className="flex min-w-0 items-center" aria-label="Primary">
          {menus.map((menu) =>
            menu.adminOnly && role !== 'admin' ? null : (
              <NavMenu
                key={menu.id}
                menu={menu}
                active={activeGroup === menu.id}
                uid={uid}
                open={openMenu === menu.id}
                onOpenChange={(next) => setOpenMenu(next ? menu.id : null)}
                onEventTool={openEventTool}
              />
            ),
          )}

          <ListDropdown
            label="Help"
            icon={<MessageQuestion size={18} />}
            items={HELP_MENU_ITEMS}
            widthClass="w-[340px]"
          />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NavSearch className="hidden items-center wide:flex" />

          {user ? (
            <>
              <Link
                to="/organizer/events/new"
                className="inline-flex h-10 items-center gap-2 rounded-base bg-primary px-4 text-button text-white transition-[filter] duration-200 hover:brightness-95"
              >
                <Add size={18} />
                Create event
              </Link>
              <Link
                to="/chats"
                aria-label="Chats"
                title="Chats"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
              >
                <Message size={22} />
                {hasUnreadChats && (
                  <span
                    className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                )}
              </Link>
              <NotificationBell />
              <ListDropdown
                label="Account"
                align="right"
                widthClass="w-[280px]"
                triggerClassName="flex h-[72px] items-center gap-2.5 rounded-base px-2.5 transition-colors duration-200 hover:bg-primary-6"
                triggerContent={
                  <>
                    <Avatar name={user?.name ?? 'Guest'} url={user?.avatarUrl} size={34} />
                    <span className="hidden min-w-0 max-w-[150px] text-left wide:block">
                      <span className="block truncate text-body font-bold text-textprimary">
                        {user?.name ?? 'Guest'}
                      </span>
                      {role === 'admin' ? (
                        <span className="block truncate text-caption text-textmuted">Admin</span>
                      ) : (
                        joinedLabel !== '' && (
                          <span className="block truncate text-caption text-textmuted">{joinedLabel}</span>
                        )
                      )}
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
    </header>
  );
}
