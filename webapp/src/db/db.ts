import Dexie, { type Table } from 'dexie';
import { Event } from '../models';

/**
 * Local-first data layer. Table names are IDENTICAL to the mobile Hive boxes
 * and to the names mandated by section 2 of the spec — a row here must be
 * transposable 1:1 to a mobile box record (rows are plain objects; models
 * hydrate them).
 */
export class EventHubDatabase extends Dexie {
  session!: Table<{ key: string; value: unknown }, string>;
  auth!: Table<{ uid: string; email: string; passwordHash: string }, string>;
  users!: Table<Record<string, unknown>, string>;
  events!: Table<Record<string, unknown>, string>;
  guestList!: Table<Record<string, unknown>, string>;
  registrations!: Table<Record<string, unknown>, string>;
  bookings!: Table<Record<string, unknown>, string>;
  payments!: Table<Record<string, unknown>, string>;
  refunds!: Table<Record<string, unknown>, string>;
  posts!: Table<Record<string, unknown>, string>;
  chats!: Table<Record<string, unknown>, string>;
  messages!: Table<Record<string, unknown>, string>;
  reviews!: Table<Record<string, unknown>, string>;
  reports!: Table<Record<string, unknown>, string>;
  notifications!: Table<Record<string, unknown>, string>;
  invitedGuests!: Table<Record<string, unknown>, string>;
  promotions!: Table<Record<string, unknown>, string>;
  payoutAccounts!: Table<Record<string, unknown>, string>;
  discountCodes!: Table<Record<string, unknown>, string>;
  waitlist!: Table<Record<string, unknown>, string>;
  follows!: Table<Record<string, unknown>, string>;
  eventSchedules!: Table<Record<string, unknown>, string>;

  constructor() {
    super('eventhub');
    this.version(1).stores({
      session: '&key',
      auth: '&uid',
      users: '&uid, name, createdAt',
      events: '&id, ownerId, status, date, category',
      guestList: '&id, eventId, regId, fullName',
      registrations: '&id, eventId, userId',
      bookings: '&id, regId, eventId, userId, status',
      payments: '&id, bookingId, status',
      refunds: '&id, bookingId, paymentId, status',
      posts: '&id, authorId, timestamp',
      chats: '&id, eventId, organizerId, lastMessageAt',
      messages: '&id, chatId, timestamp, senderId',
      reviews: '&id, eventId, userId',
      reports: '&id, targetType, status, createdAt',
      notifications: '&id, userId, createdAt, read',
      invitedGuests: '&id, eventId',
      promotions: '&id, eventId, ownerId',
      payoutAccounts: '&id, ownerId',
      discountCodes: '&id, eventId, code',
      waitlist: '&id, eventId, userId',
      follows: '&id, followerId, followingId',
      eventSchedules: '&id, eventId, dayNumber, order',
    });
  }
}

export const db = new EventHubDatabase();

// ---------------------------------------------------------------------------
// Session / seed bookkeeping (same semantics as mobile LocalStore)
// ---------------------------------------------------------------------------
export const SESSION = {
  uid: 'uid',
  seedVersion: 'seedVersion',
} as const;

export async function getSessionUid(): Promise<string | null> {
  const row = await db.session.get(SESSION.uid);
  return (row?.value as string) ?? null;
}

export async function setSessionUid(uid: string | null): Promise<void> {
  if (uid == null) {
    await db.session.delete(SESSION.uid);
    return;
  }
  await db.session.put({ key: SESSION.uid, value: uid });
}

export async function getSeedVersion(): Promise<string | null> {
  const row = await db.session.get(SESSION.seedVersion);
  return (row?.value as string) ?? null;
}

export async function setSeedVersion(v: string): Promise<void> {
  await db.session.put({ key: SESSION.seedVersion, value: v });
}

// ---------------------------------------------------------------------------
// Typed helpers — hydrate Dexie rows back into model classes
// ---------------------------------------------------------------------------
export async function hydrateEvent(id: string): Promise<Event | null> {
  const row = await db.events.get(id);
  return row ? Event.fromMap(id, row) : null;
}
