/// A contact an organizer pre-loads for an event (e.g. from a CSV) before
/// invitations are sent. Stored in Firestore at `guestList/{entryId}`.
class GuestListEntry {
  final String id;
  final String eventId;
  final String name;
  final String phone;
  final String role;
  final String avatarUrl;
  final String notes;
  final String inviteChannel;
  final String rsvpStatus;

  const GuestListEntry({
    required this.id,
    required this.eventId,
    required this.name,
    required this.phone,
    this.role = '',
    this.avatarUrl = '',
    this.notes = '',
    this.inviteChannel = 'link',
    this.rsvpStatus = 'pending',
  });

  factory GuestListEntry.fromMap(String id, Map<String, dynamic> map) {
    return GuestListEntry(
      id: id,
      eventId: map['eventId'] as String? ?? '',
      name: map['name'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      role: map['role'] as String? ?? '',
      avatarUrl: map['avatarUrl'] as String? ?? '',
      notes: map['notes'] as String? ?? '',
      inviteChannel: map['inviteChannel'] as String? ?? 'link',
      rsvpStatus: map['rsvpStatus'] as String? ?? 'pending',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'eventId': eventId,
      'name': name,
      'phone': phone,
      'role': role,
      'avatarUrl': avatarUrl,
      'notes': notes,
      'inviteChannel': inviteChannel,
      'rsvpStatus': rsvpStatus,
    };
  }
}
