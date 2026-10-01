import 'dart:async';

import '../models/event_schedule_model.dart';
import 'local_db.dart';

class EventScheduleService {
  EventScheduleService() : _db = LocalStore.instance;

  final LocalStore _db;

  Future<void> addScheduleItem(EventScheduleItem item) async {
    final id = LocalStore.newId();
    await _db.eventSchedules.put(id, item.toMap());
  }

  Stream<List<EventScheduleItem>> scheduleForEvent(String eventId) {
    return LocalStore.watchBox(
      _db.eventSchedules,
      where: (item) => item['eventId'] == eventId,
      sort: (a, b) {
        final timeA = DateTime.tryParse(a['startTime'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final timeB = DateTime.tryParse(b['startTime'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return timeA.compareTo(timeB);
      },
    ).map((items) =>
        items.map((e) => EventScheduleItem.fromMap(e.$1, e.$2)).toList());
  }

  Future<void> updateScheduleItem(String itemId, EventScheduleItem item) async {
    await _db.eventSchedules.put(itemId, item.toMap());
  }

  Future<void> deleteScheduleItem(String itemId) async {
    await _db.eventSchedules.delete(itemId);
  }
}