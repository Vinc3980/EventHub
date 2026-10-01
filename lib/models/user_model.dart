/// App user profile. Stored locally in the `users` box (Firestore `users/{uid}`
/// when Firebase is introduced).
class User {
  final String uid;
  final String name;
  final String phone;
  final String email;
  final List<String> roles; // attendee | organizer | admin
  final String bio;
  final String avatarUrl;
  final String bannerUrl;
  final int followers;
  final int following;
  final DateTime createdAt;
  final List<String> savedEventIds;
  final bool remindersEnabled;

  const User({
    required this.uid,
    required this.name,
    this.phone = '',
    this.email = '',
    this.roles = const [],
    this.bio = '',
    this.avatarUrl = '',
    this.bannerUrl = '',
    this.followers = 0,
    this.following = 0,
    required this.createdAt,
    this.savedEventIds = const [],
    this.remindersEnabled = true,
  });

  bool get isOrganizer => roles.contains('organizer');
  bool get isAdmin => roles.contains('admin');

  factory User.fromMap(String id, Map<String, dynamic> map) {
    return User(
      uid: map['uid'] as String? ?? id,
      name: map['name'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      email: map['email'] as String? ?? '',
      roles: List<String>.from(map['roles'] as List? ?? const []),
      bio: map['bio'] as String? ?? '',
      avatarUrl: map['avatarUrl'] as String? ?? '',
      bannerUrl: map['bannerUrl'] as String? ?? '',
      followers: (map['followers'] as num?)?.toInt() ?? 0,
      following: (map['following'] as num?)?.toInt() ?? 0,
      createdAt: _parseDate(map['createdAt']),
      savedEventIds: List<String>.from(map['savedEventIds'] as List? ?? const []),
      remindersEnabled: map['remindersEnabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'name': name,
      'phone': phone,
      'email': email,
      'roles': roles,
      'bio': bio,
      'avatarUrl': avatarUrl,
      'bannerUrl': bannerUrl,
      'followers': followers,
      'following': following,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'savedEventIds': savedEventIds,
      'remindersEnabled': remindersEnabled,
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
