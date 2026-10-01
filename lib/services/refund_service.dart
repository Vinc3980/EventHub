import 'package:hive_flutter/hive_flutter.dart';

import '../models/booking_model.dart';
import '../models/payment_model.dart';
import '../models/refund_model.dart';
import 'local_db.dart';
import 'registration_service.dart';

class RefundService {
  RefundService() : _db = LocalStore.instance;

  final LocalStore _db;

  Box<Map> get _box => _db.refunds;

  /// Creates a refund request for a confirmed booking's payment.
  Future<String> requestRefund(Booking booking, Payment payment) async {
    final id = LocalStore.newId();
    final refund = Refund(
      id: id,
      bookingId: booking.id,
      paymentId: payment.id,
      amount: payment.amount,
      status: 'requested',
      requestedAt: DateTime.now().toUtc().toIso8601String(),
    );
    await _box.put(id, refund.toMap());
    return id;
  }

  /// Simulates approving a refund (local demo only).
  ///
  /// TODO: Replace with a real payment gateway refund call in production.
  /// This mimics a gateway callback with a short delay, matching the
  /// same pattern used by MoMo payment simulation in RegistrationService.
  Future<void> approveRefund(String refundId) async {
    final data = LocalStore.readDoc(_box, refundId);
    if (data == null) return;

    // Simulate gateway processing delay (2-4 seconds).
    await Future.delayed(Duration(seconds: 2 + (refundId.hashCode % 3)));

    // Mark refund as completed.
    await _box.put(refundId, {
      ...data,
      'status': 'completed',
      'resolvedAt': DateTime.now().toUtc().toIso8601String(),
    });

    // Update the linked payment's status to 'refunded'.
    final paymentId = data['paymentId'] as String?;
    if (paymentId != null) {
      final paymentData = LocalStore.readDoc(_db.payments, paymentId);
      if (paymentData != null) {
        await _db.payments.put(paymentId, {
          ...paymentData,
          'status': 'refunded',
        });
      }
    }

    // Cancel the booking so the spot re-opens.
    final bookingId = data['bookingId'] as String?;
    if (bookingId != null) {
      final regService = RegistrationService();
      await regService.cancelBooking(bookingId, byOrganizer: true);
    }
  }

  /// Denies a refund request with a reason.
  Future<void> denyRefund(String refundId, String reason) async {
    final data = LocalStore.readDoc(_box, refundId);
    if (data == null) return;
    await _box.put(refundId, {
      ...data,
      'status': 'denied',
      'denialReason': reason,
      'resolvedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Stream of refund requests for an event (looks up bookings by eventId).
  Stream<List<Refund>> refundsForEvent(String eventId) {
    return LocalStore.watchBox(
      _box,
      where: (entry) {
        final bookingId = entry['bookingId'] as String?;
        if (bookingId == null) return false;
        final booking = LocalStore.readDoc(_db.bookings, bookingId);
        return booking?['eventId'] == eventId;
      },
      sort: (a, b) {
        final da = a['requestedAt'] as String? ?? '';
        final db = b['requestedAt'] as String? ?? '';
        return db.compareTo(da);
      },
    ).map((items) => items.map((e) => Refund.fromMap(e.$1, e.$2)).toList());
  }

  /// Stream of all refund requests for an organizer's events.
  Stream<List<Refund>> refundsForOrganizer(String organizerId) {
    return LocalStore.watchBox(
      _box,
      where: (entry) {
        final bookingId = entry['bookingId'] as String?;
        if (bookingId == null) return false;
        final booking = LocalStore.readDoc(_db.bookings, bookingId);
        if (booking == null) return false;
        final eventId = booking['eventId'] as String?;
        if (eventId == null) return false;
        final event = LocalStore.readDoc(_db.events, eventId);
        return event?['ownerId'] == organizerId;
      },
      sort: (a, b) {
        final da = a['requestedAt'] as String? ?? '';
        final db = b['requestedAt'] as String? ?? '';
        return db.compareTo(da);
      },
    ).map((items) => items.map((e) => Refund.fromMap(e.$1, e.$2)).toList());
  }

  /// Finds the payment linked to a booking.
  Payment? paymentForBooking(String bookingId) {
    for (final entry in _db.payments.toMap().entries) {
      final data = Map<String, dynamic>.from(entry.value);
      if (data['bookingId'] == bookingId) {
        return Payment.fromMap(entry.key, data);
      }
    }
    return null;
  }
}
