class Review {
  final String id;
  final String eventId;
  final String organizerId;
  final String attendeeId;
  final int rating;
  final String text;
  final DateTime createdAt;

  const Review({
    required this.id,
    required this.eventId,
    required this.organizerId,
    required this.attendeeId,
    required this.rating,
    this.text = '',
    required this.createdAt,
  });

  factory Review.fromMap(String id, Map<String, dynamic> map) {
    return Review(
      id: id,
      eventId: map['eventId'] as String? ?? '',
      organizerId: map['organizerId'] as String? ?? '',
      attendeeId: map['attendeeId'] as String? ?? '',
      rating: (map['rating'] as num?)?.toInt() ?? 0,
      text: map['text'] as String? ?? '',
      createdAt: _parseDate(map['createdAt']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'eventId': eventId,
      'organizerId': organizerId,
      'attendeeId': attendeeId,
      'rating': rating,
      'text': text,
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }

  static DateTime _parseDate(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }
    return DateTime.fromMillisecondsSinceEpoch(0);
  }
}
