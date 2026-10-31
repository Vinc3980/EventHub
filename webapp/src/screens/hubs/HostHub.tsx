/**
 * Host hub (section 3.6) — the categorical landing for everything an organizer
 * does. Tiles carry live counts from the same queries their destinations run.
 */
import {
  Add,
  Calendar1,
  Copy,
  DiscountShape,
  Note,
  People,
  PresentionChart,
  Receipt,
  Scan,
  Send2,
  Timer1,
  UserTick,
  Wallet1,
} from 'iconsax-react';
import { HubPage, type HubTileData } from '../../components/hub';
import { useHostCounts } from '../../components/hubCounts';

export default function HostHub() {
  const { total, drafts } = useHostCounts();

  const plan: HubTileData[] = [
    {
      id: 'create',
      label: 'Create event',
      description: 'Publish a new listing in minutes.',
      icon: Add,
      to: '/organizer/events/new',
      featured: true,
    },
    {
      id: 'my-events',
      label: 'My events',
      description: 'Drafts, live listings and past events.',
      icon: Calendar1,
      to: '/organizer/events',
      count: total ?? null,
    },
    {
      id: 'drafts',
      label: 'Drafts',
      description: 'Listings you have not submitted yet.',
      icon: Note,
      to: '/organizer/events?view=drafts',
      count: drafts ?? null,
    },
    {
      id: 'duplicate',
      label: 'Duplicate an event',
      description: 'Copy a past event into a new draft.',
      icon: Copy,
      to: '/organizer/events?duplicate=1',
    },
  ];

  const tools: HubTileData[] = [
    {
      id: 'guests',
      label: 'Guest lists',
      description: 'Contacts, plus-ones and invited guests.',
      icon: People,
      eventTo: '/organizer/events/:id/guests',
    },
    {
      id: 'rsvp',
      label: 'RSVP list',
      description: 'Registrations, seats and check-ins.',
      icon: UserTick,
      eventTo: '/organizer/events/:id',
    },
    {
      id: 'scan',
      label: 'Scan tickets',
      description: 'Check attendees in with the camera.',
      icon: Scan,
      eventTo: '/organizer/events/:id/scan',
    },
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
  ];

  const money: HubTileData[] = [
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
  ];

  const withPicker = (tiles: HubTileData[]): HubTileData[] => tiles;

  return (
    <HubPage
      sections={[
        { id: 'plan', title: 'Plan', tiles: plan },
        { id: 'run', title: 'Run the day', tiles: withPicker(tools) },
        { id: 'money', title: 'Money', tiles: withPicker(money) },
      ]}
    />
  );
}
