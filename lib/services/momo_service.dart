/// Mobile Money (MoMo) client-side stub.
///
/// IMPORTANT: MoMo requests MUST be handled server-side (Cloud Functions)
/// and must NEVER be called directly from the client. Making MoMo API calls
/// from the app would require shipping the merchant API key / API user
/// credentials inside the binary — a critical security risk.
///
/// The real implementation lives in a Cloud Function (e.g. `requestMomoPayment`
/// used by [RegistrationService]) that talks to the MoMo API on the server,
/// then writes the resulting [Payment] document via the Admin SDK.
class MomoService {
  MomoService._();

  /// Placeholder — the actual request flow is server-side only.
  static Future<Map<String, dynamic>> requestPayment({
    required String bookingId,
    required double amount,
  }) {
    throw UnimplementedError(
      'MoMo payments must be initiated server-side via Cloud Functions.',
    );
  }
}
