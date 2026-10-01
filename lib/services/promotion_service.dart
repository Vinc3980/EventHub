import 'local_db.dart';

/// Handles promoted / featured event listings.
///
/// IMPORTANT: The local simulation below bypasses real payment entirely.
/// Before launch this MUST be replaced with a real payment gateway (Paystack,
/// Flutterwave, etc.) + a server-side Cloud Function that:
///   1. Charges the organizer
///   2. Writes the promotion record via the Admin SDK
///   3. Sets featured=true + featuredUntil on the event document
///
/// The current implementation writes directly to local Hive boxes so the
/// featured-listings flow can be end-to-end tested without any third-party
/// account.
class PromotionService {
  PromotionService() : _db = LocalStore.instance;

  final LocalStore _db;

  /// "Boosts" an event for [tierDays] days.
  ///
  /// In a real build this would go through a payment gateway. For now it:
  ///   - Waits a short delay to mimic network latency
  ///   - Sets featured=true and featuredUntil on the event
  ///   - Creates a promotion record in the local `promotions` box
  Future<void> boostEvent(String eventId, int tierDays) async {
    // --- SIMULATED PAYMENT — replace with real charge before launch -----------
    // TODO: Replace with Paystack / Flutterwave charge + Cloud Function.
    await Future.delayed(const Duration(seconds: 2));
    // -------------------------------------------------------------------------

    final event = LocalStore.readDoc(_db.events, eventId);
    if (event == null) return;

    final now = DateTime.now();
    final until = now.add(Duration(days: tierDays));

    await _db.events.put(eventId, {
      ...event,
      'featured': true,
      'featuredUntil': until.toUtc().toIso8601String(),
    });

    // Create a promotion record so there is an audit trail of the "purchase."
    final promotionId = LocalStore.newId();
    await _db.promotions.put(promotionId, {
      'eventId': eventId,
      'tierDays': tierDays,
      'amount': _priceForTier(tierDays),
      // --- SIMULATED PAYMENT STATUS — replace with real webhook confirmation -
      'status': 'success',
      // -------------------------------------------------------------------------
      'createdAt': now.toUtc().toIso8601String(),
    });
  }

  /// Returns a made-up price for the given tier.
  /// Replace with real pricing before launch.
  double _priceForTier(int days) {
    if (days <= 3) return 25.00;
    if (days <= 7) return 50.00;
    return 90.00;
  }

  /// Returns the price (local placeholder) for a given tier.
  double priceForTier(int days) => _priceForTier(days);
}
