import 'dart:async';

import 'local_db.dart';

/// Local authentication + profile service.
///
/// Mirrors the Firebase Auth API surface so switching to Firebase later
/// only touches this file. Credentials are stored in the `auth` box
/// (plain text — local dev scaffold only, never ship like this).
class AuthService {
  AuthService() : _db = LocalStore.instance;

  final LocalStore _db;
  final StreamController<String?> _authController =
      StreamController<String?>.broadcast();

  /// Emits the signed-in uid, or null when signed out. Emits the persisted
  /// session immediately on subscription (mirrors FirebaseAuth stream).
  Stream<String?> get authStateChanges => Stream.multi((controller) {
        controller.add(_currentUid);
        _authController.stream.listen(controller.add);
      });

  /// Currently signed-in user id from the persisted session.
  String? get currentUid => _currentUid;

  String? get _currentUid => _db.session.get('uid') as String?;

  Future<String> signUpWithEmail({
    required String email,
    required String password,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.contains('@')) {
      throw const AuthException('invalid-email', 'Enter a valid email address.');
    }
    if (password.length < 6) {
      throw const AuthException(
        'weak-password',
        'Password must be at least 6 characters.',
      );
    }
    final authBox = _db.auth;
    final exists = authBox.values.any((entry) =>
        (entry['email'] as String? ?? '').toLowerCase() == cleanEmail);
    if (exists) {
      throw const AuthException(
        'email-already-in-use',
        'An account already exists for this email.',
      );
    }
    final uid = LocalStore.newId();
    await authBox.put(
        uid,
        <String, dynamic>{
          'uid': uid,
          'email': cleanEmail,
          'password': password,
        });
    await _db.session.put('uid', uid);
    _authController.add(uid);
    return uid;
  }

  Future<String> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    final entry = _db.auth.values.firstWhere(
      (e) => (e['email'] as String? ?? '').toLowerCase() == cleanEmail,
      orElse: () => const {},
    );
    if (entry.isEmpty) {
      throw const AuthException(
        'user-not-found',
        'No account found for this email.',
      );
    }
    if (entry['password'] != password) {
      throw const AuthException('wrong-password', 'Incorrect password.');
    }
    final uid = entry['uid'] as String;
    await _db.session.put('uid', uid);
    _authController.add(uid);
    return uid;
  }

  Future<void> signOut() async {
    await _db.session.delete('uid');
    _authController.add(null);
  }

  /// Creates (or completes) the `users/{uid}` record with the chosen roles.
  Future<void> completeProfile({
    required String uid,
    required String name,
    required List<String> roles,
  }) async {
    final existing = _db.users.get(uid);
    if (existing != null) {
      final mergedRoles = {
        ...(existing['roles'] as List? ?? const []).cast<String>(),
        ...roles,
      };
      await _db.users.put(uid, {
        ...Map<String, dynamic>.from(existing),
        'name': name,
        'roles': mergedRoles.toList(),
      });
      return;
    }
    await _db.users.put(uid, {
      'uid': uid,
      'name': name,
      'phone': '',
      'email': _db.auth.get(uid)?['email'] ?? '',
      'roles': roles,
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

  /// Adds a single role without clobbering existing ones (arrayUnion logic).
  Future<void> addRole({
    required String uid,
    required String role,
  }) async {
    final existing = _db.users.get(uid);
    if (existing == null) return;
    final roles = {...(existing['roles'] as List? ?? const []).cast<String>()};
    roles.add(role);
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      'roles': roles.toList(),
    });
  }

  /// Returns the raw profile map, or null if it does not exist yet.
  Future<Map<String, dynamic>?> fetchUserProfile(String uid) async {
    return LocalStore.readDoc(_db.users, uid);
  }

  /// Toggles whether [eventId] is in the user's saved-event list (arrayUnion /
  /// arrayRemove style). Returns the updated list.
  Future<List<String>> toggleSaveEvent(String uid, String eventId) async {
    final existing = _db.users.get(uid);
    if (existing == null) return [];
    final saved = List<String>.from(existing['savedEventIds'] as List? ?? const []);
    if (saved.contains(eventId)) {
      saved.remove(eventId);
    } else {
      saved.add(eventId);
    }
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      'savedEventIds': saved,
    });
    return saved;
  }

  /// Updates editable profile fields (name, phone, bio, avatarUrl).
  Future<void> updateProfile({
    required String uid,
    String? name,
    String? phone,
    String? bio,
    String? avatarUrl,
  }) async {
    final existing = _db.users.get(uid);
    if (existing == null) return;
    final data = Map<String, dynamic>.from(existing);
    if (name != null) data['name'] = name;
    if (phone != null) data['phone'] = phone;
    if (bio != null) data['bio'] = bio;
    if (avatarUrl != null) data['avatarUrl'] = avatarUrl;
    await _db.users.put(uid, data);
  }

  /// Toggles the remindersEnabled preference for the user.
  Future<void> setRemindersEnabled(String uid, bool enabled) async {
    final existing = _db.users.get(uid);
    if (existing == null) return;
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      'remindersEnabled': enabled,
    });
  }

  /// Profile keys accepted by [setNotificationPref]. Kept explicit so a UI
  /// typo can never write an arbitrary profile field.
  static const Set<String> notificationPrefKeys = {
    'messageNotifsEnabled',
    'followerNotifsEnabled',
    'promoNotifsEnabled',
  };

  /// Stores a per-category notification preference on the profile.
  ///
  /// Preference storage only — nothing dispatches push notifications for
  /// these categories yet (see `notification_service.dart`, which records
  /// in-app notification rows).
  Future<void> setNotificationPref(String uid, String key, bool value) async {
    if (!notificationPrefKeys.contains(key)) return;
    final existing = _db.users.get(uid);
    if (existing == null) return;
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      key: value,
    });
  }

  /// Adds [targetUid] to the signed-in user's blocked list (arrayUnion
  /// style). Returns the updated list.
  Future<List<String>> blockUser(String uid, String targetUid) async {
    final existing = _db.users.get(uid);
    if (existing == null || targetUid.isEmpty) return const [];
    final blocked =
        List<String>.from(existing['blockedUids'] as List? ?? const []);
    if (!blocked.contains(targetUid)) blocked.add(targetUid);
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      'blockedUids': blocked,
    });
    return blocked;
  }

  /// Removes [targetUid] from the signed-in user's blocked list.
  Future<List<String>> unblockUser(String uid, String targetUid) async {
    final existing = _db.users.get(uid);
    if (existing == null) return const [];
    final blocked =
        List<String>.from(existing['blockedUids'] as List? ?? const []);
    blocked.remove(targetUid);
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      'blockedUids': blocked,
    });
    return blocked;
  }

  /// Whether [uid] has blocked [targetUid].
  bool hasBlocked(String uid, String targetUid) {
    final existing = _db.users.get(uid);
    if (existing == null) return false;
    final blocked =
        List<String>.from(existing['blockedUids'] as List? ?? const []);
    return blocked.contains(targetUid);
  }

  /// Saves the Mobile Money wallet the user wants to pay with.
  Future<void> setSavedMomo(
    String uid, {
    required String number,
    required String network,
  }) async {
    final existing = _db.users.get(uid);
    if (existing == null) return;
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      'savedMomoNumber': number,
      'savedMomoNetwork': network,
    });
  }

  /// Verifies [currentPassword] against the stored credential, then swaps in
  /// [newPassword] (same >= 6 character rule as signup).
  ///
  /// Passwords are stored plain text in the auth box — see class doc; hashing
  /// is a separate security task.
  Future<void> changePassword({
    required String uid,
    required String currentPassword,
    required String newPassword,
  }) async {
    final entry = _db.auth.get(uid);
    if (entry == null || entry.isEmpty) {
      throw const AuthException(
          'user-not-found', 'No account found for this user.');
    }
    if (entry['password'] != currentPassword) {
      throw const AuthException(
          'wrong-password', 'Current password is incorrect.');
    }
    if (newPassword.length < 6) {
      throw const AuthException(
          'weak-password', 'Password must be at least 6 characters.');
    }
    await _db.auth.put(uid, {
      ...Map<String, dynamic>.from(entry),
      'password': newPassword,
    });
  }

  /// Live stream of organizer profiles (users whose `roles` include
  /// "organizer"), used by the "Organizers near you" stories row.
  Stream<List<Map<String, dynamic>>> organizerProfiles() {
    return LocalStore.watchBox(
      _db.users,
      where: (user) =>
          (user['roles'] as List? ?? const []).contains('organizer'),
      sort: (a, b) {
        final na = (a['name'] as String? ?? '').toLowerCase();
        final nb = (b['name'] as String? ?? '').toLowerCase();
        return na.compareTo(nb);
      },
    ).map((items) => items.map((e) => e.$2).toList());
  }

  static String friendlyMessage(Object? error) {
    if (error is AuthException) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }
}

/// Local analogue of FirebaseAuthException.
class AuthException implements Exception {
  const AuthException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => message;
}
