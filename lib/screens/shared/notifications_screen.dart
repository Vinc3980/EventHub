import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../../services/notification_service.dart';
import '../../theme/app_colors.dart';

/// In-app notification center showing all activity: booking confirmations,
/// follower notifications, event updates, refund status, etc.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isEmpty) {
      return const Scaffold(
        body: Center(child: Text('Sign in to see notifications.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              final service = context.read<NotificationService>();
              final notifications =
                  await service.notificationsForUser(uid).first;
              for (final n in notifications) {
                if (n['read'] == false) {
                  await service.markRead(n['id'] as String);
                }
              }
            },
            child: const Text(
              'Mark all read',
              style: TextStyle(fontSize: 13, color: AppColors.accent),
            ),
          ),
        ],
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: context.read<NotificationService>().notificationsForUser(uid),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load notifications.'));
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
          final notifications = snapshot.data!;
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(Icons.notifications_none,
                        size: 32, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'No notifications yet',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Updates about your events and bookings\nwill appear here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textMuted,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            itemCount: notifications.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, index) {
              final n = notifications[index];
              final title = n['title'] as String? ?? '';
              final body = n['body'] as String? ?? '';
              final type = n['type'] as String? ?? '';
              final read = n['read'] == true;
              final icon = _iconForType(type);

              return ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: read
                        ? AppColors.skeleton
                        : AppColors.accent.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 20, color: AppColors.accent),
                ),
                title: Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: read ? FontWeight.w500 : FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
                trailing: !read
                    ? Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.accent,
                          shape: BoxShape.circle,
                        ),
                      )
                    : null,
                onTap: () async {
                  if (!read) {
                    await context
                        .read<NotificationService>()
                        .markRead(n['id'] as String);
                  }
                },
              );
            },
          );
        },
      ),
    );
  }

  IconData _iconForType(String type) {
    return switch (type) {
      'booking_confirmed' => Icons.confirmation_number,
      'booking_cancelled' => Icons.cancel,
      'new_follower' => Icons.person_add,
      'event_update' => Icons.info_outline,
      'event_reminder' => Icons.alarm,
      'refund_approved' => Icons.check_circle,
      'refund_denied' => Icons.close,
      'waitlist_spot' => Icons.hourglass_top,
      'new_chat_message' => Icons.chat_bubble,
      'event_post' => Icons.campaign,
      _ => Icons.notifications,
    };
  }
}
