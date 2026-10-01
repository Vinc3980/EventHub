import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { db, setSessionUid } from '../db/db';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

/**
 * Regression net for the two blank-page bugs: no screen may crash into the
 * error boundary, and no route may render an empty document.
 */
const ATTENDEE_ROUTES = [
  '/home',
  '/explore',
  '/chats',
  '/profile',
  '/bookings',
  '/saved',
  '/notifications',
  '/settings',
  '/settings/blocked',
  '/settings/payment-methods',
  '/landing',
];

const ORGANIZER_ROUTES = [
  '/organizer',
  '/organizer/events',
  '/organizer/payouts',
];

const ADMIN_ROUTES = [
  '/admin',
  '/admin/events',
  '/admin/users',
  '/admin/reports',
  '/admin/settings',
];

beforeEach(async () => {
  await resetDatabase();
});

async function visit(routes: string[]): Promise<void> {
  for (const route of routes) {
    window.history.pushState({}, '', route);
    const { unmount } = render(<App />);
    await waitFor(
      () => {
        expect(screen.queryByText('Reload page'), route).not.toBeInTheDocument();
        expect(document.body.textContent?.trim().length ?? 0, route).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
    unmount();
  }
}

type UserRow = { uid: string; email?: string; roles?: string[] };

async function seedSession(email: string): Promise<string> {
  await seedIfEmpty();
  const users = (await db.users.toArray()) as UserRow[];
  const row = users.find((u) => u.email === email);
  expect(row, email).toBeDefined();
  await setSessionUid(row!.uid);
  return row!.uid;
}

describe('every screen renders', () => {
  it('attendee routes', async () => {
    const uid = await seedSession('nana@eventhub.app');

    const events = await db.events.toArray();
    const eventId = events[0]?.id ?? 'none';
    const bookings = await db.bookings.toArray();
    const bookingId = bookings[0]?.id ?? 'none';
    await visit([
      ...ATTENDEE_ROUTES,
      `/event/${eventId}`,
      `/event/${eventId}/photos`,
      `/event/${eventId}/register`,
      `/event/${eventId}/rate`,
      `/booking/${bookingId}`,
      `/pay/${bookingId}`,
    ]);
    expect(uid).toBeTruthy();
  }, 60_000);

  it('organizer routes', async () => {
    const uid = await seedSession('kwame@eventhub.app');

    const owned = await db.events.toArray();
    const orgEvent = owned.find((e) => e.ownerId === uid) ?? owned[0];
    await visit([
      ...ORGANIZER_ROUTES,
      `/organizer/events/${orgEvent?.id ?? 'none'}`,
      `/organizer/events/${orgEvent?.id ?? 'none'}/guests`,
      `/organizer/events/${orgEvent?.id ?? 'none'}/analytics`,
      `/organizer/events/${orgEvent?.id ?? 'none'}/discounts`,
      `/organizer/events/${orgEvent?.id ?? 'none'}/refunds`,
      '/organizer/events/new',
    ]);
  }, 60_000);

  it('admin routes', async () => {
    await seedIfEmpty();
    const users = (await db.users.toArray()) as UserRow[];
    const admin = users.find((u) => (u.roles ?? []).includes('admin'));
    expect(admin).toBeDefined();
    await setSessionUid(admin!.uid);
    await visit(ADMIN_ROUTES);
  }, 60_000);
});
