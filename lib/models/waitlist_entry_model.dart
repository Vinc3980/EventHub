class WaitlistEntry {
  final String id;
  final String eventId;
  final String tierName;
  final String userId;
  final String joinedAt;
  final String status; // 'waiting' | 'notified' | 'expired'

  const WaitlistEntry({
    required this.id,
    required this.eventId,
    required this.tierName,
    required this.userId,
    required this.joinedAt,
    this.status = 'waiting',
  });

  factory WaitlistEntry.fromMap(String id, Map<String, dynamic> map) {
    return WaitlistEntry(
      id: id,
      eventId: map['eventId'] as String? ?? '',
      tierName: map['tierName'] as String? ?? '',
      userId: map['userId'] as String? ?? '',
      joinedAt: map['joinedAt'] as String? ?? '',
      status: map['status'] as String? ?? 'waiting',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'eventId': eventId,
      'tierName': tierName,
      'userId': userId,
      'joinedAt': joinedAt,
      'status': status,
    };
  }
}
