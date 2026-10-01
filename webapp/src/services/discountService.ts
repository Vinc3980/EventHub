import { liveQuery, type Observable } from 'dexie';
import { db } from '../db/db';
import { id } from '../lib/ids';
import { DiscountCode, parseDate } from '../models';

export class InvalidCodeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCodeException';
  }

  toString(): string {
    return this.message;
  }
}

export class DiscountService {
  codesForEvent(eventId: string): Observable<DiscountCode[]> {
    return liveQuery(async () => {
      const rows = await db.discountCodes.toArray();
      const items = rows.filter((entry) => entry['eventId'] === eventId);
      items.sort((a, b) => {
        const ca = ((a['code'] as string) ?? '').toLowerCase();
        const cb = ((b['code'] as string) ?? '').toLowerCase();
        if (ca < cb) return -1;
        if (ca > cb) return 1;
        return 0;
      });
      return items.map((entry) =>
        DiscountCode.fromMap((entry.id as string) ?? '', entry),
      );
    });
  }

  async createCode(code: DiscountCode): Promise<string> {
    const codeId = id('dsc');
    await db.discountCodes.put({
      ...code.toMap(),
      id: codeId,
    });
    return codeId;
  }

  async validateCode(eventId: string, code: string): Promise<DiscountCode> {
    const normalized = code.trim().toLowerCase();
    const rows = await db.discountCodes.toArray();
    for (const row of rows) {
      if (row['eventId'] != eventId) continue;
      if (((row['code'] as string) ?? '').toLowerCase() != normalized) continue;

      const discount = DiscountCode.fromMap((row.id as string) ?? '', row);

      if (!discount.active) {
        throw new InvalidCodeException('This discount code is no longer active.');
      }

      if (discount.expiresAt != null) {
        const expiry = parseDate(discount.expiresAt);
        if (expiry != null && expiry.getTime() < Date.now()) {
          throw new InvalidCodeException('This discount code has expired.');
        }
      }

      const maxUses = Number(row['capacity'] ?? 0) || Number(row['maxUses'] ?? 0);
      const usedCount = Number(row['used'] ?? 0) || Number(row['usedCount'] ?? 0);
      if (maxUses > 0 && usedCount >= maxUses) {
        throw new InvalidCodeException('This discount code has been fully redeemed.');
      }

      return discount;
    }

    throw new InvalidCodeException('Invalid discount code.');
  }

  async redeemCode(codeId: string): Promise<void> {
    const row = await db.discountCodes.get(codeId);
    if (row == null) return;
    const current: Record<string, unknown> = { ...row };
    const used =
      (Number(current['used'] ?? 0) || Number(current['usedCount'] ?? 0)) + 1;
    current['used'] = used;
    if (current['usedCount'] !== undefined) current['usedCount'] = used;
    await db.discountCodes.put({ ...current, id: codeId });
  }
}
