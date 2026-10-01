/// A plus-one linked to a booking. Stored at `invitedGuests/{guestId}`.
class InvitedGuest {
  final String id;
  final String bookingId;
  final String name;
  final bool joinedChat;

  const InvitedGuest({
    required this.id,
    required this.bookingId,
    required this.name,
    this.joinedChat = false,
  });

  factory InvitedGuest.fromMap(String id, Map<String, dynamic> map) {
    return InvitedGuest(
      id: id,
      bookingId: map['bookingId'] as String? ?? '',
      name: map['name'] as String? ?? '',
      joinedChat: map['joinedChat'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'bookingId': bookingId,
      'name': name,
      'joinedChat': joinedChat,
    };
  }
}
