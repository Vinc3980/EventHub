class Refund {
  final String id;
  final String bookingId;
  final String paymentId;
  final double amount;
  final String status; // 'requested' | 'approved' | 'denied' | 'completed'
  final String requestedAt;
  final String? resolvedAt;

  const Refund({
    required this.id,
    required this.bookingId,
    required this.paymentId,
    required this.amount,
    this.status = 'requested',
    required this.requestedAt,
    this.resolvedAt,
  });

  factory Refund.fromMap(String id, Map<String, dynamic> map) {
    return Refund(
      id: id,
      bookingId: map['bookingId'] as String? ?? '',
      paymentId: map['paymentId'] as String? ?? '',
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      status: map['status'] as String? ?? 'requested',
      requestedAt: map['requestedAt'] as String? ?? '',
      resolvedAt: map['resolvedAt'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'bookingId': bookingId,
      'paymentId': paymentId,
      'amount': amount,
      'status': status,
      'requestedAt': requestedAt,
      'resolvedAt': resolvedAt,
    };
  }
}
