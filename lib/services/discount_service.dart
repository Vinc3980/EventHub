import 'package:hive_flutter/hive_flutter.dart';

import '../models/discount_code_model.dart';
import 'local_db.dart';

class InvalidCodeException implements Exception {
  InvalidCodeException(this.message);
  final String message;

  @override
  String toString() => message;
}

class DiscountService {
  DiscountService() : _db = LocalStore.instance;

  final LocalStore _db;

  Box<Map> get _box => _db.discountCodes;

  Future<String> createCode(DiscountCode code) async {
    final id = LocalStore.newId();
    await _box.put(id, {
      ...code.toMap(),
      'id': id,
    });
    return id;
  }

  Stream<List<DiscountCode>> codesForEvent(String eventId) {
    return LocalStore.watchBox(
      _box,
      where: (entry) => entry['eventId'] == eventId,
      sort: (a, b) {
        final ca = (a['code'] as String? ?? '').toLowerCase();
        final cb = (b['code'] as String? ?? '').toLowerCase();
        return ca.compareTo(cb);
      },
    ).map(
        (items) => items.map((e) => DiscountCode.fromMap(e.$1, e.$2)).toList());
  }

  Future<DiscountCode> validateCode(String eventId, String code) async {
    final normalized = code.trim().toLowerCase();
    for (final entry in _box.toMap().entries) {
      final data = Map<String, dynamic>.from(entry.value);
      if (data['eventId'] != eventId) continue;
      if ((data['code'] as String? ?? '').toLowerCase() != normalized) continue;

      final discount = DiscountCode.fromMap(entry.key, data);

      if (!discount.active) {
        throw InvalidCodeException('This discount code is no longer active.');
      }

      if (discount.expiresAt != null) {
        final expiry = DateTime.tryParse(discount.expiresAt!);
        if (expiry != null && expiry.isBefore(DateTime.now())) {
          throw InvalidCodeException('This discount code has expired.');
        }
      }

      if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
        throw InvalidCodeException('This discount code has been fully redeemed.');
      }

      return discount;
    }

    throw InvalidCodeException('Invalid discount code.');
  }

  Future<void> redeemCode(String codeId) async {
    final data = _box.get(codeId);
    if (data == null) return;
    final current = Map<String, dynamic>.from(data);
    current['usedCount'] = ((current['usedCount'] as num?)?.toInt() ?? 0) + 1;
    await _box.put(codeId, current);
  }
}
