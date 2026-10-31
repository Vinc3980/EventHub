/**
 * Live counters for the hub tiles. Each hook mirrors the exact query the
 * destination screen runs, so a tile's number can never disagree with the
 * list it opens.
 */
import { useMemo } from 'react';
import { useAuth } from '../app/AuthProvider';
import { useSocialStream, useOwnedEvents, useBookings } from './SocialData';
import { useLive } from '../db/live';
import { db } from '../db/db';
import { followService } from '../services/followService';
import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import { EventService } from '../services/eventService';
import { Event, type Booking } from '../models';

const eventService = new EventService();

/** Mirrors `bucketOf` in BookingsScreen so the counts always agree. */
type BookingBucket = 'upcoming' | 'past' | 'cancelled';

function bucketOf(booking: Booking, event: Event | null | undefined): BookingBucket {
  if (booking.status === 'cancelled' || booking.status === 'payment_failed') return 'cancelled';
  const finished = event
    ? event.status === 'completed' || event.date.getTime() < Date.now()
    : false;
  if (booking.status === 'confirmed' && finished) return 'past';
  return 'upcoming';
}

export interface HostCounts {
  total: number | null;
  drafts: number | null;
  live: number | null;
}

export function useHostCounts(): HostCounts {
  const { uid } = useAuth();
  const { data } = useOwnedEvents(uid);
  return useMemo(() => {
    if (!uid || data === undefined) return { total: null, drafts: null, live: null };
    const drafts = data.filter((event) => event.status === 'draft').length;
    const live = data.filter(
      (event) => event.status === 'published' || event.status === 'pending_review',
    ).length;
    return { total: data.length, drafts, live };
  }, [uid, data]);
}

export interface TicketCounts {
  upcoming: number | null;
  past: number | null;
  pending: number | null;
  cancelled: number | null;
}

export function useTicketCounts(): TicketCounts {
  const { uid } = useAuth();
  const { data: bookings } = useBookings(uid);
  const eventIds = useMemo(
    () => Array.from(new Set((bookings ?? []).map((booking) => booking.eventId))),
    [bookings],
  );
  const key = eventIds.join(',');
  const { data: eventsById } = useLive<Record<string, Event | null>>(async () => {
    const map: Record<string, Event | null> = {};
    for (const id of key.split(',').filter((part) => part.length > 0)) {
      map[id] = await eventService.getEvent(id);
    }
    return map;
  }, [key]);

  return useMemo(() => {
    if (!uid || bookings === undefined) {
      return { upcoming: null, past: null, pending: null, cancelled: null };
    }
    const out: Record<BookingBucket, number> = { upcoming: 0, past: 0, cancelled: 0 };
    let pending = 0;
    for (const booking of bookings) {
      if (booking.status === 'pending') pending++;
      out[bucketOf(booking, eventsById?.[booking.eventId])]++;
    }
    return {
      upcoming: out.upcoming,
      past: out.past,
      pending,
      cancelled: out.cancelled,
    };
  }, [uid, bookings, eventsById]);
}

export function useSavedCount(): number | null {
  const { user } = useAuth();
  return user ? (user.savedEventIds ?? []).length : null;
}

export interface CommunityCounts {
  followers: number | null;
  following: number | null;
  chats: number | null;
  notifications: number | null;
}

export function useCommunityCounts(): CommunityCounts {
  const { uid } = useAuth();
  const followers = useSocialStream(uid ? followService.followerIds(uid) : null);
  const following = useSocialStream(uid ? followService.followingIds(uid) : null);
  const chats = useSocialStream(uid ? chatService.chatsForUser(uid) : null);
  const notifications = useSocialStream(
    uid ? notificationService.unreadCountStream(uid) : null,
  );

  return {
    followers: uid && followers.data ? followers.data.length : null,
    following: uid && following.data ? following.data.length : null,
    chats: uid && chats.data ? chats.data.length : null,
    notifications: uid && notifications.data != null ? notifications.data : null,
  };
}

export function useAdminCounts(): { pending: number | null; users: number | null; reports: number | null } {
  const pending = useLive<number>(async () => {
    const rows = await db.events.toArray();
    return rows.filter((row) => row.status === 'pending_review').length;
  }, []);
  const users = useLive<number>(async () => db.users.count(), []);
  const reports = useLive<number>(async () => {
    const rows = await db.reports.toArray();
    return rows.filter((row) => row.status === 'open').length;
  }, []);

  return {
    pending: pending.data ?? null,
    users: users.data ?? null,
    reports: reports.data ?? null,
  };
}
