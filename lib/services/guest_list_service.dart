import '../models/guest_list_entry_model.dart';
import 'local_db.dart';

/// Manages organizer-uploaded contacts (pre-registration guest list)
/// in the local `guestList` box.
class GuestListService {
  GuestListService() : _db = LocalStore.instance;

  final LocalStore _db;

  Future<void> addContact(GuestListEntry entry) async {
    final id = LocalStore.newId();
    await _db.guestList.put(id, entry.toMap());
  }

  /// Writes many contacts in one go (used for CSV upload).
  Future<void> addContactsBulk(
    String eventId,
    List<GuestListEntry> entries,
  ) async {
    for (final entry in entries) {
      final id = LocalStore.newId();
      await _db.guestList.put(id, entry.toMap());
    }
  }

  Future<void> removeContact(String entryId) async {
    await _db.guestList.delete(entryId);
  }

  Stream<List<GuestListEntry>> guestListForEvent(String eventId) {
    return LocalStore.watchBox(
      _db.guestList,
      where: (entry) => entry['eventId'] == eventId,
    ).map((items) =>
        items.map((e) => GuestListEntry.fromMap(e.$1, e.$2)).toList());
  }
}
