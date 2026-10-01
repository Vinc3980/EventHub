import { liveQuery, type Observable, type Table } from 'dexie';
import { db } from '../db/db';
import { id, nowIso } from '../lib/ids';
import { Event, parseDate } from '../models';

async function readDoc(
  table: Table<Record<string, unknown>, string>,
  key: string,
): Promise<Record<string, unknown> | null> {
  const row = await table.get(key);
  return row ? { ...row } : null;
}

function dateMs(value: unknown): number {
  const parsed = parseDate(value);
  return parsed ? parsed.getTime() : 0;
}

function byDate(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const da = dateMs(a.date);
  const dbv = dateMs(b.date);
  if (da < dbv) return -1;
  if (da > dbv) return 1;
  return 0;
}

function byFeaturedThenDate(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const aFeatured = a.featured === true && dateMs(a.featuredUntil) > Date.now();
  const bFeatured = b.featured === true && dateMs(b.featuredUntil) > Date.now();
  if (aFeatured && !bFeatured) return -1;
  if (!aFeatured && bFeatured) return 1;
  return byDate(a, b);
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvRows(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export class EventService {
  async createEvent(event: Event): Promise<string> {
    const eventId = id('evt');
    await db.events.put({ ...event.toMap(), id: eventId, status: 'pending_review' });
    return eventId;
  }

  async saveDraft(event: Event): Promise<string> {
    if (event.id.length > 0 && (await readDoc(db.events, event.id)) != null) {
      await db.events.put({ ...event.toMap(), id: event.id, status: 'draft' });
      return event.id;
    }
    const eventId = id('evt');
    await db.events.put({ ...event.toMap(), id: eventId, status: 'draft' });
    return eventId;
  }

  async submitForReview(eventId: string): Promise<void> {
    const doc = await readDoc(db.events, eventId);
    if (doc == null) return;
    await db.events.put({ ...doc, id: eventId, status: 'pending_review' });
  }

  async approveEvent(eventId: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;
    await db.events.put({ ...event, id: eventId, status: 'published' });
  }

  async rejectEvent(eventId: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;
    await db.events.put({ ...event, id: eventId, status: 'rejected' });
  }

  async markCompleted(eventId: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;
    await db.events.put({ ...event, id: eventId, status: 'completed' });
  }

  async updateEvent(event: Event): Promise<void> {
    await db.events.put({ ...event.toMap(), id: event.id });
  }

  async duplicateEvent(eventId: string, newOwnerId: string): Promise<string> {
    const src = await readDoc(db.events, eventId);
    if (src == null) throw new Error('Event not found');
    const srcEvent = Event.fromMap(eventId, src);
    const copy = new Event({
      id: '',
      ownerId: newOwnerId,
      title: `${srcEvent.title} (Copy)`,
      category: srcEvent.category,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      venue: srcEvent.venue,
      lat: srcEvent.lat,
      lng: srcEvent.lng,
      description: srcEvent.description,
      ticketTypes: srcEvent.ticketTypes,
      status: 'pending_review',
      coverImageUrl: srcEvent.coverImageUrl,
      mediaUrls: srcEvent.mediaUrls,
      collaboratorIds: [],
    });
    return this.createEvent(copy);
  }

  async cancelEvent(eventId: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;
    await db.events.put({ ...event, id: eventId, status: 'cancelled' });
  }

  async endEvent(eventId: string, thankYouMessage: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;

    await db.events.put({
      ...event,
      id: eventId,
      status: 'completed',
      thankYouMessage,
    });

    const chats = await db.chats.toArray();
    for (const chat of chats) {
      if (chat.eventId === eventId) {
        await db.chats.put({ ...chat, readOnly: true });
        break;
      }
    }

    const bookings = await db.bookings.toArray();
    let smsCount = 0;
    for (const booking of bookings) {
      if (booking.eventId === eventId && booking.checkedIn === true) {
        const userId = booking.userId as string | null;
        if (userId == null) continue;
        const user = await readDoc(db.users, userId);
        const phone = (user?.phone as string) ?? '';
        const name = (user?.name as string) ?? 'Attendee';
        // SIMULATED: SMS thank-you delivery — recorded locally as a notification row.
        await db.notifications.put({
          id: id('ntf'),
          uid: userId,
          userId,
          title: 'Thank you!',
          body: thankYouMessage,
          type: 'sms_thank_you',
          targetId: eventId,
          referenceId: eventId,
          phone,
          name,
          read: false,
          createdAt: nowIso(),
        });
        smsCount++;
      }
    }
    const ownerId = (event.ownerId as string) ?? '';
    if (smsCount > 0 && ownerId.length > 0) {
      // SIMULATED: SMS delivery summary — recorded locally as a notification row.
      await db.notifications.put({
        id: id('ntf'),
        uid: ownerId,
        userId: ownerId,
        title: 'Thank-you messages sent',
        body: `Sent ${smsCount} thank-you messages for event ${eventId}.`,
        type: 'sms_thank_you',
        targetId: eventId,
        referenceId: eventId,
        read: false,
        createdAt: nowIso(),
      });
    }
  }

  async soldCountForTier(eventId: string, tierName: string): Promise<number> {
    let count = 0;
    const bookings = await db.bookings.toArray();
    for (const booking of bookings) {
      if (booking.eventId !== eventId) continue;
      if (booking.status !== 'confirmed') continue;

      const regId = booking.regId as string | null;
      if (regId == null) continue;
      const reg = await readDoc(db.registrations, regId);
      if (reg == null) continue;
      if ((reg.ticketType as string) != tierName) continue;

      count++;
    }
    return count;
  }

  async remainingCapacity(eventId: string, tierName: string): Promise<number> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return -1;
    const ticketTypes = (event.ticketTypes as Record<string, unknown>[]) ?? [];
    for (const ticket of ticketTypes) {
      if ((ticket.name as string) == tierName) {
        const capacity = Number(ticket.capacity ?? 0);
        return capacity - (await this.soldCountForTier(eventId, tierName));
      }
    }
    return -1;
  }

  async confirmedAttendeeCount(eventId: string): Promise<number> {
    let count = 0;
    const bookings = await db.bookings.toArray();
    for (const booking of bookings) {
      if (booking.eventId !== eventId) continue;
      if (booking.status !== 'confirmed') continue;
      count++;
    }
    return count;
  }

  async exportAttendeeListCsv(eventId: string): Promise<string> {
    const rows: string[][] = [
      [
        'Full name',
        'Ticket',
        'Phone',
        'Relationship',
        'Organization',
        'Dietary',
        'Gender',
        'Checked in',
        'Seat',
      ],
    ];

    const bookings = await db.bookings.toArray();
    for (const booking of bookings) {
      if (booking.eventId !== eventId) continue;

      const regId = booking.regId as string | null;
      const reg = regId != null ? await readDoc(db.registrations, regId) : null;

      rows.push([
        (reg?.fullName as string) ?? '',
        (reg?.ticketType as string) ?? '',
        (reg?.phone as string) ?? '',
        (reg?.attendeeType as string) ?? '',
        (reg?.organization as string) ?? '',
        (reg?.dietary as string) ?? '',
        (reg?.gender as string) ?? '',
        booking.checkedIn === true ? 'Yes' : 'No',
        (booking.seatNumber as string) ?? '',
      ]);
    }

    return csvRows(rows);
  }

  publishedEventsFeed(): Observable<Event[]> {
    return liveQuery(async () => {
      const rows = await db.events.toArray();
      const items = rows.filter((event) => event['status'] === 'published');
      items.sort(byFeaturedThenDate);
      return items.map((event) => Event.fromMap((event.id as string) ?? '', event));
    });
  }

  feedForYou(): Observable<Event[]> {
    return this.publishedEventsFeed();
  }

  feedFollowing(ownerIds: string[]): Observable<Event[]> {
    if (ownerIds.length === 0) {
      return liveQuery(async () => []);
    }
    const idSet = new Set(ownerIds);
    return liveQuery(async () => {
      const rows = await db.events.toArray();
      const items = rows.filter(
        (event) => event['status'] === 'published' && idSet.has(event['ownerId'] as string),
      );
      items.sort(byDate);
      return items.map((event) => Event.fromMap((event.id as string) ?? '', event));
    });
  }

  eventsByOwner(ownerId: string): Observable<Event[]> {
    return liveQuery(async () => {
      const rows = await db.events.toArray();
      const items = rows.filter(
        (event) =>
          event['ownerId'] === ownerId ||
          ((event['collaboratorIds'] as string[]) ?? []).includes(ownerId),
      );
      items.sort(byDate);
      return items.map((event) => Event.fromMap((event.id as string) ?? '', event));
    });
  }

  async addCollaborator(eventId: string, userId: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;
    const collabs = [...((event['collaboratorIds'] as string[]) ?? [])];
    if (collabs.includes(userId)) return;
    collabs.push(userId);
    await db.events.put({
      ...event,
      id: eventId,
      collaboratorIds: collabs,
    });
  }

  async removeCollaborator(eventId: string, userId: string): Promise<void> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return;
    const collabs = [...((event['collaboratorIds'] as string[]) ?? [])];
    const index = collabs.indexOf(userId);
    if (index >= 0) collabs.splice(index, 1);
    await db.events.put({
      ...event,
      id: eventId,
      collaboratorIds: collabs,
    });
  }

  pendingReviewEvents(): Observable<Event[]> {
    return liveQuery(async () => {
      const rows = await db.events.toArray();
      const items = rows.filter((event) => event['status'] === 'pending_review');
      items.sort(byDate);
      return items.map((event) => Event.fromMap((event.id as string) ?? '', event));
    });
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const map = await readDoc(db.events, eventId);
    if (map == null) return null;
    return Event.fromMap(eventId, map);
  }
}
