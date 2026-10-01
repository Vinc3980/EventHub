/// A single chat message. Stored locally in the `messages` box (Firestore
/// `chats/{chatId}/messages/{messageId}` when Firebase is introduced).
class Message {
  final String id;
  final String chatId;
  final String senderId;
  final String text;
  final DateTime sentAt;
  final bool pinned;

  /// Uids that have opened/viewed the chat since this message was sent.
  final List<String> readBy;

  /// Optional quoted-reply link: id of the message being replied to.
  final String? replyToMessageId;

  /// Snapshot of the replied-to message's text for compact preview rendering.
  final String? replyToPreview;

  const Message({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.text,
    required this.sentAt,
    this.pinned = false,
    this.readBy = const [],
    this.replyToMessageId,
    this.replyToPreview,
  });

  factory Message.fromMap(String id, Map<String, dynamic> map) {
    return Message(
      id: id,
      chatId: map['chatId'] as String? ?? '',
      senderId: map['senderId'] as String? ?? '',
      text: map['text'] as String? ?? '',
      sentAt: _parseDate(map['sentAt']),
      pinned: map['pinned'] as bool? ?? false,
      readBy: List<String>.from(map['readBy'] as List? ?? const []),
      replyToMessageId: map['replyToMessageId'] as String?,
      replyToPreview: map['replyToPreview'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'chatId': chatId,
      'senderId': senderId,
      'text': text,
      'sentAt': sentAt.toUtc().toIso8601String(),
      'pinned': pinned,
      'readBy': readBy,
      if (replyToMessageId != null) 'replyToMessageId': replyToMessageId,
      if (replyToPreview != null) 'replyToPreview': replyToPreview,
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
