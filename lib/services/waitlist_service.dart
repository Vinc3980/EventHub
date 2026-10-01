import 'package:hive_flutter/hive_flutter.dart';

import '../models/waitlist_entry_model.dart';
import 'local_db.dart';
import 'notification_service.dart';

class WaitlistService {
  WaitlistService()
      : _db = LocalStore.instance,
        _notificationService = NotificationService();

  final LocalStore _db;
  final NotificationService _notificationService;

  Box<Map> get _box => _db.waitlist;

  /// Adds the user to the waitlist for a specific event tier.
  /// Returns the position (1-indexed) in the queue.
  Future<int> joinWaitlist(WaitlistEntry entry) async {
    final id = LocalStore.newId();
    await _box.put(id, entry.toMap());

    // Count how many people are ahead (waiting entries with earlier joinedAt).
    int position = 1;
    for (final e in _box.values) {
      final data = Map<String, dynamic>.from(e);
      if (data['eventId'] != entry.eventId) continue;
      if (data['tierName'] != entry.tierName) continue;
      if (data['status'] != 'waiting') continue;
      final eJoined = data['joinedAt'] as String? ?? '';
      if (eJoined.compareTo(entry.joinedAt) < 0) {
        position++;
      }
    }
    return position;
  }

  /// Live stream of waitlist entries for a specific event tier, ordered by
  /// joinedAt (first-come-first-served).
  Stream<List<WaitlistEntry>> waitlistForEvent(
      String eventId, String tierName) {
    return LocalStore.watchBox(
      _box,
      where: (entry) =>
          entry['eventId'] == eventId && entry['tierName'] == tierName,
      sort: (a, b) {
        final ja = a['joinedAt'] as String? ?? '';
        final jb = b['joinedAt'] as String? ?? '';
        return ja.compareTo(jb);
      },
    ).map((items) =>
        items.map((e) => WaitlistEntry.fromMap(e.$1, e.$2)).toList());
  }

  /// Finds the oldest 'waiting' entry for the given tier, marks it as
  /// 'notified', and triggers a local notification.
  Future<void> notifyNextInLine(String eventId, String tierName) async {
    for (final entry in _box.toMap().entries) {
      final data = Map<String, dynamic>.from(entry.value);
      if (data['eventId'] != eventId) continue;
      if (data['tierName'] != tierName) continue;
      if (data['status'] != 'waiting') continue;

      // Found the oldest waiting entry.
      await _box.put(entry.key, {...data, 'status': 'notified'});

      final userId = data['userId'] as String? ?? '';
      if (userId.isNotEmpty) {
        final event = LocalStore.readDoc(_db.events, eventId);
        final eventTitle = event?['title'] as String? ?? 'the event';

        await _notificationService.saveLocal(
          uid: userId,
          title: 'Spot available!',
          body: 'A spot just opened up for $tierName at $eventTitle. '
              'Register now before it fills up again.',
          type: 'waitlist_spot_available',
          targetId: eventId,
        );

        // Also trigger an in-app foreground notification banner.
        _notificationService.receiveForegroundNotification(
          title: 'Spot available!',
          body: 'A spot just opened up for $tierName at $eventTitle.',
          type: 'waitlist_spot_available',
          targetId: eventId,
        );
      }

      // Only notify the first person in line.
      return;
    }
  }
}
