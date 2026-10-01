import { liveQuery, type Observable } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { EventScheduleItem } from '../models';

const rowId = (row: Record<string, unknown>): string => String(row.id ?? '');

export class EventScheduleService {
  async addScheduleItem(item: EventScheduleItem): Promise<void> {
    const itemId = id('sch');
    await db.eventSchedules.put({ ...item.toMap(), id: itemId });
  }

  scheduleForEvent(eventId: string): Observable<EventScheduleItem[]> {
    return liveQuery(async () => {
      const rows = await db.eventSchedules.toArray();
      const items = rows
        .filter((row) => row.eventId === eventId)
        .map((row) => EventScheduleItem.fromMap(rowId(row), row));
      items.sort((a, b) =>
        a.dayNumber === b.dayNumber ? a.order - b.order : a.dayNumber - b.dayNumber,
      );
      return items;
    });
  }

  async updateScheduleItem(itemId: string, item: EventScheduleItem): Promise<void> {
    await db.eventSchedules.put({ ...item.toMap(), id: itemId });
  }

  async deleteScheduleItem(itemId: string): Promise<void> {
    await db.eventSchedules.delete(itemId);
  }
}

export const eventScheduleService = new EventScheduleService();
