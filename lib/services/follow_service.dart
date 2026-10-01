import '../models/follow_model.dart';
import 'local_db.dart';

/// Manages follow/unfollow relationships between users.
///
/// Uses the `follows` box for relationship storage and updates the
/// follower/following counts on each user's profile atomically.
class FollowService {
  FollowService() : _db = LocalStore.instance;

  final LocalStore _db;

  /// Returns `true` if [followerId] is currently following [targetUserId].
  bool isFollowing(String followerId, String targetUserId) {
    final docId = Follow.docId(followerId, targetUserId);
    return _db.follows.get(docId) != null;
  }

  /// Live stream of whether [followerId] follows [targetUserId].
  Stream<bool> isFollowingStream(String followerId, String targetUserId) {
    return LocalStore.watchBox(
      _db.follows,
      where: (m) => m['followerId'] == followerId && m['targetUserId'] == targetUserId,
    ).map((items) => items.isNotEmpty);
  }

  /// Toggles the follow state. Returns `true` if now following, `false` if unfollowed.
  Future<bool> toggleFollow(String followerId, String targetUserId) async {
    if (followerId == targetUserId) return false; // cannot follow self

    final docId = Follow.docId(followerId, targetUserId);
    final existing = _db.follows.get(docId);

    if (existing != null) {
      // Unfollow
      await _db.follows.delete(docId);
      await _decrementCount(targetUserId, 'followers');
      await _decrementCount(followerId, 'following');
      return false;
    } else {
      // Follow
      final follow = Follow(
        followerId: followerId,
        targetUserId: targetUserId,
        createdAt: DateTime.now(),
      );
      await _db.follows.put(docId, follow.toMap());
      await _incrementCount(targetUserId, 'followers');
      await _incrementCount(followerId, 'following');

      // Send notification to the followed user
      final followerProfile = LocalStore.readDoc(_db.users, followerId);
      final followerName = followerProfile?['name'] as String? ?? 'Someone';
      _saveNotification(
        uid: targetUserId,
        title: 'New follower',
        body: '$followerName started following you.',
        type: 'new_follower',
        targetId: followerId,
      );

      return true;
    }
  }

  /// Returns a live stream of user IDs that [userId] is following.
  Stream<List<String>> followingIds(String userId) {
    return LocalStore.watchBox(
      _db.follows,
      where: (m) => m['followerId'] == userId,
    ).map((items) => items.map((e) => e.$2['targetUserId'] as String).toList());
  }

  /// Returns a live stream of user IDs that follow [userId].
  Stream<List<String>> followerIds(String userId) {
    return LocalStore.watchBox(
      _db.follows,
      where: (m) => m['targetUserId'] == userId,
    ).map((items) => items.map((e) => e.$2['followerId'] as String).toList());
  }

  /// Returns a live stream of full profile maps for users that [userId] follows.
  Stream<List<Map<String, dynamic>>> followingProfiles(String userId) {
    return followingIds(userId).map((ids) {
      return ids.map((id) {
        final doc = LocalStore.readDoc(_db.users, id);
        return doc ?? {'uid': id, 'name': 'User'};
      }).toList();
    });
  }

  /// Returns a live stream of full profile maps for users that follow [userId].
  Stream<List<Map<String, dynamic>>> followerProfiles(String userId) {
    return followerIds(userId).map((ids) {
      return ids.map((id) {
        final doc = LocalStore.readDoc(_db.users, id);
        return doc ?? {'uid': id, 'name': 'User'};
      }).toList();
    });
  }

  /// Returns a list of organizer profiles that [userId] does NOT already follow,
  /// for the "Suggested to follow" section.
  Stream<List<Map<String, dynamic>>> suggestedOrganizers(String currentUserId) {
    return LocalStore.watchBox(
      _db.users,
      where: (user) =>
          (user['roles'] as List? ?? const []).contains('organizer') &&
          user['uid'] != currentUserId,
    ).map((items) {
      final followed = _db.follows.toMap().values
          .where((m) => m['followerId'] == currentUserId)
          .map((m) => m['targetUserId'] as String)
          .toSet();
      return items
          .where((item) => !followed.contains(item.$1))
          .map((item) => item.$2)
          .toList();
    });
  }

  Future<void> _incrementCount(String uid, String field) async {
    final existing = _db.users.get(uid);
    if (existing == null) return;
    final current = (existing[field] as num?)?.toInt() ?? 0;
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      field: current + 1,
    });
  }

  Future<void> _decrementCount(String uid, String field) async {
    final existing = _db.users.get(uid);
    if (existing == null) return;
    final current = (existing[field] as num?)?.toInt() ?? 0;
    await _db.users.put(uid, {
      ...Map<String, dynamic>.from(existing),
      field: (current - 1).clamp(0, 999999),
    });
  }

  void _saveNotification({
    required String uid,
    required String title,
    required String body,
    required String type,
    required String targetId,
  }) {
    final id = LocalStore.newId();
    _db.notifications.put(id, {
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
}
