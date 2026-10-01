import { getSessionUid, db } from '../db/db';
import { id } from '../lib/ids';
import { Notification } from '../models';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_DELAY_MS = 5000;

const pendingReminders = new Map<number, ReturnType<typeof setTimeout>>();
let initialised = false;

const reminderId = (bookingId: string): number => {
  let hash = 0;
  for (let i = 0; i < bookingId.length; i++) {
    hash = (hash * 31 + bookingId.charCodeAt(i)) | 0;
  }
  return hash & 0x7fffffff;
};

const writeReminder = async (
  userId: string,
  eventTitle: string,
  body: string,
): Promise<void> => {
  const notificationId = id('ntf');
  const notification = new Notification({
    id: notificationId,
    userId,
    type: 'event_reminder',
    title: `Upcoming: ${eventTitle}`,
    body,
    createdAt: new Date(),
  });
  // SIMULATED
  await db.notifications.put({ ...notification.toMap(), id: notificationId });
};

export class ReminderService {
  async init(): Promise<void> {
    if (initialised) return;
    initialised = true;
  }

  async scheduleEventReminder(opts: {
    bookingId: string;
    eventTitle: string;
    eventDate: Date;
    userId?: string | null;
  }): Promise<void> {
    const { bookingId, eventTitle, eventDate } = opts;
    const userId = opts.userId ?? null;

    if (userId !== null) {
      const user = await db.users.get(userId);
      if (user && user.remindersEnabled === false) return;
    }

    await this.init();

    const target = reminderId(bookingId);
    const existing = pendingReminders.get(target);
    if (existing !== undefined) {
      clearTimeout(existing);
      pendingReminders.delete(target);
    }

    const scheduledTime = new Date(eventDate.getTime() - DAY_MS);
    const now = Date.now();
    const uid = userId ?? (await getSessionUid()) ?? '';

    if (scheduledTime.getTime() > now) {
      // SIMULATED
      const timer = setTimeout(() => {
        pendingReminders.delete(target);
        void writeReminder(uid, eventTitle, 'Your event starts in 24 hours.');
      }, scheduledTime.getTime() - now);
      pendingReminders.set(target, timer);
    } else {
      // SIMULATED
      const timer = setTimeout(() => {
        pendingReminders.delete(target);
        void writeReminder(uid, eventTitle, 'Your event is starting soon!');
      }, SOON_DELAY_MS);
      pendingReminders.set(target, timer);
    }
  }

  async cancelReminder(bookingId: string): Promise<void> {
    await this.init();
    const target = reminderId(bookingId);
    const timer = pendingReminders.get(target);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingReminders.delete(target);
    }
  }
}

export const reminderService = new ReminderService();
