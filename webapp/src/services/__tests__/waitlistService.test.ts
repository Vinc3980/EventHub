import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { WaitlistEntry } from '../../models';
import { putEvent } from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { WaitlistService } from '../waitlistService';

const EVENT_ID = 'evt-wait';

function entry(userId: string, ticketType: string, joinedAt: Date): WaitlistEntry {
  return new WaitlistEntry({
    id: '',
    eventId: EVENT_ID,
    userId,
    ticketType,
    position: 1,
    createdAt: joinedAt,
  });
}

describe('WaitlistService', () => {
  const service = new WaitlistService();
  const t0 = new Date('2026-10-01T09:00:00.000Z');

  beforeEach(async () => {
    await resetDatabase();
    await putEvent({ id: EVENT_ID, title: 'Waitlisted Fest' });
  });

  it('assigns increasing positions in join order', async () => {
    expect(await service.joinWaitlist(entry('u1', 'Regular', t0))).toBe(1);
    expect(await service.joinWaitlist(entry('u2', 'Regular', new Date(t0.getTime() + 60_000)))).toBe(2);
    expect(await service.joinWaitlist(entry('u3', 'Regular', new Date(t0.getTime() + 120_000)))).toBe(3);

    const rows = await db.waitlist.toArray();
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === 'waiting')).toBe(true);
    expect(rows.map((row) => row.position).sort()).toEqual([1, 2, 3]);
    expect(rows.every((row) => row.tierName === 'Regular')).toBe(true);
  });

  it('keeps a separate queue per tier', async () => {
    await service.joinWaitlist(entry('u1', 'Regular', t0));
    await service.joinWaitlist(entry('u2', 'Regular', new Date(t0.getTime() + 60_000)));

    expect(await service.joinWaitlist(entry('u3', 'VIP', t0))).toBe(1);
    expect(await service.joinWaitlist(entry('u4', 'VIP', new Date(t0.getTime() + 30_000)))).toBe(2);
  });

  it('does not count non-waiting entries towards the position', async () => {
    await service.joinWaitlist(entry('u1', 'Regular', t0));
    await service.joinWaitlist(entry('u2', 'Regular', new Date(t0.getTime() + 60_000)));

    const rows = await db.waitlist.toArray();
    const first = rows.find((row) => row.userId === 'u1') ?? {};
    await db.waitlist.put({ ...first, id: String(first.id ?? ''), status: 'notified' });

    expect(await service.joinWaitlist(entry('u3', 'Regular', new Date(t0.getTime() + 120_000)))).toBe(2);
  });

  it('notifyNextInLine marks the earliest waiting entry notified and writes a notification', async () => {
    await service.joinWaitlist(entry('u-first', 'Regular', t0));
    await service.joinWaitlist(entry('u-second', 'Regular', new Date(t0.getTime() + 60_000)));
    await service.joinWaitlist(entry('u-third', 'Regular', new Date(t0.getTime() + 120_000)));

    await service.notifyNextInLine(EVENT_ID, 'Regular');

    // Deviation note: the persisted status is 'notified', which is not part of
    // the WaitlistStatus union in src/models/ops.ts.
    const rows = await db.waitlist.toArray();
    const byUser = new Map(rows.map((row) => [row.userId as string, row.status as string]));
    expect(byUser.get('u-first')).toBe('notified');
    expect(byUser.get('u-second')).toBe('waiting');
    expect(byUser.get('u-third')).toBe('waiting');

    const notifications = await db.notifications.toArray();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe('u-first');
    expect(notifications[0].title).toBe('Spot available!');
    expect(notifications[0].type).toBe('waitlist_spot_available');
    expect(notifications[0].targetId).toBe(EVENT_ID);
    expect(notifications[0].read).toBe(false);
    expect(String(notifications[0].body)).toContain('Regular');
    expect(String(notifications[0].body)).toContain('Waitlisted Fest');
  });

  it('notifyNextInLine walks the queue and stops when it is empty', async () => {
    await service.joinWaitlist(entry('u1', 'Regular', t0));
    await service.joinWaitlist(entry('u2', 'Regular', new Date(t0.getTime() + 60_000)));

    await service.notifyNextInLine(EVENT_ID, 'Regular');
    await service.notifyNextInLine(EVENT_ID, 'Regular');
    await service.notifyNextInLine(EVENT_ID, 'Regular');

    const rows = await db.waitlist.toArray();
    expect(rows.every((row) => row.status === 'notified')).toBe(true);
    expect(await db.notifications.count()).toBe(2);

    const notifiedUsers = (await db.notifications.toArray()).map((row) => row.userId);
    // Notifications are keyed rows, so assert the set of promoted users.
    expect([...notifiedUsers].sort()).toEqual(['u1', 'u2']);
  });

  it('notifyNextInLine ignores other tiers and writes no notification for an empty queue', async () => {
    await service.joinWaitlist(entry('u-vip', 'VIP', t0));

    await service.notifyNextInLine(EVENT_ID, 'Regular');

    expect((await db.waitlist.toArray())[0].status).toBe('waiting');
    expect(await db.notifications.count()).toBe(0);
  });

  it('falls back to a generic event title when the event row is missing', async () => {
    await db.events.clear();
    await service.joinWaitlist(entry('u1', 'Regular', t0));

    await service.notifyNextInLine(EVENT_ID, 'Regular');

    const notification = (await db.notifications.toArray())[0];
    expect(String(notification.body)).toContain('the event');
  });
});
