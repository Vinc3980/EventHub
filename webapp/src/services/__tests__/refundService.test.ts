import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { Booking, Payment } from '../../models';
import {
  putBooking,
  putEvent,
  putGuestListEntry,
  putPayment,
  putRegistration,
} from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { RefundService } from '../refundService';

const EVENT_ID = 'evt-refund';
const REG_ID = 'reg-refund';
const BOOKING_ID = 'bkg-refund';
const PAYMENT_ID = 'pay-refund';
const AMOUNT = 80;

function bookingModel(): Booking {
  return new Booking({
    id: BOOKING_ID,
    regId: REG_ID,
    eventId: EVENT_ID,
    userId: 'u-refund',
    status: 'confirmed',
    qrCode: 'QR-REFUND',
  });
}

function paymentModel(): Payment {
  return new Payment({
    id: PAYMENT_ID,
    bookingId: BOOKING_ID,
    amount: AMOUNT,
    status: 'success',
    platformFee: 1.6,
    organizerPayout: 78.4,
  });
}

describe('RefundService', () => {
  const service = new RefundService();

  beforeEach(async () => {
    await resetDatabase();
    await putEvent({ id: EVENT_ID });
    await putRegistration({ id: REG_ID, eventId: EVENT_ID, userId: 'u-refund', fullName: 'Refund Guest' });
    await putBooking({
      id: BOOKING_ID,
      regId: REG_ID,
      eventId: EVENT_ID,
      userId: 'u-refund',
      status: 'confirmed',
    });
    await putPayment({ id: PAYMENT_ID, bookingId: BOOKING_ID, amount: AMOUNT, status: 'success' });
    await putGuestListEntry({ id: 'gl-refund', regId: REG_ID, eventId: EVENT_ID });
  });

  it('requestRefund creates a requested refund row', async () => {
    const refundId = await service.requestRefund(bookingModel(), paymentModel());
    expect(refundId).toMatch(/^ref-/);

    const row = await db.refunds.get(refundId);
    expect(row?.status).toBe('requested');
    expect(row?.amount).toBe(AMOUNT);
    expect(row?.bookingId).toBe(BOOKING_ID);
    expect(row?.paymentId).toBe(PAYMENT_ID);
    expect(typeof row?.requestedAt).toBe('string');
    expect(row?.resolvedAt).toBeFalsy();

    // Nothing else changes while the request is pending.
    expect((await db.payments.get(PAYMENT_ID))?.status).toBe('success');
    expect((await db.bookings.get(BOOKING_ID))?.status).toBe('confirmed');
  });

  it(
    'approveRefund flips the payment to refunded, cancels the booking and drops the guest-list row',
    async () => {
      const refundId = await service.requestRefund(bookingModel(), paymentModel());
      expect(await db.guestList.count()).toBe(1);

      await service.approveRefund(refundId);

      const refund = await db.refunds.get(refundId);
      expect(refund?.status).toBe('completed');
      expect(typeof refund?.resolvedAt).toBe('string');

      expect((await db.payments.get(PAYMENT_ID))?.status).toBe('refunded');

      expect((await db.bookings.get(BOOKING_ID))?.status).toBe('cancelled');

      expect(await db.guestList.count()).toBe(0);
      expect(await db.guestList.get('gl-refund')).toBeUndefined();
    },
    30_000,
  );

  it('denyRefund stores the reason and leaves payment, booking and guest list untouched', async () => {
    const refundId = await service.requestRefund(bookingModel(), paymentModel());

    await service.denyRefund(refundId, 'Tickets were already used.');

    const refund = await db.refunds.get(refundId);
    expect(refund?.status).toBe('denied');
    expect(refund?.denialReason).toBe('Tickets were already used.');
    expect(typeof refund?.resolvedAt).toBe('string');

    expect((await db.payments.get(PAYMENT_ID))?.status).toBe('success');
    expect((await db.bookings.get(BOOKING_ID))?.status).toBe('confirmed');
    expect(await db.guestList.count()).toBe(1);
  });

  it('approving an unknown refund is a no-op', async () => {
    await expect(service.approveRefund('ref-missing')).resolves.toBeUndefined();
    expect(await db.refunds.count()).toBe(0);
    expect((await db.payments.get(PAYMENT_ID))?.status).toBe('success');
  });

  it('paymentForBooking returns the matching payment', async () => {
    const payment = await service.paymentForBooking(BOOKING_ID);
    expect(payment?.id).toBe(PAYMENT_ID);
    expect(payment?.amount).toBe(AMOUNT);
    expect(await service.paymentForBooking('bkg-missing')).toBeNull();
  });
});
