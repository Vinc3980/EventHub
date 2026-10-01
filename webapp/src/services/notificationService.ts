import { liveQuery, type Observable, type Observer } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { Notification, type NotificationType } from '../models';

type Row = Record<string, unknown>;
type ForegroundEvent = Record<string, string>;

const isString = (value: unknown): value is string => typeof value === 'string';

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];

const rowId = (row: Row): string => String(row.id ?? '');

export class NotificationService {
  private readonly foregroundListeners = new Set<(value: ForegroundEvent) => void>();

  get onForegroundNotification(): Observable<ForegroundEvent> {
    const listeners = this.foregroundListeners;
    const subscribe = (
      observerOrNext?: Partial<Observer<ForegroundEvent>> | ((value: ForegroundEvent) => void),
    ): { unsubscribe: () => void; closed: boolean } => {
      const next =
        typeof observerOrNext === 'function' ? observerOrNext : observerOrNext?.next;
      if (!next) return { unsubscribe: () => undefined, closed: true };
      listeners.add(next);
      return {
        unsubscribe: () => {
          listeners.delete(next);
        },
        closed: false,
      };
    };
    return { subscribe } as unknown as Observable<ForegroundEvent>;
  }

  async saveFcmToken(uid: string, token: string): Promise<void> {
    const profile = await db.users.get(uid);
    if (!profile) return;
    const tokens = asStringList(profile.fcmTokens);
    if (!tokens.includes(token)) {
      tokens.push(token);
      await db.users.put({ ...profile, uid, fcmTokens: tokens });
    }
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async saveLocal(params: {
    uid: string;
    title: string;
    body: string;
    type: string;
    targetId: string;
  }): Promise<void> {
    const notificationId = id('ntf');
    const notification = new Notification({
      id: notificationId,
      userId: params.uid,
      type: params.type as NotificationType,
      title: params.title,
      body: params.body,
      referenceId: params.targetId,
      createdAt: new Date(),
    });
    await db.notifications.put({ ...notification.toMap(), id: notificationId });
  }

  receiveForegroundNotification(params: {
    title: string;
    body: string;
    type: string;
    targetId: string;
  }): void {
    const event: ForegroundEvent = {
      title: params.title,
      body: params.body,
      type: params.type,
      targetId: params.targetId,
    };
    for (const listener of this.foregroundListeners) listener(event);
  }

  static routeForNotification(type: string, targetId: string): string {
    switch (type) {
      case 'new_follower':
        return `/profile/${targetId}`;
      case 'booking_confirmed':
        return `/booking/${targetId}`;
      case 'new_chat_message':
        return `/chat/${targetId}`;
      case 'event_reminder':
        return `/event/${targetId}`;
      default:
        return '/';
    }
  }

  notificationsForUser(uid: string): Observable<Notification[]> {
    return liveQuery(async () => {
      const rows = await db.notifications.toArray();
      const notifications = rows
        .filter((row) => row.userId === uid)
        .map((row) => Notification.fromMap(rowId(row), row));
      notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return notifications;
    });
  }

  async markRead(notificationId: string): Promise<void> {
    const row = await db.notifications.get(notificationId);
    if (!row) return;
    await db.notifications.put({ ...row, read: true });
  }

  async unreadCount(uid: string): Promise<number> {
    const rows = await db.notifications.toArray();
    return rows.filter((row) => row.userId === uid && row.read === false).length;
  }

  unreadCountStream(uid: string): Observable<number> {
    return liveQuery(async () => {
      const rows = await db.notifications.toArray();
      return rows.filter((row) => row.userId === uid && row.read === false).length;
    });
  }

  dispose(): void {
    this.foregroundListeners.clear();
  }
}

export const notificationService = new NotificationService();
