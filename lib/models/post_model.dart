/// A social feed post. Stored locally in the `posts` box (Firestore
/// `posts/{postId}` when Firebase is introduced).
class Post {
  final String id;
  final String authorId;
  final String? eventId;
  final String text;
  final List<String> mediaUrls;
  final int likes;
  final int commentCount;
  final DateTime postedAt;

  const Post({
    required this.id,
    required this.authorId,
    this.eventId,
    this.text = '',
    this.mediaUrls = const [],
    this.likes = 0,
    this.commentCount = 0,
    required this.postedAt,
  });

  factory Post.fromMap(String id, Map<String, dynamic> map) {
    return Post(
      id: id,
      authorId: map['authorId'] as String? ?? '',
      eventId: map['eventId'] as String?,
      text: map['text'] as String? ?? '',
      mediaUrls: List<String>.from(map['mediaUrls'] as List? ?? const []),
      likes: (map['likes'] as num?)?.toInt() ?? 0,
      commentCount: (map['commentCount'] as num?)?.toInt() ?? 0,
      postedAt: _parseDate(map['postedAt']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'authorId': authorId,
      if (eventId != null) 'eventId': eventId,
      'text': text,
      'mediaUrls': mediaUrls,
      'likes': likes,
      'commentCount': commentCount,
      'postedAt': postedAt.toUtc().toIso8601String(),
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
