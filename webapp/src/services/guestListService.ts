import { liveQuery, type Observable } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { GuestListEntry, Registration } from '../models';

const rowId = (row: Record<string, unknown>): string => String(row.id ?? '');

export class GuestListService {
  async addContact(entry: GuestListEntry): Promise<void> {
    const entryId = id('gl');
    await db.guestList.put({ ...entry.toMap(), id: entryId });
  }

  async addContactsBulk(eventId: string, registrations: Registration[]): Promise<void> {
    for (const registration of registrations) {
      const entry = new GuestListEntry({
        id: '',
        regId: registration.id,
        eventId: registration.eventId === '' ? eventId : registration.eventId,
        fullName: registration.fullName,
        createdAt: new Date(),
      });
      entry.invitedGuestCount = registration.invitedGuestCount;
      entry.phone = registration.phone;
      entry.organization = registration.organization;
      const entryId = id('gl');
      await db.guestList.put({ ...entry.toMap(), eventId, id: entryId });
    }
  }

  async removeContact(entryId: string): Promise<void> {
    await db.guestList.delete(entryId);
  }

  guestListForEvent(eventId: string): Observable<GuestListEntry[]> {
    return liveQuery(async () => {
      const rows = await db.guestList.toArray();
      return rows
        .filter((row) => row.eventId === eventId)
        .map((row) => GuestListEntry.fromMap(rowId(row), row));
    });
  }
}

export const guestListService = new GuestListService();
