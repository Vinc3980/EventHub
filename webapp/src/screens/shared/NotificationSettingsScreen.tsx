/**
 * `/settings/notifications` — notification preferences (section 3.6).
 * Split out of the old SettingsScreen.
 */
import { NotificationBing } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { AuthService } from '../../services/authService';
import { Skeleton, Toggle } from '../../components/ui';
import { SectionCard, SectionHeader } from './settingsKit';

type NotifKey =
  | 'reminders'
  | 'messageNotifsEnabled'
  | 'followerNotifsEnabled'
  | 'promoNotifsEnabled';

const NOTIFICATIONS: { key: NotifKey; label: string; description: string }[] = [
  {
    key: 'reminders',
    label: 'Event reminders',
    description: "Get notified 24 hours before an event you're attending.",
  },
  {
    key: 'messageNotifsEnabled',
    label: 'New messages',
    description: 'When someone sends you a chat message.',
  },
  {
    key: 'followerNotifsEnabled',
    label: 'New followers',
    description: 'When someone follows your profile.',
  },
  {
    key: 'promoNotifsEnabled',
    label: 'Promotions & offers',
    description: 'Boosted events, discounts, and platform news.',
  },
];

export default function NotificationSettingsScreen() {
  const { uid, user } = useAuth();
  const authService = new AuthService();

  async function setNotification(key: NotifKey, value: boolean) {
    if (!uid) return;
    if (key === 'reminders') {
      await authService.setRemindersEnabled(uid, value);
    } else {
      await authService.setNotificationPref(uid, key, value);
    }
  }

  function notificationValue(key: NotifKey): boolean {
    if (!user) return false;
    if (key === 'reminders') return user.remindersEnabled;
    if (key === 'messageNotifsEnabled') return user.messageNotifsEnabled;
    if (key === 'followerNotifsEnabled') return user.followerNotifsEnabled;
    return user.promoNotifsEnabled;
  }

  if (!user || !uid) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading notifications">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <section>
      <SectionHeader icon={<NotificationBing size={16} />} title="Notifications" />
      <SectionCard>
        <div className="divide-y divide-border">
          {NOTIFICATIONS.map((row) => (
            <div key={row.key} className="px-4">
              <Toggle
                label={row.label}
                description={row.description}
                checked={notificationValue(row.key)}
                onChange={(value) => void setNotification(row.key, value)}
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}
