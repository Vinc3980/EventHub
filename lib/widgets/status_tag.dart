import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class StatusTag extends StatelessWidget {
  const StatusTag({super.key, required this.status, this.compact = false});

  final String status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (label, color, bg) = switch (status) {
      'published' => ('Published', AppColors.success, AppColors.successBg),
      'confirmed' => ('Confirmed', AppColors.success, AppColors.successBg),
      'pending_review' => ('Pending', AppColors.neutral, AppColors.neutralBg),
      'pending' => ('Pending', AppColors.neutral, AppColors.neutralBg),
      'draft' => ('Draft', AppColors.neutral, AppColors.neutralBg),
      'featured' => ('Featured', AppColors.accent, AppColors.accent.withValues(alpha: 0.12)),
      'completed' => ('Completed', AppColors.success, AppColors.successBg),
      'rejected' => ('Rejected', AppColors.danger, AppColors.dangerBg),
      'cancelled' => ('Cancelled', AppColors.danger, AppColors.dangerBg),
      _ => (status, AppColors.neutral, AppColors.neutralBg),
    };

    return Semantics(
      label: 'Status: $label',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 6 : 10,
          vertical: compact ? 2 : 4,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(100),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: compact ? 10 : 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
      ),
    );
  }
}
