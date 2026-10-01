import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/refund_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/local_db.dart';
import '../../services/refund_service.dart';
import '../../theme/app_colors.dart';

class RefundRequestsScreen extends StatelessWidget {
  const RefundRequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    final refundService = context.read<RefundService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Refund requests')),
      body: StreamBuilder<List<Refund>>(
        stream: refundService.refundsForOrganizer(uid),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load refund requests.'));
          }
          if (!snapshot.hasData) {
            return const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          }
          final refunds = snapshot.data!;
          if (refunds.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(Icons.replay_outlined,
                        size: 28, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No refund requests',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Refund requests from attendees will appear here.',
                    style: TextStyle(fontSize: 14, color: AppColors.textMuted),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: refunds.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) =>
                _RefundRow(refund: refunds[index]),
          );
        },
      ),
    );
  }
}

class _RefundRow extends StatelessWidget {
  const _RefundRow({required this.refund});

  final Refund refund;

  @override
  Widget build(BuildContext context) {
    final eventService = context.read<EventService>();
    final refundService = context.read<RefundService>();

    return FutureBuilder(
      future: _loadDetails(eventService),
      builder: (context, snapshot) {
        final details = snapshot.data;
        final eventTitle = details?['eventTitle'] ?? 'Event';
        final attendeeName = details?['attendeeName'] ?? 'Attendee';
        final isPending = refund.status == 'requested';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          eventTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          attendeeName,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'GHS ${refund.amount.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.accent,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _StatusChip(status: refund.status),
                  const Spacer(),
                  if (isPending) ...[
                    TextButton(
                      onPressed: () => _deny(context, refundService),
                      child: const Text(
                        'Deny',
                        style: TextStyle(color: AppColors.danger),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 34,
                      child: ElevatedButton(
                        onPressed: () => _approve(context, refundService),
                        child: const Text('Approve'),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<Map<String, String?>> _loadDetails(EventService eventService) async {
    final db = LocalStore.instance;
    final booking = LocalStore.readDoc(db.bookings, refund.bookingId);
    if (booking == null) return <String, String?>{};

    final eventId = booking['eventId'] as String? ?? '';
    final userId = booking['userId'] as String? ?? '';

    final event = await eventService.getEvent(eventId);
    final user = LocalStore.readDoc(db.users, userId);

    return {
      'eventTitle': event?.title,
      'attendeeName': user?['name'] as String?,
    };
  }

  Future<void> _approve(BuildContext context, RefundService service) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve refund?'),
        content: const Text(
          'The payment will be refunded and the booking will be cancelled.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Approve'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await service.approveRefund(refund.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Refund approved.')),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not approve: $error')),
      );
    }
  }

  Future<void> _deny(BuildContext context, RefundService service) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deny refund?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Provide a reason for denying this refund request.'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Deny'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await service.denyRefund(refund.id, reasonController.text.trim());
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Refund denied.')),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not deny: $error')),
      );
    }
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    switch (status) {
      case 'requested':
        color = AppColors.warning;
        label = 'Pending';
        break;
      case 'completed':
        color = AppColors.success;
        label = 'Completed';
        break;
      case 'denied':
        color = AppColors.danger;
        label = 'Denied';
        break;
      default:
        color = AppColors.textMuted;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
