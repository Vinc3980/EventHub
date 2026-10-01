import {
  Alarm,
  CloseCircle,
  Information,
  Notification,
  NotificationBing,
  Ticket,
  TickCircle,
  Timer1,
  UserAdd,
  Message,
} from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { notificationService } from '../../services/notificationService';
import { type Notification as ActivityNotification } from '../../models';
import { EmptyState } from '../../components/ui';
import { useNotifications } from '../../components/SocialData';

function iconForType(type: string) {
  switch (type) {
    case 'booking_confirmed':
      return Ticket;
    case 'booking_cancelled':
      return CloseCircle;
    case 'new_follower':
    case 'new_follow':
      return UserAdd;
    case 'event_update':
      return Information;
    case 'event_reminder':
      return Alarm;
    case 'refund_approved':
      return TickCircle;
    case 'refund_denied':
      return CloseCircle;
    case 'waitlist_spot':
      return Timer1;
    case 'new_chat_message':
      return Message;
    case 'event_post':
      return Notification;
    default:
      return NotificationBing;
  }
}

export default function NotificationsScreen() {
  const { uid } = useAuth();
  const { data: notifications, error } = useNotifications(uid);

  async function markAllRead() {
    for (const item of notifications ?? []) {
      if (!item.read) await notificationService.markRead(item.id);
    }
  }

  async function openNotification(item: ActivityNotification) {
    if (!item.read) await notificationService.markRead(item.id);
  }

  if (!uid) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-body text-textmuted">Sign in to see notifications.</p>
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Could not load notifications." />;
  }

  if (notifications === undefined) {
    return (
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card" aria-busy="true" aria-label="Loading notifications">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3 px-4 py-3">
            <span className="h-10 w-10 shrink-0 rounded-full bg-skeleton" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-4 w-40 bg-skeleton" />
              <span className="block h-3 w-64 max-w-full bg-skeleton" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  if (notifications.length === 0) {
    return (
      <div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled
            className="py-1 text-caption font-semibold text-neutral"
          >
            Mark all read
          </button>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-lg bg-skeleton">
            <Notification size={32} className="text-textmuted" />
          </span>
          <h3 className="text-title font-extrabold text-textprimary">No notifications yet</h3>
          <p className="mt-2 whitespace-pre-line text-body text-textmuted">
            {'Updates about your events and bookings\nwill appear here.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
          className="py-1 text-caption font-semibold text-primary transition-opacity duration-200 hover:opacity-80 disabled:text-neutral"
        >
          Mark all read
        </button>
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {notifications.map((item, index) => {
          const Icon = iconForType(item.type);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void openNotification(item)}
              className={`flex w-full animate-fadeup items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-neutralbg ${
                index > 0 ? 'border-t border-border' : ''
              }`}
              style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  item.read ? 'bg-neutralbg text-textmuted' : 'bg-primary-10 text-primary'
                }`}
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-body text-textprimary ${
                    item.read ? 'font-medium' : 'font-bold'
                  }`}
                >
                  {item.title}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-caption text-textmuted">
                  {item.body}
                </span>
              </span>
              {!item.read && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
