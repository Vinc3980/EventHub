/// A user-submitted report against a post or event.
class Report {
  final String id;
  final String targetType; // 'post' | 'event'
  final String targetId;
  final String reporterId;
  final String reason;
  final String status; // 'open' | 'dismissed' | 'removed'
  final DateTime createdAt;

  const Report({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.reporterId,
    required this.reason,
    this.status = 'open',
    required this.createdAt,
  });

  factory Report.fromMap(String id, Map<String, dynamic> map) {
    return Report(
      id: id,
      targetType: map['targetType'] as String? ?? 'post',
      targetId: map['targetId'] as String? ?? '',
      reporterId: map['reporterId'] as String? ?? '',
      reason: map['reason'] as String? ?? '',
      status: map['status'] as String? ?? 'open',
      createdAt: DateTime.tryParse(map['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'targetType': targetType,
      'targetId': targetId,
      'reporterId': reporterId,
      'reason': reason,
      'status': status,
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }
}
