/// A payment record for a booking. Stored at `payments/{paymentId}`.
///
/// Payments are written ONLY by Cloud Functions (MomoService runs server-side);
/// clients never write to this collection (see firestore.rules).
class Payment {
  final String id;
  final String bookingId;
  final double amount;
  final String momoRef;
  final double platformFee;
  final double organizerPayout;
  final String status; // pending | success | failed

  const Payment({
    required this.id,
    required this.bookingId,
    required this.amount,
    this.momoRef = '',
    this.platformFee = 0,
    this.organizerPayout = 0,
    this.status = 'pending',
  });

  factory Payment.fromMap(String id, Map<String, dynamic> map) {
    return Payment(
      id: id,
      bookingId: map['bookingId'] as String? ?? '',
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      momoRef: map['momoRef'] as String? ?? '',
      platformFee: (map['platformFee'] as num?)?.toDouble() ?? 0,
      organizerPayout: (map['organizerPayout'] as num?)?.toDouble() ?? 0,
      status: map['status'] as String? ?? 'pending',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'bookingId': bookingId,
      'amount': amount,
      'momoRef': momoRef,
      'platformFee': platformFee,
      'organizerPayout': organizerPayout,
      'status': status,
    };
  }
}
