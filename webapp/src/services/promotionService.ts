import { type Table } from 'dexie';
import { db } from '../db/db';
import { id } from '../lib/ids';

async function readDoc(
  table: Table<Record<string, unknown>, string>,
  key: string,
): Promise<Record<string, unknown> | null> {
  const row = await table.get(key);
  return row ? { ...row } : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PromotionService {
  async boostEvent(eventId: string, tierDays: number): Promise<void> {
    // SIMULATED: boost payment — replace with a real gateway charge before launch.
    await sleep(2000);

    const event = await readDoc(db.events, eventId);
    if (event == null) return;

    const now = new Date();
    const until = new Date(now.getTime() + tierDays * 24 * 60 * 60 * 1000);

    await db.events.put({
      ...event,
      id: eventId,
      featured: true,
      featuredUntil: until.toISOString(),
    });

    const promotionId = id('pro');
    await db.promotions.put({
      id: promotionId,
      eventId,
      ownerId: (event['ownerId'] as string) ?? '',
      tierDays,
      amount: this._priceForTier(tierDays),
      // SIMULATED: promotion payment status — replace with a real webhook confirmation.
      status: 'success',
      startsAt: now.toISOString(),
      endsAt: until.toISOString(),
      createdAt: now.toISOString(),
    });
  }

  private _priceForTier(days: number): number {
    if (days <= 3) return 25.0;
    if (days <= 7) return 50.0;
    return 90.0;
  }

  priceForTier(days: number): number {
    return this._priceForTier(days);
  }
}
