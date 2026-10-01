import { liveQuery, type Observable, type Table } from 'dexie';
import { db } from '../db/db';
import { id, nowIso } from '../lib/ids';
import { Booking, Payment, Refund } from '../models';
import { RegistrationService } from './registrationService';

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

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export class RefundService {
  async requestRefund(booking: Booking, payment: Payment): Promise<string> {
    const refundId = id('ref');
    const refund = new Refund({
      id: refundId,
      bookingId: booking.id,
      paymentId: payment.id,
      amount: payment.amount,
      status: 'requested',
      requestedAt: nowIso(),
    });
    await db.refunds.put({ ...refund.toMap(), id: refundId });
    return refundId;
  }

  async approveRefund(refundId: string): Promise<void> {
    const data = await readDoc(db.refunds, refundId);
    if (data == null) return;

    // SIMULATED: payment gateway refund processing delay (2-4 seconds), local only.
    await sleep(2000 + (Math.abs(hashString(refundId)) % 3) * 1000);

    await db.refunds.put({
      ...data,
      id: refundId,
      status: 'completed',
      resolvedAt: nowIso(),
    });

    const paymentId = data['paymentId'] as string | null;
    if (paymentId != null) {
      const paymentData = await readDoc(db.payments, paymentId);
      if (paymentData != null) {
        await db.payments.put({
          ...paymentData,
          id: paymentId,
          status: 'refunded',
        });
      }
    }

    const bookingId = data['bookingId'] as string | null;
    if (bookingId != null) {
      const regService = new RegistrationService();
      await regService.cancelBooking(bookingId, { byOrganizer: true });
      await this._removeGuestListEntries(bookingId);
    }
  }

  private async _removeGuestListEntries(bookingId: string): Promise<void> {
    const booking = await readDoc(db.bookings, bookingId);
    const regId = booking?.['regId'] as string | null;
    if (regId == null) return;
    const rows = await db.guestList.toArray();
    for (const row of rows) {
      if (row['regId'] === regId) {
        await db.guestList.delete((row.id as string) ?? '');
      }
    }
  }

  async denyRefund(refundId: string, reason: string): Promise<void> {
    const data = await readDoc(db.refunds, refundId);
    if (data == null) return;
    await db.refunds.put({
      ...data,
      id: refundId,
      status: 'denied',
      denialReason: reason,
      resolvedAt: nowIso(),
    });
  }

  refundsForEvent(eventId: string): Observable<Refund[]> {
    return liveQuery(async () => {
      const rows = await db.refunds.toArray();
      const items: Record<string, unknown>[] = [];
      for (const entry of rows) {
        const bookingId = entry['bookingId'] as string | null;
        if (bookingId == null) continue;
        const booking = await readDoc(db.bookings, bookingId);
        if (booking?.['eventId'] === eventId) items.push(entry);
      }
      items.sort((a, b) => {
        const da = (a['requestedAt'] as string) ?? '';
        const dbv = (b['requestedAt'] as string) ?? '';
        if (dbv > da) return -1;
        if (dbv < da) return 1;
        return 0;
      });
      return items.map((entry) => Refund.fromMap((entry.id as string) ?? '', entry));
    });
  }

  refundsForOrganizer(organizerId: string): Observable<Refund[]> {
    return liveQuery(async () => {
      const rows = await db.refunds.toArray();
      const items: Record<string, unknown>[] = [];
      for (const entry of rows) {
        const bookingId = entry['bookingId'] as string | null;
        if (bookingId == null) continue;
        const booking = await readDoc(db.bookings, bookingId);
        if (booking == null) continue;
        const eventId = booking['eventId'] as string | null;
        if (eventId == null) continue;
        const event = await readDoc(db.events, eventId);
        if (event?.['ownerId'] === organizerId) items.push(entry);
      }
      items.sort((a, b) => {
        const da = (a['requestedAt'] as string) ?? '';
        const dbv = (b['requestedAt'] as string) ?? '';
        if (dbv > da) return -1;
        if (dbv < da) return 1;
        return 0;
      });
      return items.map((entry) => Refund.fromMap((entry.id as string) ?? '', entry));
    });
  }

  async paymentForBooking(bookingId: string): Promise<Payment | null> {
    const rows = await db.payments.toArray();
    for (const entry of rows) {
      if (entry['bookingId'] === bookingId) {
        return Payment.fromMap((entry.id as string) ?? '', entry);
      }
    }
    return null;
  }
}
