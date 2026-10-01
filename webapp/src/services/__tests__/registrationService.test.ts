import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { organizerPayout, platformFee } from '../../lib/constants';
import { EventTicket, Registration } from '../../models';
import {
  DAY_MS,
  firstValue,
  putBooking,
  putEvent,
  putGuestListEntry,
  putRegistration,
} from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { CheckInException, RegistrationService, SoldOutException } from '../registrationService';

function newRegistration(
  eventId: string,
  userId: string,
  overrides: Partial<Registration> = {},
): Registration {
  return new Registration({
    id: '',
    eventId,
    userId,
    fullName: overrides.fullName ?? `Attendee ${userId}`,
    ticketType: overrides.ticketType ?? 'Regular',
    invitedGuestCount: overrides.invitedGuestCount ?? 0,
    phone: '0245550134',
    gender: 'Female',
    attendeeType: 'Guest',
    ...overrides,
  });
}

describe('RegistrationService', () => {
  const service = new RegistrationService();

  beforeEach(async () => {
    await resetDatabase();
  });

  // -------------------------------------------------------------------------
  // submitRegistration
  // -------------------------------------------------------------------------

  it('stores a registration without touching the organizer guest list', async () => {
    await putEvent({ id: 'evt-reg', ticketTypes: [new EventTicket({ name: 'Regular', price: 0, capacity: 10 })] });

    const regId = await service.submitRegistration(newRegistration('evt-reg', 'u1', { invitedGuestCount: 2 }));

    expect(regId).toMatch(/^reg-/);
    const row = await db.registrations.get(regId);
    expect(row?.eventId).toBe('evt-reg');
    expect(row?.userId).toBe('u1');
    expect(row?.fullName).toBe('Attendee u1');
    expect(row?.ticketType).toBe('Regular');
    expect(row?.invitedGuestCount).toBe(2);

    // The guest list is organizer-managed: registration alone never writes it.
    expect(await db.guestList.count()).toBe(0);
  });

  it('rejects a registration once the tier is sold out', async () => {
    await putEvent({ id: 'evt-full', ticketTypes: [new EventTicket({ name: 'Regular', price: 0, capacity: 1 })] });
    const firstReg = await service.submitRegistration(newRegistration('evt-full', 'u1'));
    await service.confirmFreeBooking({ regId: firstReg, eventId: 'evt-full', userId: 'u1' });

    const error = await service
      .submitRegistration(newRegistration('evt-full', 'u2'))
      .then(() => null, (err: unknown) => err);

    expect(error).toBeInstanceOf(SoldOutException);
    expect((error as SoldOutException).message).toBe('This ticket type just sold out — pick another.');
    expect(await db.registrations.count()).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Free bookings
  // -------------------------------------------------------------------------

  it('confirmFreeBooking creates a confirmed booking, joins the chat and writes an event reminder', async () => {
    const userId = 'u-free';
    await putEvent({
      id: 'evt-free',
      ownerId: 'org-owner',
      title: 'Free Concert',
      date: new Date(Date.now() + DAY_MS + 800), // reminder fires in well under a second
      ticketTypes: [new EventTicket({ name: 'Regular', price: 0, capacity: 10 })],
    });
    const regId = await putRegistration({ id: 'reg-free', eventId: 'evt-free', userId });

    const booking = await service.confirmFreeBooking({ regId, eventId: 'evt-free', userId });

    expect(booking.status).toBe('confirmed');
    expect(booking.qrCode).toMatch(/^qr-/);
    expect(booking.seatNumber).toMatch(/^S-\d+$/);
    expect(booking.checkedIn).toBe(false);

    const stored = await db.bookings.get(booking.id);
    expect(stored?.status).toBe('confirmed');
    expect(stored?.regId).toBe(regId);

    const chats = await db.chats.toArray();
    expect(chats).toHaveLength(1);
    expect(chats[0].eventId).toBe('evt-free');
    expect(chats[0].memberIds).toEqual(expect.arrayContaining(['org-owner', userId]));

    // Reminder notification is scheduled ~1s out for an event inside 24h.
    await vi.waitFor(
      async () => {
        const rows = await db.notifications.toArray();
        expect(
          rows.some((row) => row.type === 'event_reminder' && row.userId === userId),
        ).toBe(true);
      },
      { timeout: 4000, interval: 50 },
    );
    const reminder = (await db.notifications.toArray()).find(
      (row) => row.type === 'event_reminder',
    );
    expect(reminder?.title).toBe('Upcoming: Free Concert');
    expect(reminder?.body).toBe('Your event starts in 24 hours.');
    expect(reminder?.targetId).toBe('evt-free');
    expect(reminder?.referenceId).toBe(booking.id);
    expect(reminder?.read).toBe(false);

    // Confirmation never writes the organizer guest list either.
    expect(await db.guestList.count()).toBe(0);
  }, 10_000);

  it(
    'capacity cannot be exceeded by two concurrent confirmations',
    async () => {
      await putEvent({
        id: 'evt-race',
        ticketTypes: [new EventTicket({ name: 'Regular', price: 0, capacity: 1 })],
      });
      // Both registrations pass submitRegistration because neither booking is
      // confirmed yet — then both confirmations race for the single seat.
      const regA = await service.submitRegistration(newRegistration('evt-race', 'u1'));
      const regB = await service.submitRegistration(newRegistration('evt-race', 'u2'));

      const results = await Promise.allSettled([
        service.confirmFreeBooking({ regId: regA, eventId: 'evt-race', userId: 'u1' }),
        service.confirmFreeBooking({ regId: regB, eventId: 'evt-race', userId: 'u2' }),
      ]);

      const confirmed = results.filter((result) => result.status === 'fulfilled').length;
      expect(confirmed).toBe(1);
    },
    10_000,
  );

  // -------------------------------------------------------------------------
  // Paid bookings
  // -------------------------------------------------------------------------

  it('requestMomoPayment creates a pending payment with the fee split and a pending booking', async () => {
    await putEvent({
      id: 'evt-paid',
      ticketTypes: [new EventTicket({ name: 'Regular', price: 80, capacity: 10 })],
    });
    const regId = await putRegistration({ id: 'reg-paid', eventId: 'evt-paid', userId: 'u-paid' });

    const request = await service.requestMomoPayment({
      regId,
      eventId: 'evt-paid',
      userId: 'u-paid',
      amount: 80,
    });

    expect(request.status).toBe('pending');
    expect(request.paymentId).toMatch(/^pay-/);
    expect(request.bookingId).toMatch(/^bkg-/);

    const payment = await db.payments.get(request.paymentId);
    expect(payment?.status).toBe('pending');
    expect(payment?.bookingId).toBe(request.bookingId);
    expect(payment?.amount).toBe(80);
    expect(payment?.platformFee).toBe(platformFee(80));
    expect(payment?.organizerPayout).toBe(organizerPayout(80));
    expect(payment?.platformFee).toBe(1.6);
    expect(payment?.organizerPayout).toBe(78.4);

    const booking = await db.bookings.get(request.bookingId);
    expect(booking?.status).toBe('pending');
    expect(booking?.regId).toBe(regId);
    expect(booking?.userId).toBe('u-paid');
  });

  it('forceResolveMomoPayment(success) confirms the booking and the payment', async () => {
    await putEvent({
      id: 'evt-ok',
      date: new Date(Date.now() + 60 * DAY_MS), // far enough out that no reminder timer is armed
      ticketTypes: [new EventTicket({ name: 'Regular', price: 80, capacity: 10 })],
    });
    const regId = await putRegistration({ id: 'reg-ok', eventId: 'evt-ok', userId: 'u-ok' });
    const request = await service.requestMomoPayment({
      regId,
      eventId: 'evt-ok',
      userId: 'u-ok',
      amount: 80,
    });

    service.forceResolveMomoPayment(request.paymentId, request.bookingId, { success: true });

    await vi.waitFor(
      async () => {
        expect((await db.payments.get(request.paymentId))?.status).toBe('success');
        expect((await db.bookings.get(request.bookingId))?.status).toBe('confirmed');
      },
      { timeout: 3000, interval: 25 },
    );

    const payment = await db.payments.get(request.paymentId);
    expect(String(payment?.momoRef)).toMatch(/^SIM-/);
    const booking = await db.bookings.get(request.bookingId);
    expect(String(booking?.qrCode)).toMatch(/^qr-/);
    expect(String(booking?.seatNumber)).toMatch(/^S-\d+$/);
    // Deviation note: the webapp never writes guest-list rows from the paid
    // path either — guestListService is only called by the organizer screen.
    expect(await db.guestList.count()).toBe(0);
  }, 10_000);

  it('forceResolveMomoPayment(failure) fails the payment and the booking', async () => {
    await putEvent({
      id: 'evt-fail',
      date: new Date(Date.now() + 60 * DAY_MS),
      ticketTypes: [new EventTicket({ name: 'Regular', price: 80, capacity: 10 })],
    });
    const regId = await putRegistration({ id: 'reg-fail', eventId: 'evt-fail', userId: 'u-fail' });
    const request = await service.requestMomoPayment({
      regId,
      eventId: 'evt-fail',
      userId: 'u-fail',
      amount: 80,
    });

    service.forceResolveMomoPayment(request.paymentId, request.bookingId, { success: false });

    await vi.waitFor(
      async () => {
        expect((await db.payments.get(request.paymentId))?.status).toBe('failed');
        expect((await db.bookings.get(request.bookingId))?.status).toBe('payment_failed');
      },
      { timeout: 3000, interval: 25 },
    );
  }, 10_000);

  it('requestMomoPayment rejects a zero amount', async () => {
    await expect(
      service.requestMomoPayment({ regId: 'reg-x', eventId: 'evt-x', userId: 'u-x', amount: 0 }),
    ).rejects.toThrow('Invalid payment amount.');
  });

  // -------------------------------------------------------------------------
  // Check-in
  // -------------------------------------------------------------------------

  it('checkIn is idempotent: the second scan surfaces the already-checked-in state', async () => {
    const eventId = 'evt-checkin';
    const qrCode = 'QR-CHECKIN-1';
    await putEvent({ id: eventId });
    await putRegistration({ id: 'reg-checkin', eventId, userId: 'u-check', fullName: 'Kojo Frimpong' });
    await putBooking({
      id: 'bkg-checkin',
      regId: 'reg-checkin',
      eventId,
      userId: 'u-check',
      qrCode,
      seatNumber: 'S-7',
    });

    const first = await service.checkIn({ eventId, scannedCode: qrCode });
    expect(first).toEqual({ success: true, fullName: 'Kojo Frimpong', seatNumber: 'S-7' });

    const afterFirst = await db.bookings.get('bkg-checkin');
    expect(afterFirst?.checkedIn).toBe(true);
    expect(typeof afterFirst?.checkedInAt).toBe('string');
    const firstStamp = String(afterFirst?.checkedInAt);

    const second = await service.checkIn({ eventId, scannedCode: qrCode }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(second).toBeInstanceOf(CheckInException);
    const exception = second as CheckInException;
    expect(exception.code).toBe('already_checked_in');
    // Deviation from the ticket wording: the implementation says "scanned".
    expect(exception.message).toBe('This ticket has already been scanned.');

    const afterSecond = await db.bookings.get('bkg-checkin');
    expect(afterSecond?.checkedIn).toBe(true);
    expect(afterSecond?.checkedInAt).toBe(firstStamp);
    expect(await db.bookings.count()).toBe(1);
  });

  it('checkIn rejects an unknown QR code and an unconfirmed booking', async () => {
    const eventId = 'evt-checkin-2';
    await putEvent({ id: eventId });
    await putRegistration({ id: 'reg-ci2', eventId, userId: 'u-ci2' });
    await putBooking({
      id: 'bkg-ci2',
      regId: 'reg-ci2',
      eventId,
      userId: 'u-ci2',
      status: 'pending',
      qrCode: 'QR-PENDING',
    });

    const missing = await service.checkIn({ eventId, scannedCode: 'QR-NOPE' }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(missing).toBeInstanceOf(CheckInException);
    expect((missing as CheckInException).message).toBe('No booking found for this QR code.');

    const unconfirmed = await service.checkIn({ eventId, scannedCode: 'QR-PENDING' }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(unconfirmed).toBeInstanceOf(CheckInException);
    expect((unconfirmed as CheckInException).code).toBe('invalid_status');
    expect((unconfirmed as CheckInException).message).toBe('This booking is not confirmed (pending).');
  });

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  it('bookingsForUser returns only that user’s bookings', async () => {
    await putEvent({ id: 'evt-q' });
    await putRegistration({ id: 'reg-q1', eventId: 'evt-q', userId: 'u-a' });
    await putRegistration({ id: 'reg-q2', eventId: 'evt-q', userId: 'u-b' });
    await putBooking({ id: 'bkg-a1', regId: 'reg-q1', eventId: 'evt-q', userId: 'u-a' });
    await putBooking({ id: 'bkg-a2', regId: 'reg-q1', eventId: 'evt-q', userId: 'u-a' });
    await putBooking({ id: 'bkg-b1', regId: 'reg-q2', eventId: 'evt-q', userId: 'u-b' });

    const mine = await firstValue(service.bookingsForUser('u-a'));
    expect(mine.map((booking) => booking.id).sort()).toEqual(['bkg-a1', 'bkg-a2']);
    expect(mine.every((booking) => booking.userId === 'u-a')).toBe(true);

    const theirs = await firstValue(service.bookingsForUser('u-b'));
    expect(theirs.map((booking) => booking.id)).toEqual(['bkg-b1']);

    const nobody = await firstValue(service.bookingsForUser('u-missing'));
    expect(nobody).toEqual([]);
  });

  it('bookingsForEvent scopes to the event', async () => {
    await putEvent({ id: 'evt-e1' });
    await putEvent({ id: 'evt-e2' });
    await putRegistration({ id: 'reg-e1', eventId: 'evt-e1', userId: 'u-1' });
    await putRegistration({ id: 'reg-e2', eventId: 'evt-e2', userId: 'u-1' });
    await putBooking({ id: 'bkg-e1', regId: 'reg-e1', eventId: 'evt-e1', userId: 'u-1' });
    await putBooking({ id: 'bkg-e2', regId: 'reg-e2', eventId: 'evt-e2', userId: 'u-1' });

    const forEvent = await firstValue(service.bookingsForEvent('evt-e1'));
    expect(forEvent.map((booking) => booking.id)).toEqual(['bkg-e1']);
  });

  it('cancelBooking marks the booking cancelled (used by refunds)', async () => {
    await putEvent({ id: 'evt-cancel' });
    await putRegistration({ id: 'reg-cancel', eventId: 'evt-cancel', userId: 'u-c' });
    await putBooking({ id: 'bkg-cancel', regId: 'reg-cancel', eventId: 'evt-cancel', userId: 'u-c' });
    await putGuestListEntry({ id: 'gl-cancel', regId: 'reg-cancel', eventId: 'evt-cancel' });

    await service.cancelBooking('bkg-cancel', { byOrganizer: true });

    expect((await db.bookings.get('bkg-cancel'))?.status).toBe('cancelled');
  });

  it('does not arm a reminder timer for far-future events (delay would overflow)', async () => {
    await putEvent({
      id: 'evt-far',
      date: new Date(Date.now() + 90 * DAY_MS),
      ticketTypes: [new EventTicket({ name: 'Regular', price: 0, capacity: 5 })],
    });
    const regId = await putRegistration({ id: 'reg-far', eventId: 'evt-far', userId: 'u-far' });
    await service.confirmFreeBooking({ regId, eventId: 'evt-far', userId: 'u-far' });

    // Give the (possibly armed) 5s fallback timer a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await db.notifications.count()).toBe(0);
  });
});
