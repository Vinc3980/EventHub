import { liveQuery, type Observable, type Table } from 'dexie';
import { db } from '../db/db';
import { organizerPayout, platformFee } from '../lib/constants';
import { id, nowIso } from '../lib/ids';
import { Booking, InvitedGuest, Registration, parseDate } from '../models';
import { WaitlistService } from './waitlistService';

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

function parseEventDate(value: unknown): Date {
  return parseDate(value) ?? new Date(0);
}

const reminderTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelReminder(bookingId: string): void {
  const timer = reminderTimers.get(bookingId);
  if (timer != null) {
    clearTimeout(timer);
    reminderTimers.delete(bookingId);
  }
}

async function scheduleEventReminder(params: {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  userId?: string;
}): Promise<void> {
  const { bookingId, eventId, eventTitle, eventDate, userId } = params;
  if (userId != null) {
    const user = await db.users.get(userId);
    if (user != null && user.remindersEnabled === false) return;
  }
  cancelReminder(bookingId);

  const scheduledTime = eventDate.getTime() - 24 * 60 * 60 * 1000;
  const now = Date.now();
  let delay: number;
  let body: string;
  if (scheduledTime > now) {
    delay = scheduledTime - now;
    body = 'Your event starts in 24 hours.';
  } else {
    delay = 5000;
    body = 'Your event is starting soon!';
  }
  if (delay > 2147483647) return;

  const timer = setTimeout(() => {
    reminderTimers.delete(bookingId);
    if (userId == null || userId.length === 0) return;
    // SIMULATED: event reminder — persisted to the local notifications table.
    void db.notifications.put({
      id: id('ntf'),
      uid: userId,
      userId,
      title: `Upcoming: ${eventTitle}`,
      body,
      type: 'event_reminder',
      targetId: eventId,
      referenceId: bookingId,
      read: false,
      createdAt: nowIso(),
    });
  }, delay);
  reminderTimers.set(bookingId, timer);
}

export class MomoPaymentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MomoPaymentException';
  }

  toString(): string {
    return this.message;
  }
}

export class SoldOutException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SoldOutException';
  }

  toString(): string {
    return this.message;
  }
}

export class CheckInException extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CheckInException';
    this.code = code;
  }

  toString(): string {
    return this.message;
  }
}

export interface MomoPaymentRequest {
  paymentId: string;
  bookingId: string;
  status: string;
}

export interface CheckInResult {
  success: boolean;
  fullName: string;
  seatNumber: string;
}

export class RegistrationService {
  async cancelBooking(
    bookingId: string,
    { byOrganizer: _byOrganizer }: { byOrganizer: boolean },
  ): Promise<void> {
    const bookingData = await readDoc(db.bookings, bookingId);
    if (bookingData == null) return;

    const eventId = (bookingData['eventId'] as string) ?? '';

    const regId = bookingData['regId'] as string | null;
    let tierName = '';
    if (regId != null) {
      const reg = await readDoc(db.registrations, regId);
      tierName = (reg?.['ticketType'] as string) ?? '';
    }

    await db.bookings.put({
      ...bookingData,
      id: bookingId,
      status: 'cancelled',
    });

    cancelReminder(bookingId);

    if (eventId.length > 0 && tierName.length > 0) {
      const waitlistService = new WaitlistService();
      await waitlistService.notifyNextInLine(eventId, tierName);
    }
  }

  async submitRegistration(registration: Registration): Promise<string> {
    if (registration.ticketType.length > 0) {
      const remaining = await this._remainingCapacity(
        registration.eventId,
        registration.ticketType,
      );
      if (remaining <= 0) {
        throw new SoldOutException(
          'This ticket type just sold out — pick another.',
        );
      }
    }

    const regId = id('reg');
    await db.registrations.put({ ...registration.toMap(), id: regId });
    return regId;
  }

  private async _remainingCapacity(eventId: string, tierName: string): Promise<number> {
    const event = await readDoc(db.events, eventId);
    if (event == null) return -1;
    const ticketTypes = (event['ticketTypes'] as Record<string, unknown>[]) ?? [];
    for (const ticket of ticketTypes) {
      if ((ticket['name'] as string) == tierName) {
        const capacity = Number(ticket['capacity'] ?? 0);
        let sold = 0;
        const bookings = await db.bookings.toArray();
        for (const booking of bookings) {
          if (booking['eventId'] != eventId) continue;
          if (booking['status'] != 'confirmed') continue;
          const regId = booking['regId'] as string | null;
          if (regId == null) continue;
          const reg = await readDoc(db.registrations, regId);
          if (reg == null) continue;
          if ((reg['ticketType'] as string) != tierName) continue;
          sold++;
        }
        return capacity - sold;
      }
    }
    return -1;
  }

  async confirmFreeBooking({
    regId,
    eventId,
    userId,
    discountCodeId: _discountCodeId,
  }: {
    regId: string;
    eventId: string;
    userId: string;
    discountCodeId?: string;
  }): Promise<Booking> {
    const event = await readDoc(db.events, eventId);

    const booking = new Booking({
      id: '',
      regId,
      eventId,
      userId,
      status: 'confirmed',
      qrCode: id('qr'),
      seatNumber: `S-${Math.floor(Math.random() * 499) + 1}`,
      checkedIn: false,
    });

    const bookingId = id('bkg');
    // Capacity re-check at the booking step (spec: enforced at registration
    // AND at booking). The check and the write share one IndexedDB
    // transaction so two simultaneous confirmations cannot oversell a tier.
    await db.transaction(
      'rw',
      db.bookings,
      db.registrations,
      db.events,
      async () => {
        const registration = await readDoc(db.registrations, regId);
        const tierName = (registration?.['ticketType'] as string) ?? '';
        if (tierName.length > 0) {
          const remaining = await this._remainingCapacity(eventId, tierName);
          if (remaining !== -1 && remaining <= 0) {
            throw new SoldOutException(
              'This ticket type just sold out — pick another.',
            );
          }
        }
        await db.bookings.put({ ...booking.toMap(), id: bookingId });
      },
    );

    await this._joinChat(eventId, userId, (event?.['ownerId'] as string) ?? null);

    if (event != null) {
      void scheduleEventReminder({
        bookingId,
        eventId,
        eventTitle: (event['title'] as string) ?? 'Event',
        eventDate: parseEventDate(event['date']),
        userId,
      });
    }

    return Booking.fromMap(bookingId, booking.toMap());
  }

  private async _joinChat(
    eventId: string,
    userId: string,
    ownerId: string | null,
  ): Promise<void> {
    const chats = await db.chats.toArray();
    const existing = chats.find((chat) => chat['eventId'] === eventId);
    if (existing != null) {
      const members = new Set<string>([...((existing['memberIds'] as string[]) ?? []), userId]);
      members.add(userId);
      const memberList = Array.from(members);
      await db.chats.put({
        ...existing,
        memberIds: memberList,
        attendeeIds: memberList,
      });
      return;
    }
    const chatId = id('chat');
    const memberIds = [...(ownerId != null && ownerId.length > 0 ? [ownerId] : []), userId];
    await db.chats.put({
      id: chatId,
      eventId,
      memberIds,
      attendeeIds: memberIds,
      organizerId: ownerId != null && ownerId.length > 0 ? ownerId : userId,
      createdBy: ownerId ?? userId,
      type: 'group',
      readOnly: false,
      lastReadAt: {},
      lastMessage: '',
      lastMessageAt: nowIso(),
      unreadCounts: {},
      isPinned: false,
      isMuted: false,
      isBroadcast: false,
    });
  }

  async requestMomoPayment({
    regId,
    eventId,
    userId,
    amount,
  }: {
    regId: string;
    eventId: string;
    userId: string;
    amount: number;
  }): Promise<MomoPaymentRequest> {
    if (amount <= 0) {
      throw new MomoPaymentException('Invalid payment amount.');
    }

    const registration = await readDoc(db.registrations, regId);
    const tierName = (registration?.['ticketType'] as string) ?? '';
    if (tierName.length > 0) {
      const remaining = await this._remainingCapacity(eventId, tierName);
      if (remaining !== -1 && remaining <= 0) {
        throw new SoldOutException(
          'This ticket type just sold out — pick another.',
        );
      }
    }

    const paymentId = id('pay');
    await db.payments.put({
      id: paymentId,
      bookingId: '',
      amount,
      momoRef: '',
      platformFee: platformFee(amount),
      organizerPayout: organizerPayout(amount),
      status: 'pending',
    });

    const bookingId = id('bkg');
    await db.bookings.put({
      id: bookingId,
      regId,
      eventId,
      userId,
      status: 'pending',
      qrCode: '',
      seatNumber: '',
      checkedIn: false,
    });

    await db.payments.put({
      id: paymentId,
      bookingId,
      amount,
      momoRef: '',
      platformFee: platformFee(amount),
      organizerPayout: organizerPayout(amount),
      status: 'pending',
    });

    // SIMULATED: MoMo approval resolves locally after a 4-6 s delay (~90 % success).
    this.resolveMomoPaymentSimulated(paymentId, bookingId);

    return { paymentId, bookingId, status: 'pending' };
  }

  resolveMomoPaymentSimulated(paymentId: string, bookingId: string): void {
    // SIMULATED: MoMo gateway callback — runs entirely in memory, no network calls.
    void this._resolveMomo(paymentId, bookingId, { randomOutcome: true });
  }

  forceResolveMomoPayment(
    paymentId: string,
    bookingId: string,
    { success }: { success: boolean },
  ): void {
    // SIMULATED: dev-only forced MoMo resolution — runs entirely in memory, no network calls.
    void this._resolveMomo(paymentId, bookingId, {
      randomOutcome: false,
      forceSuccess: success,
    });
  }

  private async _resolveMomo(
    paymentId: string,
    bookingId: string,
    { randomOutcome, forceSuccess = true }: { randomOutcome: boolean; forceSuccess?: boolean },
  ): Promise<void> {
    await sleep(randomOutcome ? (4 + Math.floor(Math.random() * 3)) * 1000 : 0);
    const bookingRow = await db.bookings.get(bookingId);
    if (bookingRow == null) return;

    const success = randomOutcome ? Math.floor(Math.random() * 10) < 9 : forceSuccess;

    if (success) {
      const qrCode = id('qr');
      const seatNumber = `S-${Math.floor(Math.random() * 499) + 1}`;
      await db.bookings.put({
        ...bookingRow,
        id: bookingId,
        status: 'confirmed',
        qrCode,
        seatNumber,
      });
      const paymentRow = (await db.payments.get(paymentId)) ?? {};
      await db.payments.put({
        ...paymentRow,
        id: paymentId,
        status: 'success',
        momoRef: `SIM-${id('sim')}`,
      });
      const eventId = (bookingRow['eventId'] as string) ?? '';
      const userId = (bookingRow['userId'] as string) ?? '';
      const event = await readDoc(db.events, eventId);
      await this._joinChat(eventId, userId, (event?.['ownerId'] as string) ?? null);

      if (event != null) {
        void scheduleEventReminder({
          bookingId,
          eventId,
          eventTitle: (event['title'] as string) ?? 'Event',
          eventDate: parseEventDate(event['date']),
          userId,
        });
      }
    } else {
      await db.bookings.put({
        ...bookingRow,
        id: bookingId,
        status: 'payment_failed',
      });
      const paymentRow = (await db.payments.get(paymentId)) ?? {};
      await db.payments.put({
        ...paymentRow,
        id: paymentId,
        status: 'failed',
      });
    }
  }

  bookingsForEvent(eventId: string): Observable<Booking[]> {
    return liveQuery(async () => {
      const rows = await db.bookings.toArray();
      return rows
        .filter((booking) => booking['eventId'] === eventId)
        .map((booking) => Booking.fromMap((booking.id as string) ?? '', booking));
    });
  }

  bookingsForUser(userId: string): Observable<Booking[]> {
    return liveQuery(async () => {
      const rows = await db.bookings.toArray();
      return rows
        .filter((booking) => booking['userId'] === userId)
        .map((booking) => Booking.fromMap((booking.id as string) ?? '', booking));
    });
  }

  async checkIn({
    eventId,
    scannedCode,
  }: {
    eventId: string;
    scannedCode: string;
  }): Promise<CheckInResult> {
    const rows = await db.bookings.toArray();
    let foundBooking: Booking | null = null;
    let foundBookingId: string | null = null;
    for (const row of rows) {
      if (row['qrCode'] === scannedCode && row['eventId'] === eventId) {
        foundBooking = Booking.fromMap((row.id as string) ?? '', row);
        foundBookingId = (row.id as string) ?? null;
        break;
      }
    }

    if (foundBooking == null || foundBookingId == null) {
      throw new CheckInException('not_found', 'No booking found for this QR code.');
    }

    if (foundBooking.status !== 'confirmed') {
      throw new CheckInException(
        'invalid_status',
        `This booking is not confirmed (${foundBooking.status}).`,
      );
    }

    if (foundBooking.checkedIn) {
      throw new CheckInException(
        'already_checked_in',
        'This ticket has already been scanned.',
      );
    }

    await db.bookings.put({
      ...foundBooking.toMap(),
      id: foundBookingId,
      checkedIn: true,
      checkedInAt: nowIso(),
    });

    const reg = await readDoc(db.registrations, foundBooking.regId);
    const fullName = (reg?.['fullName'] as string) ?? 'Attendee';

    return {
      success: true,
      fullName,
      seatNumber: foundBooking.seatNumber,
    };
  }

  async checkInBySeat({
    eventId,
    seatNumber,
  }: {
    eventId: string;
    seatNumber: string;
  }): Promise<CheckInResult> {
    const rows = await db.bookings.toArray();
    let foundBooking: Booking | null = null;
    let foundBookingId: string | null = null;
    for (const row of rows) {
      if (row['seatNumber'] === seatNumber && row['eventId'] === eventId) {
        foundBooking = Booking.fromMap((row.id as string) ?? '', row);
        foundBookingId = (row.id as string) ?? null;
        break;
      }
    }

    if (foundBooking == null || foundBookingId == null) {
      throw new CheckInException(
        'not_found',
        `No booking found for seat ${seatNumber}.`,
      );
    }

    if (foundBooking.status !== 'confirmed') {
      throw new CheckInException(
        'invalid_status',
        `This booking is not confirmed (${foundBooking.status}).`,
      );
    }

    if (foundBooking.checkedIn) {
      throw new CheckInException(
        'already_checked_in',
        'This ticket has already been scanned.',
      );
    }

    await db.bookings.put({
      ...foundBooking.toMap(),
      id: foundBookingId,
      checkedIn: true,
      checkedInAt: nowIso(),
    });

    const reg = await readDoc(db.registrations, foundBooking.regId);
    const fullName = (reg?.['fullName'] as string) ?? 'Attendee';

    return {
      success: true,
      fullName,
      seatNumber: foundBooking.seatNumber,
    };
  }

  async addInvitedGuest(
    guest: InvitedGuest & { bookingId?: string; joinedChat?: boolean },
  ): Promise<string> {
    const guestId = id('inv');
    await db.invitedGuests.put({
      ...guest.toMap(),
      id: guestId,
      bookingId: guest.bookingId ?? '',
      joinedChat: guest.joinedChat ?? false,
    });
    return guestId;
  }

  invitedGuestsForBooking(bookingId: string): Observable<InvitedGuest[]> {
    return liveQuery(async () => {
      const rows = await db.invitedGuests.toArray();
      return rows
        .filter((entry) => entry['bookingId'] === bookingId)
        .map((entry) => InvitedGuest.fromMap((entry.id as string) ?? '', entry));
    });
  }
}
