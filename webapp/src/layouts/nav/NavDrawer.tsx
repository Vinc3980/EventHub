/**
 * Mobile/tablet navigation drawer (section 3.2) — opened from the compact top
 * bar's menu button or the bottom tab bar's Menu tab. It reuses the exact same
 * `NAV_MENUS` tree as the desktop submenus, so an entry can never drift.
 *
 * Modal behaviour: Escape and the backdrop close it, focus is trapped inside
 * while open and restored to the opener on close.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight2, CloseSquare, Logout, Setting2, ShieldTick } from 'iconsax-react';
import { effectiveRole, useAuth } from '../../app/AuthProvider';
import { Avatar, Button } from '../../components/ui';
import { navGroupFor } from '../../routes/routeMeta';
import {
  entryHref,
  HELP_MENU_ITEMS,
  NAV_MENUS,
  type NavEntry,
  type NavMenu as NavMenuConfig,
} from './navConfig';

function AccordionSection({
  menu,
  uid,
  onNavigate,
  onEventTool,
}: {
  menu: NavMenuConfig;
  uid: string | null;
  onNavigate: () => void;
  onEventTool: (template: string) => void;
}) {
  const location = useLocation();
  const activeGroup = navGroupFor(location.pathname);
  const active = activeGroup === menu.id;
  const [expanded, setExpanded] = useState(active);
  const panelId = `drawer-${menu.id}`;
  const Icon = menu.icon;

  const itemHref = (entry: NavEntry) => entryHref(entry, uid);

  return (
    <div className="border-b border-border">
      <div className="flex items-stretch">
        <Link
          to={menu.to}
          onClick={onNavigate}
          className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 ${
            active ? 'text-primary' : 'text-textprimary'
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              active ? 'bg-primary-10 text-primary' : 'bg-primary-6 text-primary'
            }`}
          >
            <Icon size={18} variant={active ? 'Bold' : 'Linear'} />
          </span>
          <span className="min-w-0 truncate text-body font-bold">{menu.label}</span>
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${menu.label} menu`}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-12 shrink-0 items-center justify-center text-textmuted transition-transform duration-200 hover:text-textprimary"
        >
          <ArrowRight2 size={16} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="pb-2">
          {menu.sections.flatMap((section) =>
            section.items.map((entry) => {
              const href = itemHref(entry);
              const ItemIcon = entry.icon;
              const body = (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutralbg text-textmuted">
                    <ItemIcon size={16} />
                  </span>
                  <span className="min-w-0 truncate text-body font-semibold text-textprimary">{entry.label}</span>
                </>
              );
              const className =
                'flex min-w-0 w-full items-center gap-3 py-2.5 pl-12 pr-4 text-left transition-colors duration-200 hover:bg-primary-6';
              return entry.eventTo ? (
                <button
                  key={`${section.id}-${entry.id}`}
                  type="button"
                  onClick={() => {
                    onNavigate();
                    onEventTool(entry.eventTo as string);
                  }}
                  className={className}
                >
                  {body}
                </button>
              ) : (
                <Link key={`${section.id}-${entry.id}`} to={href ?? '/login'} onClick={onNavigate} className={className}>
                  {body}
                </Link>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}

export interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  onEventTool: (template: string) => void;
}

export function NavDrawer({ open, onClose, onEventTool }: NavDrawerProps) {
  const { user, uid, signOut } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const role = effectiveRole(user);

  const joinedLabel = user?.createdAt && !Number.isNaN(user.createdAt.getTime())
    ? `Joined ${user.createdAt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
    : '';

  // Focus the panel on open; Escape closes.
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Trap Tab inside the drawer while it is open.
  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        onKeyDown={onPanelKeyDown}
        className="relative flex h-full w-full max-w-[340px] flex-col overflow-y-auto bg-surface shadow-dark animate-panelin motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="min-w-0 truncate text-title font-extrabold tracking-tight text-textprimary">Menu</span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
          >
            <CloseSquare size={22} />
          </button>
        </div>

        {/* Account block */}
        {user ? (
          <div className="flex items-center gap-3 border-b border-border px-4 py-4">
            <Avatar name={user.name ?? 'Guest'} url={user.avatarUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-bold text-textprimary">{user.name ?? 'Guest'}</p>
              <p className="truncate text-caption text-textmuted">{role === 'admin' ? 'Admin' : joinedLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => go('/profile')}
              className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-caption font-bold text-primary transition-colors duration-200 hover:border-primary"
            >
              View
            </button>
          </div>
        ) : (
          <div className="flex gap-2 border-b border-border px-4 py-4">
            <Button size="sm" fullWidth onClick={() => go('/login')}>
              Log in
            </Button>
            <Button size="sm" variant="outline" fullWidth onClick={() => go('/signup')}>
              Sign up
            </Button>
          </div>
        )}

        {/* Pinned CTA */}
        <div className="border-b border-border px-4 py-3">
          <Button
            size="md"
            fullWidth
            onClick={() => go(user ? '/organizer/events/new' : '/signup')}
          >
            {user ? 'Create event' : 'Create an account to host'}
          </Button>
        </div>

        {/* Accordion menu tree */}
        <nav className="flex-1" aria-label="Menu sections">
          {NAV_MENUS.filter((menu) => !menu.adminOnly || role === 'admin').map((menu) => (
            <AccordionSection
              key={menu.id}
              menu={menu}
              uid={uid}
              onNavigate={onClose}
              onEventTool={onEventTool}
            />
          ))}
        </nav>

        {/* Utility links */}
        <div className="border-t border-border pb-[env(safe-area-inset-bottom)]">
          {HELP_MENU_ITEMS.slice(0, 2).map((entry) => {
            const Icon = entry.icon;
            return (
              <Link
                key={entry.id}
                to={entry.to ?? '/help'}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
              >
                <Icon size={18} className="shrink-0 text-textmuted" />
                <span className="min-w-0 truncate">{entry.label}</span>
              </Link>
            );
          })}
          {user && (
            <>
              <Link
                to="/settings"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
              >
                <Setting2 size={18} className="shrink-0 text-textmuted" />
                <span className="min-w-0 truncate">Settings</span>
              </Link>
              {role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                >
                  <ShieldTick size={18} className="shrink-0 text-textmuted" />
                  <span className="min-w-0 truncate">Admin console</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void signOut();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-body font-semibold text-danger transition-colors duration-200 hover:bg-primary-6"
              >
                <Logout size={18} className="shrink-0" />
                <span className="min-w-0 truncate">Sign out</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
