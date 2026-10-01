import '../models/message_model.dart';
import 'local_db.dart';

/// Event group chats stored locally in the `chats` and `messages` boxes.
///
/// A chat record carries `eventId`, `memberIds` (uid array), `type` (group/1:1),
/// `createdBy`, `readOnly`, and `lastReadAt` (map of uid -> ISO timestamp).
/// Membership is granted when a booking is confirmed (see RegistrationService).
class ChatService {
  ChatService() : _db = LocalStore.instance;

  final LocalStore _db;

  /// Returns the chat id for an event, or null if none exists yet.
  Future<String?> findChatForEvent(String eventId) async {
    for (final entry in _db.chats.toMap().entries) {
      if (entry.value['eventId'] == eventId) return entry.key;
    }
    return null;
  }

  /// Returns the raw chat record for a chat id, or null.
  Map<String, dynamic>? getChat(String chatId) {
    return LocalStore.readDoc(_db.chats, chatId);
  }

  /// Creates a new group chat for an event, or adds the user to an existing one.
  Future<String> ensureChatForEvent({
    required String eventId,
    required String userId,
    required String? ownerId,
  }) async {
    final existingId = await findChatForEvent(eventId);
    if (existingId != null) {
      final chat = LocalStore.readDoc(_db.chats, existingId)!;
      final members = <String>{
        ...((chat['memberIds'] as List?)?.cast<String>() ?? const <String>[]),
        userId,
      };
      await _db.chats.put(existingId, {...chat, 'memberIds': members.toList()});
      return existingId;
    }
    final id = LocalStore.newId();
    await _db.chats.put(id, {
      'eventId': eventId,
      'memberIds': [
        if (ownerId != null && ownerId.isNotEmpty) ownerId,
        userId,
      ],
      'type': 'group',
      'createdBy': ownerId ?? userId,
      'readOnly': false,
      'lastReadAt': <String, dynamic>{},
    });
    return id;
  }

  /// Returns all chats where the current user is a member, most recent
  /// message first.
  Stream<List<Map<String, dynamic>>> chatsForUser(String userId) {
    return LocalStore.watchBox(
      _db.chats,
      where: (chat) =>
          (chat['memberIds'] as List? ?? const []).contains(userId),
    ).map((items) {
      final list = items.map((e) {
        final data = Map<String, dynamic>.from(e.$2);
        data['id'] = e.$1;
        return data;
      }).toList();
      list.sort((a, b) {
        final aTime = _lastMessageTime(a['id'] as String);
        final bTime = _lastMessageTime(b['id'] as String);
        return bTime.compareTo(aTime);
      });
      return list;
    });
  }

  DateTime _lastMessageTime(String chatId) {
    DateTime latest = DateTime.fromMillisecondsSinceEpoch(0);
    for (final entry in _db.messages.toMap().entries) {
      if (entry.value['chatId'] == chatId) {
        final t = DateTime.tryParse(entry.value['sentAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        if (t.isAfter(latest)) latest = t;
      }
    }
    return latest;
  }

  /// Returns the last message for a chat (for preview).
  Message? lastMessageForChat(String chatId) {
    Message? latest;
    for (final entry in _db.messages.toMap().entries) {
      if (entry.value['chatId'] == chatId) {
        final msg = Message.fromMap(
            entry.key, Map<String, dynamic>.from(entry.value));
        if (latest == null || msg.sentAt.isAfter(latest.sentAt)) {
          latest = msg;
        }
      }
    }
    return latest;
  }

  /// Marks a chat as read by the given user at the current time.
  Future<void> markRead(String chatId, String userId) async {
    final chat = LocalStore.readDoc(_db.chats, chatId);
    if (chat == null) return;
    final lastReadAt = Map<String, dynamic>.from(
        (chat['lastReadAt'] as Map?)?.cast<String, dynamic>() ?? {});
    lastReadAt[userId] = DateTime.now().toUtc().toIso8601String();
    await _db.chats.put(chatId, {...chat, 'lastReadAt': lastReadAt});
  }

  /// Adds [userId] to every incoming message's `readBy` list (messages they
  /// did not send and haven't been counted on yet). Drives per-message
  /// delivery/read ticks on the sender's side.
  Future<void> markThreadRead(String chatId, String userId) async {
    for (final entry in _db.messages.toMap().entries) {
      final msg = Map<String, dynamic>.from(entry.value);
      if (msg['chatId'] != chatId || msg['senderId'] == userId) continue;
      final readBy = List<String>.from(msg['readBy'] as List? ?? const []);
      if (readBy.contains(userId)) continue;
      readBy.add(userId);
      await _db.messages.put(entry.key, {...msg, 'readBy': readBy});
    }
  }

  /// Toggles this user's per-chat mute preference (`mutedBy` uid list).
  Future<void> toggleMute(String chatId, String userId) async {
    final chat = LocalStore.readDoc(_db.chats, chatId);
    if (chat == null) return;
    final mutedBy = List<String>.from(chat['mutedBy'] as List? ?? const []);
    if (mutedBy.contains(userId)) {
      mutedBy.remove(userId);
    } else {
      mutedBy.add(userId);
    }
    await _db.chats.put(chatId, {...chat, 'mutedBy': mutedBy});
  }

  /// Whether this user has muted the chat.
  bool isMuted(String chatId, String userId) {
    final chat = LocalStore.readDoc(_db.chats, chatId);
    if (chat == null) return false;
    return (chat['mutedBy'] as List? ?? const []).contains(userId);
  }

  /// Returns true if there are messages newer than the user's lastReadAt.
  bool hasUnread(String chatId, String userId) {
    final chat = LocalStore.readDoc(_db.chats, chatId);
    if (chat == null) return false;
    final lastReadAtMap = (chat['lastReadAt'] as Map?)?.cast<String, dynamic>();
    final readTime = lastReadAtMap != null
        ? DateTime.tryParse(lastReadAtMap[userId] as String? ?? '')
        : null;
    if (readTime == null) {
      return _db.messages.toMap().values
          .any((m) => m['chatId'] == chatId && m['senderId'] != userId);
    }
    return _db.messages.toMap().values.any((m) {
      if (m['chatId'] != chatId || m['senderId'] == userId) return false;
      final t = DateTime.tryParse(m['sentAt'] as String? ?? '');
      return t != null && t.isAfter(readTime);
    });
  }

  /// Returns the event title for a chat.
  String? eventTitleForChat(String chatId) {
    final chat = LocalStore.readDoc(_db.chats, chatId);
    if (chat == null) return null;
    final eventId = chat['eventId'] as String?;
    if (eventId == null) return null;
    final event = LocalStore.readDoc(_db.events, eventId);
    return event?['title'] as String?;
  }

  /// Returns the event cover image URL for a chat (empty string if the
  /// chat has no event or the event has no cover). Display-only helper
  /// mirroring [eventTitleForChat].
  String eventCoverForChat(String chatId) {
    final chat = LocalStore.readDoc(_db.chats, chatId);
    if (chat == null) return '';
    final eventId = chat['eventId'] as String?;
    if (eventId == null) return '';
    final event = LocalStore.readDoc(_db.events, eventId);
    return event?['coverImageUrl'] as String? ?? '';
  }

  /// Returns user name by uid.
  String userName(String uid) {
    final user = LocalStore.readDoc(_db.users, uid);
    return user?['name'] as String? ?? 'Unknown';
  }

  /// Returns user avatar URL by uid (empty string when unset). Display-only
  /// helper mirroring [userName].
  String userAvatarUrl(String uid) {
    final user = LocalStore.readDoc(_db.users, uid);
    return user?['avatarUrl'] as String? ?? '';
  }

  /// Toggles the pinned state of a message.
  Future<void> togglePin(String messageId) async {
    final msg = LocalStore.readDoc(_db.messages, messageId);
    if (msg == null) return;
    await _db.messages.put(messageId, {
      ...msg,
      'pinned': !(msg['pinned'] as bool? ?? false),
    });
  }

  Future<void> sendMessage(String chatId, Message message) async {
    final id = LocalStore.newId();
    await _db.messages.put(id, message.toMap());
  }

  Stream<List<Message>> messagesForChat(String chatId) {
    return LocalStore.watchBox(
      _db.messages,
      where: (message) => message['chatId'] == chatId,
      sort: (a, b) {
        final sa = DateTime.tryParse(a['sentAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final sb = DateTime.tryParse(b['sentAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return sa.compareTo(sb);
      },
    ).map((items) => items.map((e) => Message.fromMap(e.$1, e.$2)).toList());
  }
}
