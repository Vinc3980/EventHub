class DiscountCode {
  final String id;
  final String eventId;
  final String code;
  final double? percentOff;
  final double? amountOff;
  final int maxUses;
  final int usedCount;
  final String? expiresAt;
  final bool active;

  const DiscountCode({
    required this.id,
    required this.eventId,
    required this.code,
    this.percentOff,
    this.amountOff,
    this.maxUses = 0,
    this.usedCount = 0,
    this.expiresAt,
    this.active = true,
  });

  factory DiscountCode.fromMap(String id, Map<String, dynamic> map) {
    return DiscountCode(
      id: id,
      eventId: map['eventId'] as String? ?? '',
      code: map['code'] as String? ?? '',
      percentOff: (map['percentOff'] as num?)?.toDouble(),
      amountOff: (map['amountOff'] as num?)?.toDouble(),
      maxUses: (map['maxUses'] as num?)?.toInt() ?? 0,
      usedCount: (map['usedCount'] as num?)?.toInt() ?? 0,
      expiresAt: map['expiresAt'] as String?,
      active: map['active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'eventId': eventId,
      'code': code,
      'percentOff': percentOff,
      'amountOff': amountOff,
      'maxUses': maxUses,
      'usedCount': usedCount,
      'expiresAt': expiresAt,
      'active': active,
    };
  }
}
