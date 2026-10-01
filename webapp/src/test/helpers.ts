/**
 * Shared test helpers: a first-value collector for Dexie observables and small
 * factories that put well-formed rows into the (fake) IndexedDB.
 */
import type { Observable } from 'dexie';
import { db } from '../db/db';
import {
  Booking,
  Event,
  EventTicket,
  GuestListEntry,
  Payment,
  Registration,
  User,
  type EventCategory,
  type EventStatus,
} from '../models';

export const DAY_MS = 86_400_000;

/** Resolve with the first emission of a Dexie liveQuery/observable. */
export function firstValue<T>(source: Observable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // liveQuery always emits asynchronously, so `subscription` is assigned
    // before the first value can arrive.
    const subscription = source.subscribe({
      next: (value: T) => {
        subscription.unsubscribe();
        resolve(value);
      },
      error: (error: unknown) => reject(error),
    });
  });
}

export interface EventSeed {
  id: string;
  ownerId?: string;
  title?: string;
  category?: EventCategory;
  status?: EventStatus;
  date?: Date;
  ticketTypes?: EventTicket[];
  featured?: boolean;
  featuredUntil?: string;
  coverImageUrl?: string;
  mediaUrls?: string[];
}

export async function putEvent(seed: EventSeed): Promise<string> {
  const event = new Event({
    id: seed.id,
    ownerId: seed.ownerId ?? 'org-1',
    title: seed.title ?? 'Test Event',
    category: seed.category ?? 'social',
    date: seed.date ?? new Date(Date.now() + 60 * DAY_MS),
    status: seed.status ?? 'published',
    ticketTypes: seed.ticketTypes ?? [new EventTicket({ name: 'Regular', price: 0, capacity: 10 })],
    featured: seed.featured ?? false,
    featuredUntil: seed.featuredUntil,
    coverImageUrl: seed.coverImageUrl ?? '/seed/social.svg',
    mediaUrls: seed.mediaUrls ?? [],
  });
  await db.events.put({ ...event.toMap(), id: seed.id });
  return seed.id;
}

export async function putRegistration(seed: {
  id: string;
  eventId: string;
  userId: string;
  fullName?: string;
  ticketType?: string;
  invitedGuestCount?: number;
}): Promise<string> {
  const registration = new Registration({
    id: seed.id,
    eventId: seed.eventId,
    userId: seed.userId,
    fullName: seed.fullName ?? 'Test Attendee',
    ticketType: seed.ticketType ?? 'Regular',
    invitedGuestCount: seed.invitedGuestCount ?? 0,
  });
  await db.registrations.put({ ...registration.toMap(), id: seed.id });
  return seed.id;
}

export async function putBooking(seed: {
  id: string;
  regId: string;
  eventId: string;
  userId: string;
  status?: 'pending' | 'confirmed' | 'payment_failed' | 'cancelled';
  qrCode?: string;
  seatNumber?: string;
}): Promise<string> {
  const booking = new Booking({
    id: seed.id,
    regId: seed.regId,
    eventId: seed.eventId,
    userId: seed.userId,
    status: seed.status ?? 'confirmed',
    qrCode: seed.qrCode ?? `QR-${seed.id}`,
    seatNumber: seed.seatNumber ?? 'S-1',
    checkedIn: false,
  });
  await db.bookings.put({ ...booking.toMap(), id: seed.id });
  return seed.id;
}

export async function putPayment(seed: {
  id: string;
  bookingId: string;
  amount: number;
  status?: 'pending' | 'success' | 'failed' | 'refunded';
}): Promise<string> {
  const payment = new Payment({
    id: seed.id,
    bookingId: seed.bookingId,
    amount: seed.amount,
    status: seed.status ?? 'success',
    platformFee: 0,
    organizerPayout: 0,
  });
  await db.payments.put({ ...payment.toMap(), id: seed.id });
  return seed.id;
}

export async function putUser(seed: {
  uid: string;
  name?: string;
  roles?: string[];
  blockedUids?: string[];
}): Promise<string> {
  const user = new User({
    uid: seed.uid,
    name: seed.name ?? `User ${seed.uid}`,
    email: `${seed.uid}@example.test`,
    roles: (seed.roles ?? ['user']) as User['roles'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    blockedUids: seed.blockedUids ?? [],
  });
  await db.users.put({ ...user.toMap(), uid: seed.uid });
  return seed.uid;
}

export async function putGuestListEntry(seed: {
  id: string;
  regId: string;
  eventId: string;
  fullName?: string;
}): Promise<string> {
  const entry = new GuestListEntry({
    id: seed.id,
    regId: seed.regId,
    eventId: seed.eventId,
    fullName: seed.fullName ?? 'Guest Entry',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  await db.guestList.put({ ...entry.toMap(), id: seed.id });
  return seed.id;
}
