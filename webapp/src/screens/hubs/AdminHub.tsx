/**
 * Admin hub (section 3.6) — the console landing for platform admins, with
 * live counts for the queues that need attention.
 */
import { Calendar1, Flag, Note, PresentionChart, Setting2, Timer1, User as UserIcon } from 'iconsax-react';
import { HubPage, type HubTileData } from '../../components/hub';
import { useAdminCounts } from '../../components/hubCounts';

export default function AdminHub() {
  const counts = useAdminCounts();

  const tiles: HubTileData[] = [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Platform stats and activity.',
      icon: PresentionChart,
      to: '/admin/overview',
      featured: true,
    },
    {
      id: 'review',
      label: 'Event review',
      description: 'Approve or reject pending events.',
      icon: Timer1,
      to: '/admin/events',
      count: counts.pending,
      danger: (counts.pending ?? 0) > 0,
    },
    {
      id: 'users',
      label: 'Users',
      description: 'Accounts, roles and suspensions.',
      icon: UserIcon,
      to: '/admin/users',
      count: counts.users,
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Open safety and content reports.',
      icon: Flag,
      to: '/admin/reports',
      count: counts.reports,
      danger: (counts.reports ?? 0) > 0,
    },
    {
      id: 'settings',
      label: 'Platform settings',
      description: 'Fees, demo data and app options.',
      icon: Setting2,
      to: '/admin/settings',
    },
    {
      id: 'events',
      label: 'All events',
      description: 'Every listing on the platform.',
      icon: Calendar1,
      to: '/admin/events',
    },
    {
      id: 'demo-data',
      label: 'Demo data',
      description: 'Reseed or clear the local dataset.',
      icon: Note,
      to: '/admin/settings',
    },
  ];

  return <HubPage sections={[{ id: 'admin', title: 'Admin console', tiles }]} />;
}
