import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/report_model.dart';
import '../services/auth_service.dart';
import '../services/report_service.dart';
import '../theme/app_colors.dart';

/// Shows a report dialog for posts or events. Call from a long-press or
/// overflow menu.
void showReportDialog(
  BuildContext context, {
  required String targetType,
  required String targetId,
}) {
  final reasons = [
    'Spam or misleading',
    'Inappropriate content',
    'Harassment or hate speech',
    'Violence or dangerous content',
    'Other',
  ];
  String? selectedReason;

  showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDialogState) => AlertDialog(
        title: const Text(
          'Report',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Why are you reporting this?',
              style: TextStyle(fontSize: 14, color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),
            ...reasons.map(
              (reason) => RadioListTile<String>(
                value: reason,
                groupValue: selectedReason,
                onChanged: (v) => setDialogState(() => selectedReason = v),
                title: Text(
                  reason,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                  ),
                ),
                activeColor: AppColors.accent,
                contentPadding: EdgeInsets.zero,
                dense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textMuted),
            ),
          ),
          TextButton(
            onPressed: selectedReason == null
                ? null
                : () async {
                    final uid =
                        context.read<AuthService>().currentUid ?? '';
                    await context.read<ReportService>().createReport(
                          Report(
                            id: '',
                            targetType: targetType,
                            targetId: targetId,
                            reporterId: uid,
                            reason: selectedReason!,
                            createdAt: DateTime.now().toUtc(),
                          ),
                        );
                    if (ctx.mounted) {
                      Navigator.of(ctx).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Report submitted. Thank you.'),
                        ),
                      );
                    }
                  },
            child: const Text(
              'Submit',
              style: TextStyle(
                color: AppColors.accent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
