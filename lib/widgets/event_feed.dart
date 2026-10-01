import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/event_service.dart';
import '../theme/app_colors.dart';
import 'event_card.dart';

class EventFeed extends StatelessWidget {
  const EventFeed({super.key, this.showOrganizers = false});

  final bool showOrganizers;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: context.read<EventService>().publishedEventsFeed(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Center(child: Text('Could not load events.'));
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
        final events = snapshot.data!;
        if (events.isEmpty) {
          return const Center(
            child: Text('No published events yet — check back soon.'),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: events.length + (showOrganizers ? 1 : 0),
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            if (showOrganizers && index == 0) {
              return const _OrganizersStories();
            }
            final event = events[index - (showOrganizers ? 1 : 0)];
            return EventCard(event: event);
          },
        );
      },
    );
  }
}

class _OrganizersStories extends StatelessWidget {
  const _OrganizersStories();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: context.read<AuthService>().organizerProfiles(),
      builder: (context, snapshot) {
        final organizers = snapshot.data ?? const <Map<String, dynamic>>[];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Organizers near you',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: organizers.length,
                separatorBuilder: (_, __) => const SizedBox(width: 16),
                itemBuilder: (context, index) {
                  final organizer = organizers[index];
                  final name = organizer['name'] as String? ?? 'Organizer';
                  final initial =
                      name.isEmpty ? '?' : name[0].toUpperCase();
                  return Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: const BoxDecoration(
                          color: AppColors.skeleton,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            initial,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 4),
          ],
        );
      },
    );
  }
}
