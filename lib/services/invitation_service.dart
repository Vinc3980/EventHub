/// Sends invitations to guests for an event.
class InvitationService {
  /// In-app notifications to followers of the event owner.
  ///
  /// Local stub: no-op (there is no push channel yet). When Firebase lands,
  /// this calls the `notifyFollowers` Cloud Function (FCM).
  Future<void> notifyFollowers(String eventId) async {
    // TODO(Firebase): call the notifyFollowers Cloud Function here.
    return;
  }

  /// Bulk SMS invites.
  ///
  /// TODO: Wire a real SMS gateway such as Hubtel or Africa's Talking
  /// server-side before this is safe to call. The gateway credentials MUST
  /// live server-side, never in the client. Until then this throws.
  Future<void> sendBulkSmsInvites({
    required String eventId,
    required List<String> phoneNumbers,
  }) {
    throw UnimplementedError(
      'SMS invites need a real SMS gateway (Hubtel / Africa\'s Talking) '
      'wired server-side before use.',
    );
  }

  /// Placeholder RSVP deep link. Replace with the real short-link service
  /// (e.g. Firebase Dynamic Links) before launch.
  String generateRsvpLink(String eventId) {
    return 'https://eventhub.app/r/event/$eventId';
  }
}
