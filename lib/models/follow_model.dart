/// Represents a follow relationship between two users.
///
/// Stored in the `follows` box. Keyed by `followerId_targetUserId` to prevent
/// duplicates. Mirrors a Firestore `follows/{followerId}_{targetUserId}` doc.
class Follow {
  final String followerId;
  final String targetUserId;
  final DateTime createdAt;

  const Follow({
    required this.followerId,
    required this.targetUserId,
    required this.createdAt,
  });

  factory Follow.fromMap(String id, Map<String, dynamic> map) {
    return Follow(
      followerId: map['followerId'] as String? ?? '',
      targetUserId: map['targetUserId'] as String? ?? '',
      createdAt: _parseDate(map['createdAt']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'followerId': followerId,
      'targetUserId': targetUserId,
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }

  static String docId(String followerId, String targetUserId) =>
      '${followerId}_$targetUserId';

  static DateTime _parseDate(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }
    return DateTime.fromMillisecondsSinceEpoch(0);
  }
}
