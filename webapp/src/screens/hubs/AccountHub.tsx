/**
 * Account hub (section 3.6) — replaces the old single SettingsScreen as the
 * landing page for account concerns, with the real settings screens one tap
 * deeper. Keeps the "Member since" row and the "Payout settings" entry the
 * role-merge test asserts (each exactly once, on the hub tiles).
 */
import { Link, useNavigate } from 'react-router-dom';
import { Card, Logout, NotificationBing, Shield, User, UserMinus, Wallet2 } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { Avatar } from '../../components/ui';
import { HubPage, type HubTileData } from '../../components/hub';
import { formatDateLong } from '../../lib/format';

export default function AccountHub() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const blockedCount = user.blockedUids.length;

  const tiles: HubTileData[] = [
    {
      id: 'account',
      label: 'Account details',
      description: 'Name, phone, bio and photo.',
      icon: User,
      to: '/settings/account',
      featured: true,
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Change password and blocked accounts.',
      icon: Shield,
      to: '/settings/security',
      count: blockedCount > 0 ? blockedCount : undefined,
    },
    {
      id: 'notifications',
      label: 'Notification preferences',
      description: 'Reminders, messages and promotions.',
      icon: NotificationBing,
      to: '/settings/notifications',
    },
    {
      id: 'payment-methods',
      label: 'Payment methods',
      description: 'Your saved MoMo wallet.',
      icon: Card,
      to: '/settings/payment-methods',
    },
    {
      id: 'payouts',
      label: 'Payout settings',
      description: 'Bank and MoMo payout details.',
      icon: Wallet2,
      to: '/organizer/payouts',
    },
    {
      id: 'blocked',
      label: 'Blocked accounts',
      description: 'People you have muted and blocked.',
      icon: UserMinus,
      to: '/settings/blocked',
      count: blockedCount > 0 ? blockedCount : undefined,
    },
  ];

  return (
    <>
      {/* Identity summary — carries the required "Member since" row. */}
      <div className="mb-6 flex min-w-0 items-center gap-4 rounded-[20px] border border-border bg-surface p-4 shadow-card">
        <Avatar name={user.name || 'Guest'} url={user.avatarUrl} size={56} ring />
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-subtitle text-textprimary">{user.name || 'Guest'}</p>
          <p className="min-w-0 truncate text-caption text-textmuted">{user.email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-textmuted">
            <span>Member since</span>
            <span className="font-semibold text-textprimary">{formatDateLong(user.createdAt)}</span>
          </p>
        </div>
        <Link
          to="/profile"
          className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-caption font-bold text-primary transition-colors duration-200 hover:border-primary"
        >
          Profile
        </Link>
      </div>

      <HubPage sections={[{ id: 'account', title: 'Settings', tiles }]} />

      <div className="mt-8">
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
          className="flex w-full items-center gap-3 rounded-base px-2 py-3.5 text-left transition-colors duration-200 hover:bg-dangerbg"
        >
          <Logout size={20} className="shrink-0 text-danger" />
          <span className="min-w-0 truncate text-button text-danger">Sign out</span>
        </button>
      </div>
    </>
  );
}
