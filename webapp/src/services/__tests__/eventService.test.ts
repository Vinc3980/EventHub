import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Event, EventTicket } from '../../models';
import {
  DAY_MS,
  firstValue,
  putBooking,
  putEvent,
  putRegistration,
} from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { EventService } from '../eventService';

const BASE_TIME = new Date(2026, 5, 15, 12, 0, 0); // 15 June 2026

function at(offsetDays: number): Date {
  return new Date(BASE_TIME.getTime() + offsetDays * DAY_MS);
}

describe('EventService', () => {
  const service = new EventService();

  beforeEach(async () => {
    await resetDatabase();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishedEventsFeed only returns published events', async () => {
    await putEvent({ id: 'e-published', status: 'published', date: at(10) });
    await putEvent({ id: 'e-draft', status: 'draft', date: at(11) });
    await putEvent({ id: 'e-pending', status: 'pending_review', date: at(12) });
    await putEvent({ id: 'e-rejected', status: 'rejected', date: at(13) });
    await putEvent({ id: 'e-cancelled', status: 'cancelled', date: at(14) });
    await putEvent({ id: 'e-completed', status: 'completed', date: at(15) });

    const feed = await firstValue(service.publishedEventsFeed());
    expect(feed.map((event) => event.id)).toEqual(['e-published']);
  });

  it('orders featured events first, then by date, ignoring expired boosts', async () => {
    await putEvent({ id: 'e-later', date: at(300) });
    await putEvent({ id: 'e-sooner', date: at(100) });
    await putEvent({
      id: 'e-featured',
      date: at(200),
      featured: true,
      featuredUntil: at(60).toISOString(),
    });
    await putEvent({
      id: 'e-featured-expired',
      date: at(150),
      featured: true,
      featuredUntil: at(-5).toISOString(),
    });

    const feed = await firstValue(service.publishedEventsFeed());
    expect(feed.map((event) => event.id)).toEqual([
      'e-featured',
      'e-sooner',
      'e-featured-expired',
      'e-later',
    ]);
    expect(feed[0].isCurrentlyFeatured).toBe(true);
    expect(feed[2].isCurrentlyFeatured).toBe(false);
  });

  it('feedForYou mirrors the published feed', async () => {
    await putEvent({ id: 'e-a', date: at(50) });
    await putEvent({ id: 'e-b', date: at(40), status: 'draft' });

    const forYou = await firstValue(service.feedForYou());
    const published = await firstValue(service.publishedEventsFeed());
    expect(forYou.map((event) => event.id)).toEqual(['e-a']);
    expect(forYou.map((event) => event.id)).toEqual(published.map((event) => event.id));
  });

  it('feedFollowing only includes published events from the given owners', async () => {
    await putEvent({ id: 'e-a1', ownerId: 'org-a', date: at(20) });
    await putEvent({ id: 'e-a2', ownerId: 'org-a', date: at(10) });
    await putEvent({ id: 'e-a-draft', ownerId: 'org-a', status: 'draft', date: at(5) });
    await putEvent({ id: 'e-b1', ownerId: 'org-b', date: at(15) });

    const following = await firstValue(service.feedFollowing(['org-a']));
    expect(following.map((event) => event.id)).toEqual(['e-a2', 'e-a1']);

    const both = await firstValue(service.feedFollowing(['org-a', 'org-b']));
    expect(both.map((event) => event.id).sort()).toEqual(['e-a1', 'e-a2', 'e-b1']);

    expect(await firstValue(service.feedFollowing([]))).toEqual([]);
    expect(await firstValue(service.feedFollowing(['org-none']))).toEqual([]);
  });

  it('counts sold, remaining and confirmed attendees after a booking', async () => {
    await putEvent({
      id: 'evt-counts',
      ticketTypes: [
        new EventTicket({ name: 'Regular', price: 50, capacity: 5 }),
        new EventTicket({ name: 'VIP', price: 200, capacity: 2 }),
      ],
    });
    await putRegistration({ id: 'reg-1', eventId: 'evt-counts', userId: 'u1', ticketType: 'Regular' });
    await putRegistration({ id: 'reg-2', eventId: 'evt-counts', userId: 'u2', ticketType: 'Regular' });
    await putRegistration({ id: 'reg-3', eventId: 'evt-counts', userId: 'u3', ticketType: 'VIP' });
    await putBooking({ id: 'bkg-1', regId: 'reg-1', eventId: 'evt-counts', userId: 'u1', status: 'confirmed' });
    await putBooking({ id: 'bkg-2', regId: 'reg-2', eventId: 'evt-counts', userId: 'u2', status: 'pending' });
    await putBooking({ id: 'bkg-3', regId: 'reg-3', eventId: 'evt-counts', userId: 'u3', status: 'confirmed' });

    expect(await service.soldCountForTier('evt-counts', 'Regular')).toBe(1);
    expect(await service.soldCountForTier('evt-counts', 'VIP')).toBe(1);
    expect(await service.soldCountForTier('evt-counts', 'Table')).toBe(0);
    expect(await service.remainingCapacity('evt-counts', 'Regular')).toBe(4);
    expect(await service.remainingCapacity('evt-counts', 'VIP')).toBe(1);
    expect(await service.remainingCapacity('evt-counts', 'Table')).toBe(-1);
    expect(await service.remainingCapacity('evt-missing', 'Regular')).toBe(-1);
    expect(await service.confirmedAttendeeCount('evt-counts')).toBe(2);
    expect(await service.confirmedAttendeeCount('evt-missing')).toBe(0);
  });

  it('drives the draft → review → published/rejected lifecycle', async () => {
    const draftId = await service.saveDraft(
      new Event({
        id: '',
        ownerId: 'org-1',
        title: 'Lifecycle Event',
        date: at(30),
        ticketTypes: [new EventTicket({ name: 'Regular', price: 0, capacity: 10 })],
      }),
    );
    expect((await service.getEvent(draftId))?.status).toBe('draft');

    await service.submitForReview(draftId);
    expect((await service.getEvent(draftId))?.status).toBe('pending_review');

    await service.approveEvent(draftId);
    expect((await service.getEvent(draftId))?.status).toBe('published');
    expect((await firstValue(service.publishedEventsFeed())).map((event) => event.id)).toContain(
      draftId,
    );

    await service.rejectEvent(draftId);
    expect((await service.getEvent(draftId))?.status).toBe('rejected');
    expect((await firstValue(service.publishedEventsFeed())).map((event) => event.id)).not.toContain(
      draftId,
    );
  });

  it('createEvent always starts in review', async () => {
    const eventId = await service.createEvent(
      new Event({ id: '', ownerId: 'org-1', title: 'New', date: at(40) }),
    );
    expect((await service.getEvent(eventId))?.status).toBe('pending_review');
  });

  it('getEvent returns null for unknown ids', async () => {
    expect(await service.getEvent('evt-nope')).toBeNull();
  });
});
