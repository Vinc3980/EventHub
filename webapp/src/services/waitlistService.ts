import { liveQuery, type Observable, type Table } from 'dexie';
import { db } from '../db/db';
import { id, nowIso } from '../lib/ids';
import { WaitlistEntry } from '../models';

async function readDoc(
  table: Table<Record<string, unknown>, string>,
  key: string,
): Promise<Record<string, unknown> | null> {
  const row = await table.get(key);
  return row ? { ...row } : null;
}

function tierOf(row: Record<string, unknown>): string {
  const value = row.tierName ?? row.ticketType;
  return typeof value === 'string' ? value : '';
}

function joinedAtOf(row: Record<string, unknown>): string {
  const value = row.joinedAt ?? row.createdAt;
  return typeof value === 'string' ? value : '';
}

export class WaitlistService {
  async joinWaitlist(entry: WaitlistEntry): Promise<number> {
    const entryId = id('wlt');
    const joinedAt = entry.createdAt.toISOString();

    let position = 1;
    const rows = await db.waitlist.toArray();
    for (const row of rows) {
      if (row.eventId != entry.eventId) continue;
      if (tierOf(row) != entry.ticketType) continue;
      if (row.status != 'waiting') continue;
      if (joinedAtOf(row) < joinedAt) {
        position++;
      }
    }

    await db.waitlist.put({
      ...entry.toMap(),
      id: entryId,
      position,
      tierName: entry.ticketType,
      joinedAt,
    });
    return position;
  }

  waitlistForEvent(eventId: string, tierName: string): Observable<WaitlistEntry[]> {
    return liveQuery(async () => {
      const rows = await db.waitlist.toArray();
      const items = rows.filter(
        (entry) => entry['eventId'] == eventId && tierOf(entry) == tierName,
      );
      items.sort((a, b) => {
        const ja = joinedAtOf(a);
        const jb = joinedAtOf(b);
        if (ja < jb) return -1;
        if (ja > jb) return 1;
        return 0;
      });
      return items.map((entry) => WaitlistEntry.fromMap((entry.id as string) ?? '', entry));
    });
  }

  async notifyNextInLine(eventId: string, tierName: string): Promise<void> {
    const rows = await db.waitlist.toArray();
    rows.sort((a, b) => {
      const ja = joinedAtOf(a);
      const jb = joinedAtOf(b);
      if (ja < jb) return -1;
      if (ja > jb) return 1;
      return 0;
    });

    for (const row of rows) {
      if (row.eventId != eventId) continue;
      if (tierOf(row) != tierName) continue;
      if (row.status != 'waiting') continue;

      await db.waitlist.put({ ...row, id: (row.id as string) ?? '', status: 'notified' });

      const userId = (row.userId as string) ?? '';
      if (userId.length > 0) {
        const event = await readDoc(db.events, eventId);
        const eventTitle = (event?.title as string) ?? 'the event';

        // SIMULATED: waitlist push notification — persisted to the local notifications table.
        await db.notifications.put({
          id: id('ntf'),
          uid: userId,
          userId,
          title: 'Spot available!',
          body: `A spot just opened up for ${tierName} at ${eventTitle}. Register now before it fills up again.`,
          type: 'waitlist_spot_available',
          targetId: eventId,
          referenceId: eventId,
          read: false,
          createdAt: nowIso(),
        });
      }

      return;
    }
  }
}
