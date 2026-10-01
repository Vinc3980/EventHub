import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/event_card.dart';

/// Lists all events the current user has bookmarked/saved.
class SavedEventsScreen extends StatelessWidget {
  const SavedEventsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    final eventService = context.read<EventService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Saved Events')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: context.read<AuthService>().fetchUserProfile(uid),
        builder: (context, profileSnapshot) {
          if (profileSnapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          }
          final savedIds = List<String>.from(
            profileSnapshot.data?['savedEventIds'] as List? ?? const [],
          );
          if (savedIds.isEmpty) {
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
                    child: const Icon(Icons.bookmark_border,
                        size: 32, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'No saved events',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Bookmark events to find them here later.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textMuted,
                        height: 1.4),
                  ),
                ],
              ),
            );
          }

          // Load each saved event by id.
          return FutureBuilder<List<Event?>>(
            future: Future.wait(
              savedIds.map((id) => eventService.getEvent(id)),
            ),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              }
              final events = (snapshot.data ?? []).whereType<Event>().toList();
              if (events.isEmpty) {
                return const Center(
                  child: Text(
                    'Saved events could not be loaded.',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(20),
                itemCount: events.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) => EventCard(event: events[index]),
              );
            },
          );
        },
      ),
    );
  }
}
