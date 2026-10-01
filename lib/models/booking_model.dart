/// A confirmed ticket seat for one registration. Stored locally in the
/// `bookings` box (Firestore `bookings/{bookingId}` when Firebase is introduced).
class Booking {
  final String id;
  final String regId;
  final String eventId;
  final String userId;
  final String status; // pending | confirmed | payment_failed
  final String qrCode;
  final String seatNumber;
  final bool checkedIn;
  final DateTime? checkedInAt;

  const Booking({
    required this.id,
    required this.regId,
    required this.eventId,
    required this.userId,
    this.status = 'pending',
    this.qrCode = '',
    this.seatNumber = '',
    this.checkedIn = false,
    this.checkedInAt,
  });

  factory Booking.fromMap(String id, Map<String, dynamic> map) {
    return Booking(
      id: id,
      regId: map['regId'] as String? ?? '',
      eventId: map['eventId'] as String? ?? '',
      userId: map['userId'] as String? ?? '',
      status: map['status'] as String? ?? 'pending',
      qrCode: map['qrCode'] as String? ?? '',
      seatNumber: map['seatNumber'] as String? ?? '',
      checkedIn: map['checkedIn'] as bool? ?? false,
      checkedInAt: _parseDateOrNull(map['checkedInAt']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'regId': regId,
      'eventId': eventId,
      'userId': userId,
      'status': status,
      'qrCode': qrCode,
      'seatNumber': seatNumber,
      'checkedIn': checkedIn,
      if (checkedInAt != null) 'checkedInAt': checkedInAt!.toUtc().toIso8601String(),
    };
  }

  static DateTime? _parseDateOrNull(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }
}
