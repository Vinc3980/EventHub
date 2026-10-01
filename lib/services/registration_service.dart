import 'dart:math';

import '../models/booking_model.dart';
import '../models/invited_guest_model.dart';
import '../models/registration_model.dart';
import 'chat_service.dart';
import 'local_db.dart';
import 'reminder_service.dart';
import 'waitlist_service.dart';

class MomoPaymentException implements Exception {
  MomoPaymentException(this.message);
  final String message;

  @override
  String toString() => message;
}

class SoldOutException implements Exception {
  SoldOutException(this.message);
  final String message;

  @override
  String toString() => message;
}

class CheckInException implements Exception {
  CheckInException(this.code, this.message);
  final String code;
  final String message;

  @override
  String toString() => message;
}

class RegistrationService {
  RegistrationService()
      : _db = LocalStore.instance,
        _chatService = ChatService();

  final LocalStore _db;
  final ChatService _chatService;

  /// Cancels a booking and notifies the next person on the waitlist (if any).
  ///
  /// When [byOrganizer] is true, the organizer is removing an attendee
  /// directly (e.g. overbooking correction). When false, the attendee
  /// cancelled their own booking.
  Future<void> cancelBooking(String bookingId, {required bool byOrganizer}) async {
    final bookingData = LocalStore.readDoc(_db.bookings, bookingId);
    if (bookingData == null) return;

    final eventId = bookingData['eventId'] as String? ?? '';

    // Determine the tier name from the registration.
    final regId = bookingData['regId'] as String?;
    String tierName = '';
    if (regId != null) {
      final reg = LocalStore.readDoc(_db.registrations, regId);
      tierName = reg?['ticketType'] as String? ?? '';
    }

    // Mark booking as cancelled.
    await _db.bookings.put(bookingId, {
      ...bookingData,
      'status': 'cancelled',
    });

    // Cancel any scheduled reminder for this booking.
    // ignore: unawaited_futures
    ReminderService().cancelReminder(bookingId);

    // Notify the next person on the waitlist for this tier.
    if (eventId.isNotEmpty && tierName.isNotEmpty) {
      final waitlistService = WaitlistService();
      await waitlistService.notifyNextInLine(eventId, tierName);
    }
  }

  Future<String> submitRegistration(Registration registration) async {
    // Re-check remaining capacity for the chosen tier (race-condition guard).
    if (registration.ticketType.isNotEmpty) {
      final remaining = _remainingCapacity(
        registration.eventId,
        registration.ticketType,
      );
      if (remaining <= 0) {
        throw SoldOutException(
          'This ticket type just sold out — pick another.',
        );
      }
    }

    final id = LocalStore.newId();
    await _db.registrations.put(id, registration.toMap());
    return id;
  }

  /// Computes remaining capacity for a tier directly from local storage.
  int _remainingCapacity(String eventId, String tierName) {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return -1;
    final ticketTypes = (event['ticketTypes'] as List? ?? const []);
    for (final t in ticketTypes) {
      final ticket = Map<String, dynamic>.from(t);
      if ((ticket['name'] as String?) == tierName) {
        final capacity = (ticket['capacity'] as num?)?.toInt() ?? 0;
        int sold = 0;
        for (final entry in _db.bookings.toMap().entries) {
          final booking = Map<String, dynamic>.from(entry.value);
          if (booking['eventId'] != eventId) continue;
          if (booking['status'] != 'confirmed') continue;
          final regId = booking['regId'] as String?;
          if (regId == null) continue;
          final reg = LocalStore.readDoc(_db.registrations, regId);
          if (reg == null) continue;
          if ((reg['ticketType'] as String?) != tierName) continue;
          sold++;
        }
        return capacity - sold;
      }
    }
    return -1;
  }

  Future<Booking> confirmFreeBooking({
    required String regId,
    required String eventId,
    required String userId,
    String? discountCodeId,
  }) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    final rand = Random();

    final booking = Booking(
      id: '',
      regId: regId,
      eventId: eventId,
      userId: userId,
      status: 'confirmed',
      qrCode: LocalStore.newId(),
      seatNumber: 'S-${rand.nextInt(499) + 1}',
      checkedIn: false,
    );

    final bookingId = LocalStore.newId();
    await _db.bookings.put(bookingId, booking.toMap());

    await _joinChat(eventId, userId, event?['ownerId'] as String?);

    // Schedule reminder 24 h before event.
    if (event != null) {
      // ignore: unawaited_futures
      ReminderService().scheduleEventReminder(
        bookingId: bookingId,
        eventTitle: event['title'] as String? ?? 'Event',
        eventDate: _parseEventDate(event['date']),
        userId: userId,
      );
    }

    return Booking.fromMap(bookingId, booking.toMap());
  }

  Future<void> _joinChat(String eventId, String userId, String? ownerId) async {
    await _chatService.ensureChatForEvent(
      eventId: eventId,
      userId: userId,
      ownerId: ownerId,
    );
  }

  /// Initiates a simulated MoMo payment.
  ///
  /// Creates a pending Payment record AND a pending Booking, then kicks off
  /// a fire-and-forget simulated approval (4-6 s delay, ~90 % success).
  /// TODO: Replace with a real Cloud Function + MoMo API integration.
  Future<Map<String, dynamic>> requestMomoPayment({
    required String regId,
    required String eventId,
    required String userId,
    required double amount,
  }) async {
    if (amount <= 0) {
      throw MomoPaymentException('Invalid payment amount.');
    }

    final paymentId = LocalStore.newId();
    await _db.payments.put(paymentId, {
      'bookingId': '', // filled below once we know the booking id
      'amount': amount,
      'momoRef': '',
      'platformFee': amount * 0.02,
      'organizerPayout': amount * 0.98,
      'status': 'pending',
    });

    // Create a pending booking so PaymentScreen's polling has something to find.
    final bookingId = LocalStore.newId();
    await _db.bookings.put(bookingId, {
      'regId': regId,
      'eventId': eventId,
      'userId': userId,
      'status': 'pending',
      'qrCode': '',
      'seatNumber': '',
      'checkedIn': false,
    });

    // Back-fill the payment record with the booking id.
    await _db.payments.put(paymentId, {
      'bookingId': bookingId,
      'amount': amount,
      'momoRef': '',
      'platformFee': amount * 0.02,
      'organizerPayout': amount * 0.98,
      'status': 'pending',
    });

    // Fire-and-forget: simulate MoMo approval latency.
    resolveMomoPaymentSimulated(paymentId, bookingId);

    return {'paymentId': paymentId, 'bookingId': bookingId, 'status': 'pending'};
  }

  /// Simulates the MoMo approval callback.
  /// TODO: Replace with a real Cloud Function + MoMo API integration.
  void resolveMomoPaymentSimulated(String paymentId, String bookingId) {
    _resolveMomo(paymentId, bookingId, randomOutcome: true);
  }

  /// Dev-only: force-resolve a pending MoMo payment instantly.
  void forceResolveMomoPayment(
    String paymentId,
    String bookingId, {
    required bool success,
  }) {
    _resolveMomo(paymentId, bookingId, randomOutcome: false, forceSuccess: success);
  }

  /// Internal resolve logic shared by simulated and forced resolution.
  void _resolveMomo(
    String paymentId,
    String bookingId, {
    required bool randomOutcome,
    bool forceSuccess = true,
  }) {
    // ignore: unawaited_futures
    () async {
      await Future.delayed(
        randomOutcome ? Duration(seconds: 4 + Random().nextInt(3)) : Duration.zero,
      );
      if (!LocalStore.instance.bookings.containsKey(bookingId)) return;

      final success =
          randomOutcome ? (Random().nextInt(10) < 9) : forceSuccess;
      final rand = Random();

      if (success) {
        final qrCode = LocalStore.newId();
        final seatNumber = 'S-${rand.nextInt(499) + 1}';
        final existingBooking =
            Map<String, dynamic>.from(_db.bookings.get(bookingId) ?? {});
        await _db.bookings.put(bookingId, {
          ...existingBooking,
          'status': 'confirmed',
          'qrCode': qrCode,
          'seatNumber': seatNumber,
        });
        final existingPayment =
            Map<String, dynamic>.from(_db.payments.get(paymentId) ?? {});
        await _db.payments.put(paymentId, {
          ...existingPayment,
          'status': 'success',
          'momoRef': 'SIM-${LocalStore.newId()}',
        });
        final eventId = existingBooking['eventId'] as String? ?? '';
        final userId = existingBooking['userId'] as String? ?? '';
        final event = LocalStore.readDoc(_db.events, eventId);
        await _joinChat(eventId, userId, event?['ownerId'] as String?);

        // Schedule reminder 24 h before event.
        if (event != null) {
          // ignore: unawaited_futures
          ReminderService().scheduleEventReminder(
            bookingId: bookingId,
            eventTitle: event['title'] as String? ?? 'Event',
            eventDate: _parseEventDate(event['date']),
            userId: userId,
          );
        }
      } else {
        final existingBooking =
            Map<String, dynamic>.from(_db.bookings.get(bookingId) ?? {});
        await _db.bookings.put(bookingId, {
          ...existingBooking,
          'status': 'payment_failed',
        });
        final existingPayment =
            Map<String, dynamic>.from(_db.payments.get(paymentId) ?? {});
        await _db.payments.put(paymentId, {
          ...existingPayment,
          'status': 'failed',
        });
      }
    }();
  }

  Stream<List<Booking>> bookingsForEvent(String eventId) {
    return LocalStore.watchBox(
      _db.bookings,
      where: (booking) => booking['eventId'] == eventId,
    ).map((items) => items.map((e) => Booking.fromMap(e.$1, e.$2)).toList());
  }

  Stream<List<Booking>> bookingsForUser(String userId) {
    return LocalStore.watchBox(
      _db.bookings,
      where: (booking) => booking['userId'] == userId,
    ).map((items) => items.map((e) => Booking.fromMap(e.$1, e.$2)).toList());
  }

  static DateTime _parseEventDate(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }
    return DateTime.fromMillisecondsSinceEpoch(0);
  }

  /// Checks in an attendee by their QR code for a specific event.
  /// Returns a map with success status, attendee name, and seat number.
  /// Throws if: not found, wrong event, already checked in, or status != confirmed.
  Future<Map<String, dynamic>> checkIn({
    required String eventId,
    required String scannedCode,
  }) async {
    Booking? foundBooking;
    String? foundBookingId;
    for (final entry in _db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['qrCode'] == scannedCode && booking['eventId'] == eventId) {
        foundBooking = Booking.fromMap(entry.key, booking);
        foundBookingId = entry.key;
        break;
      }
    }

    if (foundBooking == null || foundBookingId == null) {
      throw CheckInException('not_found', 'No booking found for this QR code.');
    }

    if (foundBooking.status != 'confirmed') {
      throw CheckInException(
          'invalid_status', 'This booking is not confirmed (${foundBooking.status}).');
    }

    if (foundBooking.checkedIn) {
      throw CheckInException(
          'already_checked_in', 'This ticket has already been scanned.');
    }

    await _db.bookings.put(foundBookingId, {
      ...foundBooking.toMap(),
      'checkedIn': true,
      'checkedInAt': DateTime.now().toUtc().toIso8601String(),
    });

    final reg = LocalStore.readDoc(_db.registrations, foundBooking.regId);
    final fullName = reg?['fullName'] as String? ?? 'Attendee';

    return {
      'success': true,
      'fullName': fullName,
      'seatNumber': foundBooking.seatNumber,
    };
  }

  /// Manual check-in by seat number for a specific event.
  Future<Map<String, dynamic>> checkInBySeat({
    required String eventId,
    required String seatNumber,
  }) async {
    Booking? foundBooking;
    String? foundBookingId;
    for (final entry in _db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['seatNumber'] == seatNumber &&
          booking['eventId'] == eventId) {
        foundBooking = Booking.fromMap(entry.key, booking);
        foundBookingId = entry.key;
        break;
      }
    }

    if (foundBooking == null || foundBookingId == null) {
      throw CheckInException(
          'not_found', 'No booking found for seat $seatNumber.');
    }

    if (foundBooking.status != 'confirmed') {
      throw CheckInException(
          'invalid_status', 'This booking is not confirmed (${foundBooking.status}).');
    }

    if (foundBooking.checkedIn) {
      throw CheckInException(
          'already_checked_in', 'This ticket has already been scanned.');
    }

    await _db.bookings.put(foundBookingId, {
      ...foundBooking.toMap(),
      'checkedIn': true,
      'checkedInAt': DateTime.now().toUtc().toIso8601String(),
    });

    final reg = LocalStore.readDoc(_db.registrations, foundBooking.regId);
    final fullName = reg?['fullName'] as String? ?? 'Attendee';

    return {
      'success': true,
      'fullName': fullName,
      'seatNumber': foundBooking.seatNumber,
    };
  }

  Future<String> addInvitedGuest(InvitedGuest guest) async {
    final id = LocalStore.newId();
    await _db.invitedGuests.put(id, guest.toMap());
    return id;
  }

  Stream<List<InvitedGuest>> invitedGuestsForBooking(String bookingId) {
    return LocalStore.watchBox(
      _db.invitedGuests,
      where: (entry) => entry['bookingId'] == bookingId,
    ).map((items) =>
        items.map((e) => InvitedGuest.fromMap(e.$1, e.$2)).toList());
  }
}
