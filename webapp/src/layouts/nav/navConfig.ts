/**
 * The single navigation tree (section 3.2). The desktop submenus, the
 * mobile/tablet drawer and the footer all read from this file, so an entry can
 * never drift between surfaces.
 *
 * `to` is a static route. `eventTo` is an event-scoped tool template
 * (`/organizer/events/:id/<tool>`) — surfaces open the EventPickerSheet first.
 * `userPath` entries resolve against the signed-in profile (`/u/<uid>/…`).
 */
import type { Icon } from 'iconsax-react';
import {
  Activity,
  Add,
  AddCircle,
  Book1,
  Calendar,
  Calendar1,
  Copy,
  DiscountShape,
  Flag,
  Heart,
  Information,
  Lifebuoy,
  Message,
  MessageQuestion,
  Money,
  NotificationBing,
  Note,
  People,
  PresentionChart,
  Profile2User,
  Receipt,
  Refresh,
  Scan,
  SearchNormal,
  Send2,
  Setting2,
  ShieldTick,
  Star,
  Star1,
  Ticket,
  Timer,
  Timer1,
  User,
  UserTick,
  Wallet1,
} from 'iconsax-react';
import { CATEGORIES } from '../../lib/constants';

export interface NavEntry {
  id: string;
  label: string;
  description?: string;
  icon: Icon;
  /** Static route. */
  to?: string;
  /** Event-scoped template — surfaces open EventPickerSheet. */
  eventTo?: string;
  /** Profile-scoped route: `/u/<uid>/<userPath>`. */
  userPath?: 'followers' | 'following';
  badge?: 'notifications' | 'chats';
  adminOnly?: boolean;
}

export interface NavSection {
  id: string;
  title?: string;
  items: NavEntry[];
}

export interface NavMenu {
  id: 'home' | 'explore' | 'tickets' | 'host' | 'community' | 'admin';
  label: string;
  icon: Icon;
  /** Top-level destination (the hub page or the module's main screen). */
  to: string;
  sections: NavSection[];
  adminOnly?: boolean;
}

export const CATEGORY_META: Record<string, { label: string; description: string; icon: Icon }> = {
  wedding: {
    label: 'Weddings',
    description: 'Ceremonies, receptions and everything in between.',
    icon: Heart,
  },
  funeral: {
    label: 'Funerals & memorials',
    description: 'Quiet, respectful gatherings and memorial services.',
    icon: Calendar1,
  },
  corporate: {
    label: 'Corporate',
    description: 'Conferences, workshops and company days.',
    icon: Ticket,
  },
  social: {
    label: 'Social & parties',
    description: 'Concerts, birthdays, reunions and beach days.',
    icon: Star,
  },
};

/** "Find events" entries — the query params Explore honours (section 3.1). */
export const EXPLORE_FIND_ITEMS: NavEntry[] = [
  {
    id: 'weekend',
    label: 'This weekend',
    description: 'Events on Saturday and Sunday.',
    icon: Calendar,
    to: '/explore?date=weekend',
  },
  {
    id: 'free',
    label: 'Free events',
    description: 'Nothing to pay at the door.',
    icon: Money,
    to: '/explore?free=1',
  },
  {
    id: 'near',
    label: 'Near me',
    description: 'Sort by distance from your location.',
    icon: SearchNormal,
    to: '/explore?near=1',
  },
  {
    id: 'featured',
    label: 'Featured',
    description: 'Boosted by organizers this week.',
    icon: Timer1,
    to: '/explore?featured=1',
  },
  {
    id: 'new',
    label: 'Newly added',
    description: 'The latest listings on EventHub.',
    icon: AddCircle,
    to: '/explore?sort=new',
  },
];

export const EXPLORE_CATEGORY_ITEMS: NavEntry[] = CATEGORIES.map((category) => {
  const meta = CATEGORY_META[category];
  return {
    id: category,
    label: meta.label,
    description: meta.description,
    icon: meta.icon,
    to: `/explore?category=${category}`,
  };
});

const HOME_SECTIONS: NavSection[] = [
  {
    id: 'feed',
    items: [
      {
        id: 'for-you',
        label: 'For You',
        description: 'The picks you get every time you open the app.',
        icon: Activity,
        to: '/home',
      },
      {
        id: 'following',
        label: 'Following',
        description: 'Updates from people you follow.',
        icon: Profile2User,
        to: '/home?feed=following',
      },
      {
        id: 'share',
        label: 'Share an update',
        description: 'Post photos or news to your followers.',
        icon: Send2,
        to: '/home?compose=1',
      },
    ],
  },
];

const EXPLORE_SECTIONS: NavSection[] = [
  {
    id: 'type',
    title: 'Browse by type',
    items: EXPLORE_CATEGORY_ITEMS,
  },
  {
    id: 'find',
    title: 'Find events',
    items: EXPLORE_FIND_ITEMS,
  },
];

const TICKETS_SECTIONS: NavSection[] = [
  {
    id: 'tickets',
    items: [
      {
        id: 'upcoming',
        label: 'Upcoming tickets',
        description: 'Events you are going to.',
        icon: Ticket,
        to: '/tickets?view=upcoming',
      },
      {
        id: 'past',
        label: 'Past events',
        description: 'Tickets you have already used.',
        icon: Calendar,
        to: '/tickets?view=past',
      },
      {
        id: 'pending',
        label: 'Pending payment',
        description: 'Bookings waiting for MoMo approval.',
        icon: Receipt,
        to: '/tickets?view=pending',
      },
      {
        id: 'refunds',
        label: 'Refunds & cancellations',
        description: 'Refund requests and cancelled bookings.',
        icon: Refresh,
        to: '/tickets?view=refunds',
      },
      {
        id: 'saved',
        label: 'Saved events',
        description: 'Events you bookmarked.',
        icon: Star1,
        to: '/saved',
      },
      {
        id: 'waitlists',
        label: 'Waitlists',
        description: 'Sold-out tickets you are queued for.',
        icon: Timer,
        to: '/tickets?view=waitlists',
      },
    ],
  },
];

const HOST_SECTIONS: NavSection[] = [
  {
    id: 'plan',
    title: 'Plan',
    items: [
      {
        id: 'create',
        label: 'Create event',
        description: 'Publish a new listing in minutes.',
        icon: Add,
        to: '/organizer/events/new',
      },
      {
        id: 'my-events',
        label: 'My events',
        description: 'Drafts, live listings and past events.',
        icon: Calendar1,
        to: '/organizer/events',
      },
      {
        id: 'drafts',
        label: 'Drafts',
        description: 'Listings you have not submitted yet.',
        icon: Note,
        to: '/organizer/events?view=drafts',
      },
      {
        id: 'duplicate',
        label: 'Duplicate an event',
        description: 'Copy a past event into a new draft.',
        icon: Copy,
        to: '/organizer/events?duplicate=1',
      },
    ],
  },
  {
    id: 'promote',
    title: 'Promote',
    items: [
      {
        id: 'invite',
        label: 'Send invitations',
        description: 'Bulk SMS invites and RSVP links.',
        icon: Send2,
        eventTo: '/organizer/events/:id/invite',
      },
      {
        id: 'boost',
        label: 'Boost an event',
        description: 'Feature it across Explore and Home.',
        icon: Timer1,
        eventTo: '/organizer/events/:id/boost',
      },
      {
        id: 'discounts',
        label: 'Discount codes',
        description: 'Percentage codes with usage limits.',
        icon: DiscountShape,
        eventTo: '/organizer/events/:id/discounts',
      },
    ],
  },
  {
    id: 'run',
    title: 'Run the day',
    items: [
      {
        id: 'guests',
        label: 'Guest lists',
        description: 'Contacts, plus-ones and invited guests.',
        icon: People,
        eventTo: '/organizer/events/:id/guests',
      },
      {
        id: 'scan',
        label: 'Scan tickets',
        description: 'Check attendees in with the camera.',
        icon: Scan,
        eventTo: '/organizer/events/:id/scan',
      },
      {
        id: 'rsvp',
        label: 'RSVP list',
        description: 'Registrations, seats and check-ins.',
        icon: UserTick,
        eventTo: '/organizer/events/:id',
      },
    ],
  },
  {
    id: 'money',
    title: 'Money',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Sales, views and capacity.',
        icon: PresentionChart,
        eventTo: '/organizer/events/:id/analytics',
      },
      {
        id: 'refunds',
        label: 'Refund requests',
        description: 'Approve or decline attendee refunds.',
        icon: Receipt,
        eventTo: '/organizer/events/:id/refunds',
      },
      {
        id: 'payouts',
        label: 'Payouts',
        description: 'Bank and MoMo payout details.',
        icon: Wallet1,
        to: '/organizer/payouts',
      },
    ],
  },
];

const COMMUNITY_SECTIONS: NavSection[] = [
  {
    id: 'community',
    items: [
      {
        id: 'chats',
        label: 'Chats',
        description: 'Group chats for your events.',
        icon: Message,
        to: '/chats',
        badge: 'chats',
      },
      {
        id: 'feed',
        label: 'Feed updates',
        description: 'Photos and news from the community.',
        icon: Activity,
        to: '/home',
      },
      {
        id: 'following',
        label: 'Following',
        description: 'People whose updates you see.',
        icon: Profile2User,
        userPath: 'following',
      },
      {
        id: 'followers',
        label: 'Followers',
        description: 'People following your profile.',
        icon: People,
        userPath: 'followers',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        description: 'Registrations, replies and reminders.',
        icon: NotificationBing,
        to: '/notifications',
        badge: 'notifications',
      },
    ],
  },
];

const ADMIN_SECTIONS: NavSection[] = [
  {
    id: 'admin',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        description: 'Platform stats and activity.',
        icon: Setting2,
        to: '/admin/overview',
      },
      {
        id: 'review',
        label: 'Event review',
        description: 'Approve or reject pending events.',
        icon: Timer1,
        to: '/admin/events',
      },
      {
        id: 'users',
        label: 'Users',
        description: 'Accounts, roles and suspensions.',
        icon: Profile2User,
        to: '/admin/users',
      },
      {
        id: 'reports',
        label: 'Reports',
        description: 'Open safety and content reports.',
        icon: Flag,
        to: '/admin/reports',
      },
      {
        id: 'settings',
        label: 'Platform settings',
        description: 'Fees, demo data and app options.',
        icon: Note,
        to: '/admin/settings',
      },
    ],
  },
];

export const NAV_MENUS: NavMenu[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Activity,
    to: '/home',
    sections: HOME_SECTIONS,
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: SearchNormal,
    to: '/explore',
    sections: EXPLORE_SECTIONS,
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: Ticket,
    to: '/tickets',
    sections: TICKETS_SECTIONS,
  },
  {
    id: 'host',
    label: 'Host',
    icon: Calendar1,
    to: '/host',
    sections: HOST_SECTIONS,
  },
  {
    id: 'community',
    label: 'Community',
    icon: People,
    to: '/community',
    sections: COMMUNITY_SECTIONS,
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: ShieldTick,
    to: '/admin',
    sections: ADMIN_SECTIONS,
    adminOnly: true,
  },
];

/** The five signed-out top-level items (spec 3.1): Explore, Host, Help + auth actions. */
export const LOGGED_OUT_MENUS: NavMenu[] = [
  {
    id: 'explore',
    label: 'Explore',
    icon: SearchNormal,
    to: '/explore',
    sections: EXPLORE_SECTIONS,
  },
  {
    id: 'host',
    label: 'Host',
    icon: Calendar1,
    to: '/signup',
    sections: [
      {
        id: 'host-promo',
        items: [
          {
            id: 'create-account',
            label: 'Create events with EventHub',
            description: 'Every signed-in account can host — no separate role needed.',
            icon: Add,
            to: '/signup',
          },
        ],
      },
    ],
  },
];

export interface FooterColumn {
  id: string;
  title: string;
  items: NavEntry[];
}

/** Footer columns reuse the same entries as the menus (section 4.1). */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    id: 'explore',
    title: 'Explore',
    items: [...EXPLORE_CATEGORY_ITEMS, EXPLORE_FIND_ITEMS[0], EXPLORE_FIND_ITEMS[1]],
  },
  {
    id: 'host',
    title: 'Host',
    items: [
      HOST_SECTIONS[0].items[0],
      {
        id: 'fees',
        label: 'Pricing & fees',
        description: 'The 2% platform fee, explained.',
        icon: Receipt,
        to: '/help/platform-fees',
      },
      HOST_SECTIONS[1].items[1],
      HOST_SECTIONS[3].items[2],
    ],
  },
  {
    id: 'help',
    title: 'Help',
    items: [
      { id: 'help-center', label: 'Help center', icon: Book1, to: '/help' },
      { id: 'contact', label: 'Contact', icon: MessageQuestion, to: '/help/contact-support' },
      {
        id: 'safety',
        label: 'Safety & reporting',
        icon: ShieldTick,
        to: '/help/safety-reporting',
      },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    items: [
      { id: 'terms', label: 'Terms', icon: Note, to: '/help/terms' },
      { id: 'privacy', label: 'Privacy', icon: Information, to: '/help/privacy' },
    ],
  },
];

/** Top-nav "Help ?" dropdown (Help is deliberately not a top-level item). */
export const HELP_MENU_ITEMS: NavEntry[] = [
  { id: 'help-center', label: 'Help center', description: 'Guides for buying and hosting.', icon: Book1, to: '/help' },
  {
    id: 'contact-support',
    label: 'Contact support',
    description: 'How to reach the EventHub team.',
    icon: Lifebuoy,
    to: '/help/contact-support',
  },
  { id: 'terms', label: 'Terms', description: 'Placeholder — awaiting client text.', icon: Note, to: '/help/terms' },
  {
    id: 'privacy',
    label: 'Privacy',
    description: 'Placeholder — awaiting client text.',
    icon: Information,
    to: '/help/privacy',
  },
];

/** Phone bottom tab bar — the four daily destinations plus the Menu tab. */
export const BOTTOM_TABS: { id: string; label: string; to: string; icon: Icon }[] = [
  { id: 'home', label: 'Home', to: '/home', icon: Activity },
  { id: 'explore', label: 'Explore', to: '/explore', icon: SearchNormal },
  { id: 'chats', label: 'Chat', to: '/chats', icon: Message },
  { id: 'profile', label: 'Profile', to: '/profile', icon: User },
];

/** Resolve an entry's destination for the signed-in user (null when it needs an event). */
export function entryHref(entry: NavEntry, uid: string | null): string | null {
  if (entry.eventTo) return null;
  if (entry.userPath) return uid ? `/u/${uid}/${entry.userPath}` : '/login';
  return entry.to ?? null;
}
