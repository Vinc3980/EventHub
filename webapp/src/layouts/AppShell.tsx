import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Add,
  ArrowLeft,
  Calendar,
  Home2,
  Message,
  NotificationBing,
  Profile2User,
  SearchNormal,
  Setting2,
  ShieldTick,
  Star1,
  TickCircle,
  User,
  Wallet1,
} from 'iconsax-react';
import { useAuth, effectiveRole } from '../app/AuthProvider';
import { useLiveQuery } from '../db/live';
import { notificationService } from '../services/notificationService';
import { Avatar, CountBadge, OfflineBanner, Skeleton } from '../components/ui';
import { useBreakpoint, useOnline } from '../hooks/useBreakpoint';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home2;
  badgeKey?: 'notifications';
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home2, end: true },
  { to: '/explore', label: 'Explore', icon: SearchNormal },
  { to: '/chats', label: 'Chats', icon: Message },
  { to: '/profile', label: 'Profile', icon: User },
];

const PERSONAL: NavItem[] = [
  { to: '/bookings', label: 'My bookings', icon: TickCircle },
  { to: '/saved', label: 'Saved', icon: Star1 },
  { to: '/notifications', label: 'Notifications', icon: NotificationBing, badgeKey: 'notifications' },
  { to: '/settings', label: 'Settings', icon: Setting2 },
];

const ORGANIZER: NavItem[] = [
  { to: '/organizer', label: 'Dashboard', icon: Calendar, end: true },
  { to: '/organizer/events', label: 'My events', icon: Profile2User },
  { to: '/organizer/payouts', label: 'Payouts', icon: Wallet1 },
];

const ADMIN: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: ShieldTick, end: true },
  { to: '/admin/events', label: 'Events', icon: Calendar },
  { to: '/admin/users', label: 'Users', icon: Profile2User },
  { to: '/admin/reports', label: 'Reports', icon: NotificationBing },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'EventHub'],
  [/^\/home/, 'Home'],
  [/^\/explore/, 'Explore'],
  [/^\/chats\/[^/]+/, 'Chat'],
  [/^\/chats/, 'Chats'],
  [/^\/profile/, 'Profile'],
  [/^\/u\/[^/]+\/followers/, 'Followers'],
  [/^\/u\/[^/]+\/following/, 'Following'],
  [/^\/u\/[^/]+/, 'Profile'],
  [/^\/event\/[^/]+\/photos/, 'Photos'],
  [/^\/event\/[^/]+\/rate/, 'Rate'],
  [/^\/event\/[^/]+\/register/, 'Register'],
  [/^\/event\/[^/]+\/pay/, 'Payment'],
  [/^\/event\/[^/]+/, 'Event'],
  [/^\/booking\//, 'Ticket'],
  [/^\/bookings/, 'My bookings'],
  [/^\/saved/, 'Saved'],
  [/^\/notifications/, 'Notifications'],
  [/^\/settings\/blocked/, 'Blocked accounts'],
  [/^\/settings\/payment-methods/, 'Payment methods'],
  [/^\/settings/, 'Settings'],
  [/^\/organizer\/events\/[^/]+\/analytics/, 'Analytics'],
  [/^\/organizer\/events\/[^/]+\/discounts/, 'Discount codes'],
  [/^\/organizer\/events\/[^/]+\/refunds/, 'Refunds'],
  [/^\/organizer\/events\/[^/]+\/boost/, 'Boost event'],
  [/^\/organizer\/events\/[^/]+\/guests/, 'Guest list'],
  [/^\/organizer\/events\/[^/]+\/invite/, 'Invitations'],
  [/^\/organizer\/events\/[^/]+\/scan/, 'Scan tickets'],
  [/^\/organizer\/events\/[^/]+\/edit/, 'Edit event'],
  [/^\/organizer\/events\/[^/]+/, 'Event'],
  [/^\/organizer\/events\/new/, 'New event'],
  [/^\/organizer\/events/, 'My events'],
  [/^\/organizer\/payouts/, 'Payouts'],
  [/^\/organizer/, 'Organizer'],
  [/^\/admin\/events\/[^/]+/, 'Event review'],
  [/^\/admin\/events/, 'Events'],
  [/^\/admin\/users/, 'Users'],
  [/^\/admin\/reports/, 'Reports'],
  [/^\/admin\/settings/, 'Admin settings'],
  [/^\/admin/, 'Admin'],
];

function titleFor(pathname: string): string {
  for (const [re, title] of TITLES) if (re.test(pathname)) return title;
  return 'EventHub';
}

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundImage: 'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)' }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

function NavButton({ item, rail }: { item: NavItem; rail: boolean }) {
  const { uid } = useAuth();
  const unread = useLiveQuery(
    async () => (item.badgeKey === 'notifications' && uid ? notificationService.unreadCount(uid) : 0),
    [item.badgeKey, uid],
    0,
  );
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={rail ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-base text-body font-semibold transition-colors duration-200 ${
          rail ? 'h-12 w-12 justify-center' : 'h-11 px-3'
        } ${isActive ? 'bg-primary-10 text-primary' : 'text-textmuted hover:bg-primary-6 hover:text-textprimary'}`
      }
    >
      <span className="relative shrink-0">
        <Icon size={22} />
        {unread != null && unread > 0 && (
          <span className="absolute -right-1.5 -top-1">
            <CountBadge count={unread} />
          </span>
        )}
      </span>
      {!rail && <span className="min-w-0 truncate">{item.label}</span>}
      {rail && unread != null && unread > 0 && (
        <span className="absolute right-1.5 top-1.5">
          <CountBadge count={unread} />
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({ rail }: { rail: boolean }) {
  const { user, signOut } = useAuth();
  const role = effectiveRole(user);
  const createdAt = user?.createdAt;
  const joinedLabel =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? `Joined ${createdAt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
      : '';

  return (
    <nav
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface ${
        rail ? 'w-[76px] items-center px-3 py-5' : 'w-[248px] px-4 py-5'
      } tablet:flex`}
      aria-label="Primary"
    >
      <Link to={user ? '/home' : '/'} className={`mb-6 flex items-center gap-2.5 ${rail ? 'justify-center' : ''}`}>
        <BrandMark />
        {!rail && <span className="text-title font-extrabold tracking-tight text-textprimary">EventHub</span>}
      </Link>

      <div className={`flex flex-1 flex-col gap-1 overflow-y-auto ${rail ? 'items-center' : ''}`}>
        {PRIMARY.map((item) => (
          <NavButton key={item.to} item={item} rail={rail} />
        ))}

        {!rail && <p className="mb-1 mt-5 px-3 text-section uppercase tracking-wider text-neutral">You</p>}
        {PERSONAL.map((item) => (
          <NavButton key={item.to} item={item} rail={rail} />
        ))}

        {!rail && <p className="mb-1 mt-5 px-3 text-section uppercase tracking-wider text-neutral">Organizer</p>}
        {ORGANIZER.map((item) => (
          <NavButton key={item.to} item={item} rail={rail} />
        ))}

        {role === 'admin' && (
          <>
            {!rail && <p className="mb-1 mt-5 px-3 text-section uppercase tracking-wider text-neutral">Admin</p>}
            {ADMIN.map((item) => (
              <NavButton key={item.to} item={item} rail={rail} />
            ))}
          </>
        )}

        {!rail && (
          <Link
            to="/organizer/events/new"
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-base bg-primary px-4 text-button text-white transition-[filter] duration-200 hover:brightness-95"
          >
            <Add size={18} />
            Create event
          </Link>
        )}
        {rail && (
          <Link
            to="/organizer/events/new"
            title="Create event"
            className="mt-4 flex h-12 w-12 items-center justify-center rounded-base bg-primary text-white transition-[filter] duration-200 hover:brightness-95"
          >
            <Add size={22} />
          </Link>
        )}
      </div>

      <div className={`mt-4 border-t border-border pt-4 ${rail ? 'flex justify-center' : ''}`}>
        <Link
          to="/profile"
          className={`flex min-w-0 items-center gap-3 rounded-base hover:bg-primary-6 ${rail ? 'justify-center' : ''}`}
        >
          <Avatar name={user?.name ?? 'Guest'} url={user?.avatarUrl} size={36} />
          {!rail && (
            <span className="min-w-0">
              <span className="block truncate text-body font-bold text-textprimary">{user?.name ?? 'Guest'}</span>
              {role === 'admin' ? (
                <span className="block truncate text-caption capitalize text-textmuted">Admin</span>
              ) : joinedLabel !== '' ? (
                <span className="block truncate text-caption text-textmuted">{joinedLabel}</span>
              ) : null}
            </span>
          )}
        </Link>
        {!rail && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 w-full rounded-md py-2 text-caption font-semibold text-textmuted hover:text-danger"
          >
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}

function TopBar({ title }: { title: string }) {
  const { uid, user } = useAuth();
  const location = useLocation();
  const unread = useLiveQuery(
    async () => (uid ? notificationService.unreadCount(uid) : 0),
    [uid],
    0,
  );
  const depth = location.pathname.split('/').filter(Boolean).length;
  const canGoBack = depth > 1;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur tablet:px-6">
      <Link to="/home" className="tablet:hidden" aria-label="EventHub home">
        <BrandMark size={32} />
      </Link>
      {canGoBack && (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => window.history.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-textprimary hover:bg-primary-6 tablet:hidden"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-subtitle text-textprimary">{title}</h1>

      <div className="hidden w-[320px] tablet:block">
        <Link
          to="/explore"
          className="flex h-10 items-center gap-2 rounded-pill border border-border bg-background px-4 text-caption text-textmuted transition-colors duration-200 hover:border-primary"
        >
          <SearchNormal size={16} />
          <span className="min-w-0 truncate">Search events, venues, organizers</span>
        </Link>
      </div>

      <NavLink
        to="/notifications"
        aria-label="Notifications"
        className={({ isActive }) =>
          `relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
            isActive ? 'bg-primary-6 text-primary' : 'text-textprimary hover:bg-primary-6'
          }`
        }
      >
        <NotificationBing size={22} />
        {unread != null && unread > 0 && (
          <span className="absolute right-1 top-1">
            <CountBadge count={unread} />
          </span>
        )}
      </NavLink>

      <Link to="/profile" className="shrink-0" aria-label="Profile">
        <Avatar name={user?.name ?? 'Guest'} url={user?.avatarUrl} size={34} />
      </Link>
    </header>
  );
}

function BottomTabs() {
  const items = [
    { to: '/home', label: 'Home', icon: Home2 },
    { to: '/explore', label: 'Explore', icon: SearchNormal },
    { to: '/chats', label: 'Chat', icon: Message },
    { to: '/profile', label: 'Profile', icon: User },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur tablet:hidden"
      aria-label="Primary"
    >
      {items.map(({ to, label, icon: Icon }) => (
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
    </nav>
  );
}

export function AppShell() {
  const breakpoint = useBreakpoint();
  const online = useOnline();
  const location = useLocation();
  const title = titleFor(location.pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar rail={breakpoint === 'tablet'} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        {!online && <OfflineBanner />}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 tablet:pb-10 tablet:pl-6 tablet:pr-6">
          <div className="mx-auto w-full max-w-[1200px] min-w-0">
            <Suspense
              fallback={
                <div className="space-y-4" aria-busy="true" aria-label="Loading">
                  <Skeleton className="h-8 w-52" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
