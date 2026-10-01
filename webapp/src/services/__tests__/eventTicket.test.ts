import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Event, EventTicket } from '../../models';

afterEach(() => {
  vi.useRealTimers();
});

const NOW = new Date(2026, 9, 5, 12, 0, 0);
const FUTURE = new Date(2026, 9, 10, 12, 0, 0);
const PAST = new Date(2026, 8, 30, 12, 0, 0);

function ticket(overrides: Partial<ConstructorParameters<typeof EventTicket>[0]>): EventTicket {
  return new EventTicket({ name: 'Regular', price: 100, capacity: 10, ...overrides });
}

function makeEvent(overrides: Partial<Event> & { id: string }): Event {
  return new Event({
    ownerId: 'org-1',
    title: 'Test Event',
    date: new Date(2026, 11, 1, 10, 0, 0),
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

describe('EventTicket.hasEarlyBird / effectivePrice', () => {
  it('applies the early-bird price while the window is open', () => {
    const t = ticket({
      price: 100,
      earlyBirdPrice: 80,
      earlyBirdUntil: FUTURE.toISOString(),
    });
    expect(t.hasEarlyBird).toBe(true);
    expect(t.effectivePrice).toBe(80);
  });

  it('ignores the early-bird price after earlyBirdUntil', () => {
    const t = ticket({
      price: 100,
      earlyBirdPrice: 80,
      earlyBirdUntil: PAST.toISOString(),
    });
    expect(t.hasEarlyBird).toBe(false);
    expect(t.effectivePrice).toBe(100);
  });

  it('ignores a non-positive early-bird price', () => {
    const t = ticket({
      price: 100,
      earlyBirdPrice: 0,
      earlyBirdUntil: FUTURE.toISOString(),
    });
    expect(t.hasEarlyBird).toBe(false);
    expect(t.effectivePrice).toBe(100);
  });

  it('ignores an early-bird price that is not cheaper than the standard price', () => {
    const equal = ticket({
      price: 100,
      earlyBirdPrice: 100,
      earlyBirdUntil: FUTURE.toISOString(),
    });
    const higher = ticket({
      price: 100,
      earlyBirdPrice: 150,
      earlyBirdUntil: FUTURE.toISOString(),
    });
    expect(equal.hasEarlyBird).toBe(false);
    expect(equal.effectivePrice).toBe(100);
    expect(higher.hasEarlyBird).toBe(false);
    expect(higher.effectivePrice).toBe(100);
  });

  it('is false when the window end date is missing or unparseable', () => {
    expect(ticket({ price: 100, earlyBirdPrice: 80 }).hasEarlyBird).toBe(false);
    expect(
      ticket({ price: 100, earlyBirdPrice: 80, earlyBirdUntil: 'not-a-date' }).hasEarlyBird,
    ).toBe(false);
    expect(
      ticket({ price: 100, earlyBirdPrice: 80, earlyBirdUntil: '' }).hasEarlyBird,
    ).toBe(false);
  });

  it('round-trips through toMap/fromMap', () => {
    const original = ticket({
      price: 100,
      earlyBirdPrice: 80,
      earlyBirdUntil: FUTURE.toISOString(),
    });
    const restored = EventTicket.fromMap(original.toMap());
    expect(restored.effectivePrice).toBe(80);
    expect(restored.capacity).toBe(10);
    expect(restored.name).toBe('Regular');
  });
});

describe('Event pricing getters', () => {
  it('isFree is true only when every ticket is free', () => {
    const free = makeEvent({
      id: 'evt-free',
      ticketTypes: [
        new EventTicket({ name: 'A', price: 0, capacity: 10 }),
        new EventTicket({ name: 'B', price: 0, capacity: 5 }),
      ],
    });
    const paid = makeEvent({
      id: 'evt-paid',
      ticketTypes: [
        new EventTicket({ name: 'A', price: 0, capacity: 10 }),
        new EventTicket({ name: 'B', price: 20, capacity: 5 }),
      ],
    });
    const empty = makeEvent({ id: 'evt-empty', ticketTypes: [] });

    expect(free.isFree).toBe(true);
    expect(paid.isFree).toBe(false);
    expect(empty.isFree).toBe(true);
  });

  it('cheapestPrice uses the effective (early-bird aware) price', () => {
    const event = makeEvent({
      id: 'evt-cheap',
      ticketTypes: [
        new EventTicket({ name: 'Regular', price: 50, capacity: 10 }),
        ticket({ name: 'VIP', price: 100, capacity: 10, earlyBirdPrice: 30, earlyBirdUntil: FUTURE.toISOString() }),
        new EventTicket({ name: 'Table', price: 80, capacity: 10 }),
      ],
    });
    expect(event.cheapestPrice).toBe(30);

    const noTickets = makeEvent({ id: 'evt-none', ticketTypes: [] });
    expect(noTickets.cheapestPrice).toBe(0);
  });

  it('cheapestPrice falls back to the standard price once the early-bird window closes', () => {
    const event = makeEvent({
      id: 'evt-lapsed',
      ticketTypes: [ticket({ price: 100, earlyBirdPrice: 30, earlyBirdUntil: PAST.toISOString() })],
    });
    expect(event.cheapestPrice).toBe(100);
  });
});

describe('Event.isCurrentlyFeatured', () => {
  it('is true only while featured and the boost window is open', () => {
    const active = makeEvent({
      id: 'evt-featured',
      featured: true,
      featuredUntil: FUTURE.toISOString(),
    });
    const expired = makeEvent({
      id: 'evt-expired',
      featured: true,
      featuredUntil: PAST.toISOString(),
    });
    const unfeatured = makeEvent({
      id: 'evt-plain',
      featured: false,
      featuredUntil: FUTURE.toISOString(),
    });
    const noWindow = makeEvent({ id: 'evt-nowindow', featured: true });

    expect(active.isCurrentlyFeatured).toBe(true);
    expect(expired.isCurrentlyFeatured).toBe(false);
    expect(unfeatured.isCurrentlyFeatured).toBe(false);
    expect(noWindow.isCurrentlyFeatured).toBe(false);
  });
});

describe('Event media helpers', () => {
  it('detects video covers case-insensitively', () => {
    expect(makeEvent({ id: 'v1', coverImageUrl: '/seed/clip.mp4' }).isVideoUrl).toBe(true);
    expect(makeEvent({ id: 'v2', coverImageUrl: '/seed/CLIP.MOV' }).isVideoUrl).toBe(true);
    expect(makeEvent({ id: 'v3', coverImageUrl: '/seed/clip.webm' }).isVideoUrl).toBe(true);
    expect(makeEvent({ id: 'v4', coverImageUrl: '/seed/poster.png' }).isVideoUrl).toBe(false);
    expect(makeEvent({ id: 'v5', coverImageUrl: '' }).isVideoUrl).toBe(false);
  });

  it('allMediaUrls de-duplicates and drops empties, cover first', () => {
    const event = makeEvent({
      id: 'media',
      coverImageUrl: '/seed/social.svg',
      mediaUrls: ['/seed/wedding.svg', '/seed/social.svg', '', '/seed/funeral.svg'],
    });
    expect(event.allMediaUrls).toEqual([
      '/seed/social.svg',
      '/seed/wedding.svg',
      '/seed/funeral.svg',
    ]);
  });

  it('allMediaUrls is empty when the event has no media', () => {
    expect(makeEvent({ id: 'no-media', coverImageUrl: '', mediaUrls: [] }).allMediaUrls).toEqual(
      [],
    );
  });
});
