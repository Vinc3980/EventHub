import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_tag.dart';
import '../attendee/explore.dart';
import '../shared/chat_list_screen.dart';
import '../shared/profile_screen.dart';
import 'create_event.dart';
import 'event_detail.dart';

class OrganizerDashboardScreen extends StatefulWidget {
  const OrganizerDashboardScreen({super.key});

  @override
  State<OrganizerDashboardScreen> createState() =>
      _OrganizerDashboardScreenState();
}

class _OrganizerDashboardScreenState extends State<OrganizerDashboardScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const _MyEventsView(),
          const ExploreScreen(),
          const ChatListScreen(),
          const ProfileScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.home_2),
            selectedIcon: Icon(IconsaxPlusBold.home_2),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.search_normal),
            selectedIcon: Icon(IconsaxPlusBold.search_normal),
            label: 'Explore',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.message),
            selectedIcon: Icon(IconsaxPlusBold.message),
            label: 'Chat',
          ),
          NavigationDestination(
            icon: Icon(IconsaxPlusLinear.user),
            selectedIcon: Icon(IconsaxPlusBold.user),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _MyEventsView extends StatelessWidget {
  const _MyEventsView();

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('My events'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: GestureDetector(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CreateEventScreen()),
                );
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add, color: AppColors.textPrimary, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Create',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: StreamBuilder<List<Event>>(
        stream: context.read<EventService>().eventsByOwner(uid),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Could not load events.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            );
          }
          final events = snapshot.data;
          final hasData = snapshot.hasData;
          final isEmpty = hasData && events!.isEmpty;

          final published = hasData
              ? events!
                  .where((e) => e.status == 'published')
                  .length
              : 0;
          final pending = hasData
              ? events!
                  .where((e) => e.status == 'pending_review')
                  .length
              : 0;
          final draft = hasData
              ? events!
                  .where((e) => e.status == 'draft')
                  .length
              : 0;

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children: [
              // Stat cards row
              Row(
                children: [
                  _StatCard(
                    value: hasData ? '$published' : null,
                    label: 'Published',
                  ),
                  const SizedBox(width: 10),
                  _StatCard(
                    value: hasData ? '$pending' : null,
                    label: 'Pending',
                  ),
                  const SizedBox(width: 10),
                  _StatCard(
                    value: hasData ? '$draft' : null,
                    label: 'Draft',
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Event list
              if (!hasData) ...[
                _SkeletonEventRow(),
                const SizedBox(height: 10),
                _SkeletonEventRow(),
                const SizedBox(height: 10),
                _SkeletonEventRow(),
              ] else if (isEmpty) ...[
                _SkeletonEventRow(),
                const SizedBox(height: 10),
                _SkeletonEventRow(),
                const SizedBox(height: 10),
                _SkeletonEventRow(),
              ] else
                for (final event in events!) ...[
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              EventDetailScreen(eventId: event.id),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                            color: AppColors.border, width: 1),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppColors.skeleton,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.event_outlined,
                                color: AppColors.textMuted, size: 20),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              event.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          StatusTag(status: event.status),
                          if (event.status == 'draft') ...[
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () async {
                                final c = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: const Text('Submit draft?'), content: Text('"${event.title}" will be sent for review.'), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit'))]));
                                if (c == true) context.read<EventService>().submitForReview(event.id);
                              },
                              child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(20)), child: const Text('Submit', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({this.value, required this.label});

  final String? value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Column(
          children: [
            if (value != null)
              Text(
                value!,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              )
            else
              Container(
                width: 28,
                height: 24,
                decoration: BoxDecoration(
                  color: AppColors.skeleton,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SkeletonEventRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.skeleton,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 14,
                  width: 120,
                  decoration: BoxDecoration(
                    color: AppColors.skeleton,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  height: 10,
                  width: 80,
                  decoration: BoxDecoration(
                    color: AppColors.skeleton,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
