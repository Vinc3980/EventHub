class EventScheduleItem {
  final String id;
  final String eventId;
  final String title;
  final String description;
  final DateTime startTime;
  final DateTime endTime;
  final String location;
  final int order;

  const EventScheduleItem({
    required this.id,
    required this.eventId,
    required this.title,
    this.description = '',
    required this.startTime,
    required this.endTime,
    this.location = '',
    this.order = 0,
  });

  factory EventScheduleItem.fromMap(String id, Map<String, dynamic> map) {
    return EventScheduleItem(
      id: id,
      eventId: map['eventId'] as String? ?? '',
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      startTime: _parseDate(map['startTime']),
      endTime: _parseDate(map['endTime']),
      location: map['location'] as String? ?? '',
      order: (map['order'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'eventId': eventId,
      'title': title,
      'description': description,
      'startTime': startTime.toUtc().toIso8601String(),
      'endTime': endTime.toUtc().toIso8601String(),
      'location': location,
      'order': order,
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