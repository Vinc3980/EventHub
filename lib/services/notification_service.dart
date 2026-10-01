import 'dart:async';

import 'local_db.dart';

/// Local-first notification service.
///
/// Stores notifications in Hive. When Firebase is introduced, this swaps
/// for firebase_messaging while keeping the same UI surface.
class NotificationService {
  NotificationService() : _db = LocalStore.instance;

  final LocalStore _db;

  /// Stream of foreground notification events (for in-app banners).
  final StreamController<Map<String, String>> _foregroundController =
      StreamController<Map<String, String>>.broadcast();

  Stream<Map<String, String>> get onForegroundNotification =>
      _foregroundController.stream;

  /// Save an FCM token to the user's profile (array of tokens).
  Future<void> saveFcmToken(String uid, String token) async {
    final profile = LocalStore.readDoc(_db.users, uid);
    if (profile == null) return;
    final tokens = List<String>.from(profile['fcmTokens'] as List? ?? const []);
    if (!tokens.contains(token)) {
      tokens.add(token);
      await _db.users.put(uid, {...profile, 'fcmTokens': tokens});
    }
  }

  /// Request notification permission. Returns true if granted.
  ///
  /// On Android 13+ this shows the system dialog. On older Android / iOS
  /// it's a no-op that returns true (permission is granted at install).
  Future<bool> requestPermission() async {
    // In local mode this is a no-op. When Firebase is introduced, replace
    // with FirebaseMessaging.instance.requestPermission().
    return true;
  }

  /// Store a notification locally for the in-app notification center.
  Future<void> saveLocal({
    required String uid,
    required String title,
    required String body,
    required String type,
    required String targetId,
  }) async {
    final id = LocalStore.newId();
    await _db.notifications.put(id, {
      'id': id,
      'uid': uid,
      'title': title,
      'body': body,
      'type': type,
      'targetId': targetId,
      'read': false,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Simulate receiving a foreground notification (for local demo).
  void receiveForegroundNotification({
    required String title,
    required String body,
    required String type,
    required String targetId,
  }) {
    _foregroundController.add({
      'title': title,
      'body': body,
      'type': type,
      'targetId': targetId,
    });
  }

  /// Deep-link routing based on notification type.
  static String routeForNotification(String type, String targetId) {
    return switch (type) {
      'new_follower' => '/profile/$targetId',
      'booking_confirmed' => '/booking/$targetId',
      'new_chat_message' => '/chat/$targetId',
      'event_reminder' => '/event/$targetId',
      _ => '/',
    };
  }

  /// Stream of notifications for a user.
  Stream<List<Map<String, dynamic>>> notificationsForUser(String uid) {
    return LocalStore.watchBox(
      _db.notifications,
      where: (n) => n['uid'] == uid,
      sort: (a, b) {
        final da = DateTime.tryParse(a['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final db = DateTime.tryParse(b['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return db.compareTo(da);
      },
    ).map((items) => items.map((e) => e.$2).toList());
  }

  /// Mark a notification as read.
  Future<void> markRead(String notificationId) async {
    final n = LocalStore.readDoc(_db.notifications, notificationId);
    if (n == null) return;
    await _db.notifications.put(notificationId, {...n, 'read': true});
  }

  /// Count of unread notifications for a user.
  int unreadCount(String uid) {
    return _db.notifications.values
        .where((n) => n['uid'] == uid && n['read'] == false)
        .length;
  }

  /// Live stream of the unread notification count for a user.
  ///
  /// Emits immediately on subscription and re-emits whenever the
  /// notifications box changes (e.g. a new notification arrives or an
  /// existing one is marked read).
  Stream<int> unreadCountStream(String uid) {
    return LocalStore.watchBox(
      _db.notifications,
      where: (n) => n['uid'] == uid,
    ).map((items) => items.where((e) => e.$2['read'] == false).length);
  }

  void dispose() {
    _foregroundController.close();
  }
}
