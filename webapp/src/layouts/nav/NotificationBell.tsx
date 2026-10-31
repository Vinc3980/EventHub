/**
 * Notification bell + dropdown (latest five, then "View all"). Unread count
 * comes from the live notifications stream; marking read happens on click,
 * right before navigating to the referenced screen.
 */
import { useCallback, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight2, NotificationBing } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useNotifications } from '../../components/SocialData';
import { CountBadge } from '../../components/ui';
import { notificationService } from '../../services/notificationService';
import { DropdownPanel, useDismissOnOutside, useEscape } from './Dropdown';
import type { Notification } from '../../models';

const MAX_ITEMS = 5;

/** Map a stored notification onto a real route (the model's `deepLink` wins). */
function routeFor(item: Notification): string {
  const ref = item.referenceId ?? '';
  if (item.deepLink && item.deepLink.trim().length > 0) return item.deepLink;
  switch (item.type) {
    case 'new_follow':
      return ref ? `/u/${ref}` : '/notifications';
    case 'order_update':
      return ref ? `/booking/${ref}` : '/notifications';
    case 'message':
      return ref ? `/chats/${ref}` : '/chats';
    case 'event_reminder':
      return ref ? `/event/${ref}` : '/explore';
    case 'moderation':
    case 'review':
    default:
      return '/notifications';
  }
}

function timeLabel(value: Date): string {
  const diff = Date.now() - value.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationBell() {
  const { uid } = useAuth();
  const navigate = useNavigate();
  const panelId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const { data } = useNotifications(uid);
  const all = data ?? [];
  const unread = all.filter((item) => !item.read).length;
  const items = all.slice(0, MAX_ITEMS);

  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutside(open, [triggerRef, panelRef], close);
  useEscape(open, close);

  const onItemClick = (item: Notification) => {
    if (!item.read) void notificationService.markRead(item.id);
    close();
    navigate(routeFor(item));
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={labelId}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
      >
        <NotificationBing size={22} variant={open ? 'Bold' : 'Linear'} />
        {unread > 0 && (
          <span className="absolute right-1 top-1">
            <CountBadge count={unread} />
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef}>
          <DropdownPanel id={panelId} labelledBy={labelId} align="right">
            <div className="max-h-[70vh] overflow-y-auto">
              <p className="border-b border-border px-4 py-3 text-section uppercase tracking-wider text-textmuted">
                Notifications
              </p>
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-body text-textmuted">Nothing new yet.</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick(item)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-primary-6 ${
                      item.read ? '' : 'bg-primary-6/40'
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.read ? 'bg-transparent' : 'bg-accent'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-body ${
                          item.read ? 'font-medium text-textmuted' : 'font-bold text-textprimary'
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="mt-0.5 block truncate text-caption text-textmuted">{item.body}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-caption text-neutral">{timeLabel(item.createdAt)}</span>
                  </button>
                ))
              )}
              <Link
                to="/notifications"
                onClick={close}
                className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-button text-primary transition-colors duration-200 hover:bg-primary-6"
              >
                <span className="min-w-0 truncate">View all</span>
                <ArrowRight2 size={16} />
              </Link>
            </div>
          </DropdownPanel>
        </div>
      )}
    </div>
  );
}
