import 'dart:math';

import 'package:hive_flutter/hive_flutter.dart';

/// Local-first persistence layer (Hive).
///
/// Each Firestore collection gets a Hive box with the same name, keyed by
/// document id. When Firebase is introduced, services swap these boxes for
/// Firestore references without changing models or screens.
///
/// Boxes: session, auth, users, events, guestList, registrations, bookings,
/// payments, posts, chats, messages, reviews, reports, notifications,
/// invitedGuests, promotions, payoutAccounts, eventSchedules.
class LocalStore {
  LocalStore._();

  static final LocalStore instance = LocalStore._();

  static const List<String> boxNames = [
    'session',
    'auth',
    'users',
    'events',
    'guestList',
    'registrations',
    'bookings',
    'payments',
    'posts',
    'chats',
    'messages',
    'reviews',
    'reports',
    'notifications',
    'invitedGuests',
    'promotions',
    'payoutAccounts',
    'discountCodes',
    'waitlist',
    'refunds',
    'follows',
    'eventSchedules',
  ];

  late final Box<dynamic> session;
  late final Box<Map> auth;
  late final Box<Map> users;
  late final Box<Map> events;
  late final Box<Map> guestList;
  late final Box<Map> registrations;
  late final Box<Map> bookings;
  late final Box<Map> payments;
  late final Box<Map> posts;
  late final Box<Map> chats;
  late final Box<Map> messages;
  late final Box<Map> reviews;
  late final Box<Map> reports;
  late final Box<Map> notifications;
  late final Box<Map> invitedGuests;
  late final Box<Map> promotions;
  late final Box<Map> payoutAccounts;
  late final Box<Map> discountCodes;
  late final Box<Map> waitlist;
  late final Box<Map> refunds;
  late final Box<Map> follows;
  late final Box<Map> eventSchedules;

  /// Call once before runApp.
  static Future<void> init() async {
    await Hive.initFlutter();
    final store = instance;
    for (final name in boxNames) {
      if (name == 'session') {
        store.session = await Hive.openBox<dynamic>(name);
        continue;
      }
      final box = await Hive.openBox<Map>(name);
      switch (name) {
        case 'auth':
          store.auth = box;
        case 'users':
          store.users = box;
        case 'events':
          store.events = box;
        case 'guestList':
          store.guestList = box;
        case 'registrations':
          store.registrations = box;
        case 'bookings':
          store.bookings = box;
        case 'payments':
          store.payments = box;
        case 'posts':
          store.posts = box;
        case 'chats':
          store.chats = box;
        case 'messages':
          store.messages = box;
        case 'reviews':
          store.reviews = box;
        case 'reports':
          store.reports = box;
        case 'notifications':
          store.notifications = box;
        case 'invitedGuests':
          store.invitedGuests = box;
        case 'promotions':
          store.promotions = box;
        case 'payoutAccounts':
          store.payoutAccounts = box;
        case 'discountCodes':
          store.discountCodes = box;
        case 'waitlist':
          store.waitlist = box;
        case 'refunds':
          store.refunds = box;
        case 'follows':
          store.follows = box;
        case 'eventSchedules':
          store.eventSchedules = box;
      }
    }

    _seedAdmin();
  }

  static const String adminUid = 'admin-001';
  static const String adminEmail = 'admin@eventhub.app';
  static const String adminPassword = 'admin123';

  /// Pre-seeds a built-in admin account so the admin can log in directly
  /// from the login screen without going through role selection.
  static void _seedAdmin() {
    final store = instance;
    final existing = store.auth.get(adminUid);
    if (existing == null) {
      store.auth.put(adminUid, {
        'uid': adminUid,
        'email': adminEmail,
        'password': adminPassword,
      });
    }
    final profile = store.users.get(adminUid);
    if (profile == null) {
      store.users.put(adminUid, {
        'uid': adminUid,
        'name': 'Admin',
        'phone': '',
        'email': adminEmail,
        'roles': ['admin'],
        'bio': '',
        'avatarUrl': '',
        'followers': 0,
        'following': 0,
        'savedEventIds': <String>[],
        'remindersEnabled': true,
        'messageNotifsEnabled': true,
        'followerNotifsEnabled': true,
        'promoNotifsEnabled': false,
        'blockedUids': <String>[],
        'savedMomoNumber': '',
        'savedMomoNetwork': '',
        'createdAt': DateTime.now().toUtc().toIso8601String(),
      });
    }
  }

  /// Generates a unique document-style id (timestamp + random suffix).
  static String newId() {
    final rand = Random();
    return '${DateTime.now().microsecondsSinceEpoch}'
        '_${rand.nextInt(1 << 32).toRadixString(36)}';
  }

  /// Returns a live stream of the box's entries (id key + data map), filtered
  /// and sorted, emitting the current contents immediately on subscription and
  /// re-emitting on any box change. Mirrors a Firestore `.snapshots()` query.
  static Stream<List<(String, Map<String, dynamic>)>> watchBox(
    Box<Map> box, {
    bool Function(Map<String, dynamic>)? where,
    int Function(Map<String, dynamic>, Map<String, dynamic>)? sort,
  }) {
    List<(String, Map<String, dynamic>)> snapshot() {
      final items = box.toMap().entries.map((entry) {
        return (entry.key as String, Map<String, dynamic>.from(entry.value));
      }).where((e) => where?.call(e.$2) ?? true).toList();
      if (sort != null) {
        items.sort((a, b) => sort(a.$2, b.$2));
      }
      return items;
    }

    return Stream.multi((controller) {
      controller.add(snapshot());
      final subscription = box.watch().listen((_) => controller.add(snapshot()));
      controller.onCancel = subscription.cancel;
    });
  }

  /// Reads a single record as a typed map, or null when missing.
  static Map<String, dynamic>? readDoc(Box<Map> box, String id) {
    final value = box.get(id);
    return value == null ? null : Map<String, dynamic>.from(value);
  }

  /// Writes a record (id key, map value).
  static Future<void> writeDoc(Box<Map> box, String id, Map<String, dynamic> data) {
    return box.put(id, data);
  }
}
