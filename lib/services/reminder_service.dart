import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import 'local_db.dart';

/// Schedules and manages local reminder notifications for upcoming events.
///
/// Reminders are sent 24 hours before the event start time. If the event is
/// less than 24 hours away, the reminder fires immediately (with a 5-second
/// grace period so the user sees a confirmation snackbar first).
class ReminderService {
  ReminderService();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  bool _initialised = false;

  /// Must be called once before any scheduling. Idempotent.
  Future<void> init() async {
    if (_initialised) return;
    tz.initializeTimeZones();
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _plugin.initialize(settings);
    _initialised = true;
  }

  /// Schedules a local notification 24 h before [eventDate].
  ///
  /// The notification id is derived from the booking id so each booking gets
  /// at most one reminder. If the event is < 24 h away the notification fires
  /// after a short delay instead.
  ///
  /// If the user has disabled reminders (remindersEnabled == false), the
  /// notification is not scheduled.
  Future<void> scheduleEventReminder({
    required String bookingId,
    required String eventTitle,
    required DateTime eventDate,
    String? userId,
  }) async {
    // Check user's reminder preference.
    if (userId != null) {
      final user = LocalStore.readDoc(LocalStore.instance.users, userId);
      if (user != null && user['remindersEnabled'] == false) return;
    }
    await init();
    final id = _notificationId(bookingId);
    await _plugin.cancel(id); // idempotent

    final scheduledTime = eventDate.subtract(const Duration(hours: 24));
    final now = DateTime.now();

    if (scheduledTime.isAfter(now)) {
      final tzScheduled = tz.TZDateTime.from(scheduledTime, tz.local);
      await _plugin.zonedSchedule(
        id,
        'Upcoming: $eventTitle',
        'Your event starts in 24 hours.',
        tzScheduled,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'eventhub_reminders',
            'Event Reminders',
            channelDescription: 'Reminders for upcoming events',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
    } else {
      // Event is sooner than 24 h — fire after a brief delay.
      // ignore: unawaited_futures
      Future.delayed(const Duration(seconds: 5), () async {
        await _plugin.show(
          id,
          'Upcoming: $eventTitle',
          'Your event is starting soon!',
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'eventhub_reminders',
              'Event Reminders',
              channelDescription: 'Reminders for upcoming events',
              importance: Importance.high,
              priority: Priority.high,
            ),
            iOS: DarwinNotificationDetails(),
          ),
        );
      });
    }
  }

  /// Cancels a previously-scheduled reminder for the given booking.
  Future<void> cancelReminder(String bookingId) async {
    await init();
    await _plugin.cancel(_notificationId(bookingId));
  }

  /// Deterministic notification id from booking id.
  int _notificationId(String bookingId) {
    return bookingId.hashCode & 0x7FFFFFFF;
  }
}
