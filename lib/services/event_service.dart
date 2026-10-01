import 'dart:io';

import 'package:csv/csv.dart';
import 'package:path_provider/path_provider.dart';

import '../models/event_model.dart';
import 'local_db.dart';

/// Reads and writes events in local storage (`events` box).
///
/// Swapping these methods for Firestore queries later is a drop-in change.
class EventService {
  EventService() : _db = LocalStore.instance;

  final LocalStore _db;

  Future<String> createEvent(Event event) async {
    final id = LocalStore.newId();
    await _db.events.put(id, {...event.toMap(), 'status': 'pending_review'});
    return id;
  }

  Future<String> saveDraft(Event event) async {
    if (event.id.isNotEmpty && LocalStore.readDoc(_db.events, event.id) != null) {
      await _db.events.put(event.id, {...event.toMap(), 'status': 'draft'});
      return event.id;
    }
    final id = LocalStore.newId();
    await _db.events.put(id, {...event.toMap(), 'status': 'draft'});
    return id;
  }

  Future<void> submitForReview(String eventId) async {
    final doc = LocalStore.readDoc(_db.events, eventId);
    if (doc == null) return;
    await _db.events.put(eventId, {...doc, 'status': 'pending_review'});
  }

  Future<void> approveEvent(String eventId) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;
    await _db.events.put(eventId, {...event, 'status': 'published'});
  }

  Future<void> rejectEvent(String eventId) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;
    await _db.events.put(eventId, {...event, 'status': 'rejected'});
  }

  Future<void> markCompleted(String eventId) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;
    await _db.events.put(eventId, {...event, 'status': 'completed'});
  }

  Future<void> updateEvent(Event event) async {
    await _db.events.put(event.id, event.toMap());
  }

  Future<String> duplicateEvent(String eventId, String newOwnerId) async {
    final src = LocalStore.readDoc(_db.events, eventId);
    if (src == null) throw Exception('Event not found');
    final srcEvent = Event.fromMap(eventId, src);
    final copy = Event(
      id: '',
      ownerId: newOwnerId,
      title: '${srcEvent.title} (Copy)',
      category: srcEvent.category,
      date: DateTime.now().add(const Duration(days: 7)),
      venue: srcEvent.venue,
      lat: srcEvent.lat,
      lng: srcEvent.lng,
      description: srcEvent.description,
      ticketTypes: srcEvent.ticketTypes,
      status: 'pending_review',
      coverImageUrl: srcEvent.coverImageUrl,
      mediaUrls: srcEvent.mediaUrls,
      collaboratorIds: const [],
    );
    return createEvent(copy);
  }

  /// Marks an event as cancelled (kept in place for organizer history).
  Future<void> cancelEvent(String eventId) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;
    await _db.events.put(eventId, {...event, 'status': 'cancelled'});
  }

  /// Ends an event: marks it completed, saves thank-you message, and logs
  /// attended guests as a placeholder for the real SMS gateway.
  ///
  /// TODO: This MUST move to a Cloud Function before production. Sending SMS
  /// from the client is not viable at scale or securely.
  Future<void> endEvent(String eventId, String thankYouMessage) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;

    await _db.events.put(eventId, {
      ...event,
      'status': 'completed',
      'thankYouMessage': thankYouMessage,
    });

    // Find the chat for this event and mark it read-only
    for (final entry in _db.chats.toMap().entries) {
      if (entry.value['eventId'] == eventId) {
        await _db.chats.put(entry.key, {
          ...Map<String, dynamic>.from(entry.value),
          'readOnly': true,
        });
        break;
      }
    }

    // TODO: Move to server-side Cloud Function. Sending SMS from the client
    // is not viable at scale or securely. This is a placeholder to demonstrate
    // the flow until the SMS gateway is implemented server-side.
    int smsCount = 0;
    for (final entry in _db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['eventId'] == eventId && booking['checkedIn'] == true) {
        final userId = booking['userId'] as String?;
        if (userId == null) continue;
        final user = LocalStore.readDoc(_db.users, userId);
        final phone = user?['phone'] as String? ?? '';
        final name = user?['name'] as String? ?? 'Attendee';
        print('[SMS STUB] To: $phone | Attendee: $name | Message: $thankYouMessage');
        smsCount++;
      }
    }
    print('[SMS STUB] Sent $smsCount thank-you messages for event $eventId');
  }

  /// Computes the number of confirmed bookings for a specific ticket tier.
  int soldCountForTier(String eventId, String tierName) {
    int count = 0;
    for (final entry in _db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['eventId'] != eventId) continue;
      if (booking['status'] != 'confirmed') continue;

      // Look up the registration to get its ticketType
      final regId = booking['regId'] as String?;
      if (regId == null) continue;
      final reg = LocalStore.readDoc(_db.registrations, regId);
      if (reg == null) continue;
      if ((reg['ticketType'] as String?) != tierName) continue;

      count++;
    }
    return count;
  }

  /// Returns remaining capacity for a tier, or -1 if the tier/event is not found.
  int remainingCapacity(String eventId, String tierName) {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return -1;
    final ticketTypes = (event['ticketTypes'] as List? ?? const []);
    for (final t in ticketTypes) {
      final ticket = Map<String, dynamic>.from(t);
      if ((ticket['name'] as String?) == tierName) {
        final capacity = (ticket['capacity'] as num?)?.toInt() ?? 0;
        return capacity - soldCountForTier(eventId, tierName);
      }
    }
    return -1;
  }

  /// Total confirmed bookings for an event (social-proof counter).
  int confirmedAttendeeCount(String eventId) {
    int count = 0;
    for (final entry in _db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['eventId'] != eventId) continue;
      if (booking['status'] != 'confirmed') continue;
      count++;
    }
    return count;
  }

  /// Builds a CSV of all attendees for the event and writes it to a temp file.
  /// Returns the file path for sharing.
  Future<String> exportAttendeeListCsv(String eventId) async {
    final rows = <List<String>>[
      [
        'fullName',
        'ticketType',
        'hometown',
        'denomination',
        'religion',
        'gender',
        'attendeeType',
        'checkedIn',
        'seatNumber',
      ],
    ];

    // Gather all bookings for this event.
    for (final entry in _db.bookings.toMap().entries) {
      final booking = Map<String, dynamic>.from(entry.value);
      if (booking['eventId'] != eventId) continue;

      final regId = booking['regId'] as String?;
      final reg = regId != null ? LocalStore.readDoc(_db.registrations, regId) : null;

      rows.add([
        reg?['fullName'] as String? ?? '',
        reg?['ticketType'] as String? ?? '',
        reg?['hometown'] as String? ?? '',
        reg?['denomination'] as String? ?? '',
        reg?['religion'] as String? ?? '',
        reg?['gender'] as String? ?? '',
        reg?['attendeeType'] as String? ?? '',
        (booking['checkedIn'] as bool?) == true ? 'Yes' : 'No',
        booking['seatNumber'] as String? ?? '',
      ]);
    }

    final csv = const ListToCsvConverter().convert(rows);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/attendee_list_$eventId.csv');
    await file.writeAsString(csv);
    return file.path;
  }

  Stream<List<Event>> publishedEventsFeed() {
    return LocalStore.watchBox(
      _db.events,
      where: (event) => event['status'] == 'published',
      sort: _byFeaturedThenDate,
    ).map((items) => items.map((e) => Event.fromMap(e.$1, e.$2)).toList());
  }

  /// "For You" feed — featured events first, then by date ascending.
  Stream<List<Event>> feedForYou() {
    return publishedEventsFeed();
  }

  /// "Following" feed — only published events owned by [ownerIds],
  /// sorted by date ascending.
  Stream<List<Event>> feedFollowing(List<String> ownerIds) {
    if (ownerIds.isEmpty) {
      return const Stream.empty();
    }
    final idSet = ownerIds.toSet();
    return LocalStore.watchBox(
      _db.events,
      where: (event) =>
          event['status'] == 'published' && idSet.contains(event['ownerId']),
      sort: _byDate,
    ).map((items) => items.map((e) => Event.fromMap(e.$1, e.$2)).toList());
  }

  Stream<List<Event>> eventsByOwner(String ownerId) {
    return LocalStore.watchBox(
      _db.events,
      where: (event) =>
          event['ownerId'] == ownerId ||
          (event['collaboratorIds'] as List? ?? const []).contains(ownerId),
      sort: _byDate,
    ).map((items) => items.map((e) => Event.fromMap(e.$1, e.$2)).toList());
  }

  /// Adds a collaborator to an event. No-op if already present.
  Future<void> addCollaborator(String eventId, String userId) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;
    final collabs = List<String>.from(event['collaboratorIds'] as List? ?? const []);
    if (collabs.contains(userId)) return;
    collabs.add(userId);
    await _db.events.put(eventId, {
      ...event,
      'collaboratorIds': collabs,
    });
  }

  /// Removes a collaborator from an event.
  Future<void> removeCollaborator(String eventId, String userId) async {
    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;
    final collabs = List<String>.from(event['collaboratorIds'] as List? ?? const []);
    collabs.remove(userId);
    await _db.events.put(eventId, {
      ...event,
      'collaboratorIds': collabs,
    });
  }

  Stream<List<Event>> pendingReviewEvents() {
    return LocalStore.watchBox(
      _db.events,
      where: (event) => event['status'] == 'pending_review',
      sort: _byDate,
    ).map((items) => items.map((e) => Event.fromMap(e.$1, e.$2)).toList());
  }

  Future<Event?> getEvent(String eventId) async {
    final map = LocalStore.readDoc(_db.events, eventId);
    if (map == null) return null;
    return Event.fromMap(eventId, map);
  }

  int _byDate(Map<String, dynamic> a, Map<String, dynamic> b) {
    final da = DateTime.tryParse(a['date'] as String? ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0);
    final db = DateTime.tryParse(b['date'] as String? ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0);
    return da.compareTo(db);
  }

  /// Sorts featured (active) events first, then by date ascending.
  int _byFeaturedThenDate(Map<String, dynamic> a, Map<String, dynamic> b) {
    final aFeatured = a['featured'] == true &&
        (DateTime.tryParse(a['featuredUntil'] as String? ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0))
            .isAfter(DateTime.now());
    final bFeatured = b['featured'] == true &&
        (DateTime.tryParse(b['featuredUntil'] as String? ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0))
            .isAfter(DateTime.now());
    if (aFeatured && !bFeatured) return -1;
    if (!aFeatured && bFeatured) return 1;
    return _byDate(a, b);
  }
}
