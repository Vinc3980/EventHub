/**
 * Route metadata — the single source of truth for the document <title>,
 * breadcrumbs, active top-nav group, public/private decision and page layout
 * (section 3.4 of the spec). It replaces the old hand-written TITLES regex
 * list in AppShell.
 *
 * Every `path` literal in `App.tsx` must have an entry here — the
 * `route-meta` test fails the build if one is missing.
 */

export type NavGroupId =
  | 'home'
  | 'explore'
  | 'tickets'
  | 'host'
  | 'community'
  | 'admin'
  | 'help'
  | 'none';

/** `default` = top nav + footer, `focused` = checkout-style minimal chrome, `bare` = full-height. */
export type LayoutKind = 'default' | 'focused' | 'bare';

export interface RouteMeta {
  /** Matches the React Router `path` used in App.tsx (`:param` segments match anything). */
  pattern: string;
  /** Document title + PageHeader heading + breadcrumb label for children. */
  title: string;
  /** Parent pattern; drives the breadcrumb trail (ancestors only, never the current page). */
  parent?: string;
  navGroup?: NavGroupId;
  /** Viewable without a session (local-first: "public" = no login needed on this device). */
  public?: boolean;
  layout?: LayoutKind;
  /** AppShell renders the shared PageHeader (crumbs + H1 + actions) for this route. */
  header?: boolean;
}

export const ROOT_PATTERN = '/';

export const ROUTE_META: readonly RouteMeta[] = [
  // ---- public site -------------------------------------------------------
  { pattern: '/', title: 'EventHub', navGroup: 'explore', public: true, layout: 'default' },
  { pattern: '/landing', title: 'EventHub', parent: '/', public: true, layout: 'default' },
  { pattern: '/login', title: 'Log in', public: true, layout: 'focused' },
  { pattern: '/signup', title: 'Create account', public: true, layout: 'focused' },
  { pattern: '/help', title: 'Help', parent: '/', navGroup: 'help', public: true, layout: 'default' },
  {
    pattern: '/help/:slug',
    title: 'Help article',
    parent: '/help',
    navGroup: 'help',
    public: true,
    layout: 'default',
  },
  {
    pattern: '/explore',
    title: 'Explore',
    parent: '/',
    navGroup: 'explore',
    public: true,
    layout: 'default',
  },
  {
    pattern: '/event/:eventId',
    title: 'Event',
    parent: '/explore',
    navGroup: 'explore',
    public: true,
    layout: 'default',
  },
  {
    pattern: '/u/:uid',
    title: 'Profile',
    parent: '/',
    navGroup: 'none',
    public: true,
    layout: 'default',
  },
  {
    pattern: '/u/:uid/followers',
    title: 'Followers',
    parent: '/u/:uid',
    navGroup: 'none',
    public: true,
    layout: 'default',
  },
  {
    pattern: '/u/:uid/following',
    title: 'Following',
    parent: '/u/:uid',
    navGroup: 'none',
    public: true,
    layout: 'default',
  },

  // ---- daily destinations (default chrome) -------------------------------
  { pattern: '/home', title: 'Home', navGroup: 'home', layout: 'default' },
  { pattern: '/chats', title: 'Chats', parent: '/community', navGroup: 'community', layout: 'default', header: true },
  {
    pattern: '/chats/:chatId',
    title: 'Chat',
    parent: '/chats',
    navGroup: 'community',
    layout: 'bare',
  },
  { pattern: '/profile', title: 'Profile', navGroup: 'none', layout: 'default' },
  {
    pattern: '/notifications',
    title: 'Notifications',
    parent: '/community',
    navGroup: 'community',
    layout: 'default',
    header: true,
  },

  // ---- tickets module ----------------------------------------------------
  { pattern: '/tickets', title: 'Tickets', parent: '/', navGroup: 'tickets', layout: 'default', header: true },
  {
    pattern: '/bookings',
    title: 'My bookings',
    parent: '/tickets',
    navGroup: 'tickets',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/saved',
    title: 'Saved events',
    parent: '/tickets',
    navGroup: 'tickets',
    layout: 'default',
    header: true,
  },

  // ---- focused checkout-style flows (no footer, no crumbs) --------------
  {
    pattern: '/event/:eventId/register',
    title: 'Registration',
    navGroup: 'explore',
    public: true,
    layout: 'focused',
  },
  {
    pattern: '/event/:eventId/pay/:bookingId',
    title: 'Payment',
    navGroup: 'explore',
    layout: 'focused',
  },
  { pattern: '/booking/:bookingId', title: 'Ticket', navGroup: 'tickets', layout: 'focused' },
  {
    pattern: '/event/:eventId/photos',
    title: 'Event photos',
    parent: '/event/:eventId',
    navGroup: 'explore',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/event/:eventId/rate',
    title: 'Rate event',
    parent: '/event/:eventId',
    navGroup: 'explore',
    layout: 'focused',
  },

  // ---- host module -------------------------------------------------------
  { pattern: '/host', title: 'Host', parent: '/', navGroup: 'host', layout: 'default', header: true },
  { pattern: '/organizer', title: 'Host', parent: '/host', navGroup: 'host', layout: 'default' },
  {
    pattern: '/organizer/events',
    title: 'My events',
    parent: '/host',
    navGroup: 'host',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/organizer/events/new',
    title: 'Create event',
    parent: '/host',
    navGroup: 'host',
    layout: 'focused',
  },
  {
    pattern: '/organizer/events/:id',
    title: 'Event',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/edit',
    title: 'Edit event',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'focused',
  },
  {
    pattern: '/organizer/events/:id/analytics',
    title: 'Analytics',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/discounts',
    title: 'Discount codes',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/refunds',
    title: 'Refund requests',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/boost',
    title: 'Boost event',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/guests',
    title: 'Guest list',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/invite',
    title: 'Send invitations',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'default',
  },
  {
    pattern: '/organizer/events/:id/scan',
    title: 'Scan tickets',
    parent: '/organizer/events',
    navGroup: 'host',
    layout: 'bare',
  },
  {
    pattern: '/organizer/payouts',
    title: 'Payouts',
    parent: '/host',
    navGroup: 'host',
    layout: 'default',
    header: true,
  },

  // ---- community + account ----------------------------------------------
  {
    pattern: '/community',
    title: 'Community',
    parent: '/',
    navGroup: 'community',
    layout: 'default',
    header: true,
  },
  { pattern: '/settings', title: 'Settings', parent: '/', navGroup: 'none', layout: 'default', header: true },
  {
    pattern: '/settings/account',
    title: 'Account details',
    parent: '/settings',
    navGroup: 'none',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/settings/security',
    title: 'Security',
    parent: '/settings',
    navGroup: 'none',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/settings/notifications',
    title: 'Notification preferences',
    parent: '/settings',
    navGroup: 'none',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/settings/blocked',
    title: 'Blocked accounts',
    parent: '/settings',
    navGroup: 'none',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/settings/payment-methods',
    title: 'Payment methods',
    parent: '/settings',
    navGroup: 'none',
    layout: 'default',
    header: true,
  },

  // ---- admin -------------------------------------------------------------
  { pattern: '/admin', title: 'Admin', parent: '/', navGroup: 'admin', layout: 'default', header: true },
  {
    pattern: '/admin/overview',
    title: 'Overview',
    parent: '/admin',
    navGroup: 'admin',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/admin/events',
    title: 'Event review',
    parent: '/admin',
    navGroup: 'admin',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/admin/events/:id/review',
    title: 'Review event',
    parent: '/admin/events',
    navGroup: 'admin',
    layout: 'default',
  },
  {
    pattern: '/admin/users',
    title: 'Users',
    parent: '/admin',
    navGroup: 'admin',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/admin/reports',
    title: 'Reports',
    parent: '/admin',
    navGroup: 'admin',
    layout: 'default',
    header: true,
  },
  {
    pattern: '/admin/settings',
    title: 'Platform settings',
    parent: '/admin',
    navGroup: 'admin',
    layout: 'default',
    header: true,
  },

  { pattern: '*', title: 'Page not found', navGroup: 'none', layout: 'default' },
];

const BY_PATTERN = new Map(ROUTE_META.map((meta) => [meta.pattern, meta]));

function segments(path: string): string[] {
  return path.split('/').filter((part) => part.length > 0);
}

function matches(pattern: string, pathname: string): boolean {
  const patternParts = segments(pattern);
  const pathParts = segments(pathname);
  if (pattern === '*') return true;
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every(
    (part, index) => part.startsWith(':') || part === pathParts[index],
  );
}

/**
 * Metadata for a concrete pathname. Dynamic patterns are tried in list order,
 * so static routes should sit above their `:param` siblings (they already do).
 * Unmatched paths fall through to the `*` entry.
 */
export function routeMeta(pathname: string): RouteMeta {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  for (const meta of ROUTE_META) {
    if (meta.pattern === '*') continue;
    if (matches(meta.pattern, clean)) return meta;
  }
  return BY_PATTERN.get('*') as RouteMeta;
}

export function isPublicRoute(pathname: string): boolean {
  return routeMeta(pathname).public === true;
}

export function layoutFor(pathname: string): LayoutKind {
  return routeMeta(pathname).layout ?? 'default';
}

export function navGroupFor(pathname: string): NavGroupId {
  return routeMeta(pathname).navGroup ?? 'none';
}

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Ancestor trail for a pathname (the current page is deliberately left out —
 * the PageHeader/H1 carries it): `/organizer/events/x/analytics` →
 * Home › Host › My events.
 */
export function breadcrumbs(pathname: string): Crumb[] {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const trail: Crumb[] = [];
  const seen = new Set<string>();
  let current = routeMeta(clean);

  while (current.parent && !seen.has(current.parent)) {
    seen.add(current.parent);
    const parentMeta = BY_PATTERN.get(current.parent);
    if (!parentMeta) break;
    trail.unshift({
      label: parentMeta.pattern === ROOT_PATTERN ? 'Home' : parentMeta.title,
      to: parentMeta.pattern,
    });
    current = parentMeta;
  }
  return trail;
}

/** `<title>` for a pathname — "Analytics · EventHub" (landing stays "EventHub"). */
export function documentTitle(pathname: string): string {
  const meta = routeMeta(pathname);
  if (meta.pattern === '/' || meta.pattern === '/landing') return 'EventHub';
  return `${meta.title} · EventHub`;
}
