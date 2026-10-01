import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/follow_service.dart';
import '../../services/notification_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../widgets/event_feed_card.dart';
import '../shared/chat_list_screen.dart';
import '../shared/notifications_screen.dart';
import '../shared/profile_screen.dart';
import 'explore.dart';

class AttendeeHomeScreen extends StatefulWidget {
  const AttendeeHomeScreen({super.key});

  @override
  State<AttendeeHomeScreen> createState() => _AttendeeHomeScreenState();
}

class _AttendeeHomeScreenState extends State<AttendeeHomeScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          _HomeFeed(onOpenSearch: () => setState(() => _index = 1)),
          const ExploreScreen(),
          const ChatListScreen(),
          const ProfileScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (v) => setState(() => _index = v),
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

// ─── Bell icon with neon-pink unread badge ────────────────────────────────

/// Notification bell that shows a filled `AppColors.accent` numbered circle
/// when the user has unread notifications (a plain dot is implied by the
/// count badge itself; counts above 9 render as "9+").
class _BellWithUnreadBadge extends StatelessWidget {
  const _BellWithUnreadBadge({required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context) {
    final bell = IconButton(
      tooltip: 'Notifications',
      icon: const Icon(Icons.notifications_outlined, size: 24),
      onPressed: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        );
      },
    );

    if (uid.isEmpty) return bell;

    return StreamBuilder<int>(
      stream: context.read<NotificationService>().unreadCountStream(uid),
      builder: (context, snapshot) {
        final count = snapshot.data ?? 0;
        if (count <= 0) return bell;

        return Stack(
          clipBehavior: Clip.none,
          children: [
            bell,
            Positioned(
              right: 8,
              top: 8,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                constraints: const BoxConstraints(minWidth: 16),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  count > 9 ? '9+' : '$count',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ─── Home feed with "For You" / "Following" tabs ──────────────────────────

class _HomeFeed extends StatefulWidget {
  const _HomeFeed({required this.onOpenSearch});

  /// Switches the parent shell to the Explore (search) tab so the search
  /// icon in the top bar doesn't force a trip through the bottom nav.
  final VoidCallback onOpenSearch;

  @override
  State<_HomeFeed> createState() => _HomeFeedState();
}

class _HomeFeedState extends State<_HomeFeed>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // ── Top bar: wordmark left, search + notifications right ──
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'EventHub',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Search',
                    icon: const Icon(Icons.search, size: 24),
                    onPressed: widget.onOpenSearch,
                  ),
                  _BellWithUnreadBadge(uid: uid),
                ],
              ),
            ),
          ),

          // ── Instagram-style tab bar ──
          TabBar(
            controller: _tabController,
            isScrollable: false,
            labelColor: AppColors.textPrimary,
            unselectedLabelColor: AppColors.textMuted,
            labelStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
            indicatorColor: AppColors.primary,
            indicatorWeight: 2.5,
            indicatorSize: TabBarIndicatorSize.label,
            dividerHeight: 0,
            tabs: const [
              Tab(text: 'For You'),
              Tab(text: 'Following'),
            ],
          ),

          // ── Tab content ──
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: const [
                _ForYouTab(),
                _FollowingTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── "For You" tab — vertical swipe PageView ───────────────────────────────

class _ForYouTab extends StatelessWidget {
  const _ForYouTab();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Event>>(
      stream: context.read<EventService>().feedForYou(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Center(
            child: Text(
              'Could not load events.',
              style: TextStyle(color: AppColors.textMuted),
            ),
          );
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
          return const _EmptyState(
            message: 'No events yet — check back soon.',
            icon: Icons.event_outlined,
          );
        }
        return _VerticalSwipeFeed(events: events);
      },
    );
  }
}

// ─── "Following" tab — vertical swipe PageView of followed organizers ─────

class _FollowingTab extends StatelessWidget {
  const _FollowingTab();

  @override
  Widget build(BuildContext context) {
    final currentUid = context.read<AuthService>().currentUid ?? '';
    if (currentUid.isEmpty) {
      return const _EmptyState(
        message: 'Sign in to see events from organizers you follow.',
        icon: Icons.person_outline,
      );
    }

    final followService = context.read<FollowService>();

    return StreamBuilder<List<String>>(
      stream: followService.followingIds(currentUid),
      builder: (context, followingSnapshot) {
        final followingIds = followingSnapshot.data;

        if (followingIds == null) {
          return const Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }

        if (followingIds.isEmpty) {
          return const _EmptyState(
            message: 'Follow organizers to see their events here.\n'
                'Use the Explore tab to discover events.',
            icon: Icons.person_add_outlined,
          );
        }

        return StreamBuilder<List<Event>>(
          stream: context.read<EventService>().feedFollowing(followingIds),
          builder: (context, eventSnapshot) {
            if (eventSnapshot.hasError) {
              return const Center(
                child: Text(
                  'Could not load events.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              );
            }
            if (!eventSnapshot.hasData) {
              return const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            }
            final events = eventSnapshot.data!;
            if (events.isEmpty) {
              return const _EmptyState(
                message: 'No events from people you follow yet.',
                icon: Icons.event_outlined,
              );
            }
            return _VerticalSwipeFeed(events: events);
          },
        );
      },
    );
  }
}

// ─── Vertical swipe feed (TikTok-pattern PageView) ────────────────────────

class _VerticalSwipeFeed extends StatefulWidget {
  const _VerticalSwipeFeed({required this.events});
  final List<Event> events;

  @override
  State<_VerticalSwipeFeed> createState() => _VerticalSwipeFeedState();
}

class _VerticalSwipeFeedState extends State<_VerticalSwipeFeed> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      scrollDirection: Axis.vertical,
      itemCount: widget.events.length,
      onPageChanged: (index) => setState(() => _currentIndex = index),
      itemBuilder: (context, index) {
        return EventFeedCard(
          event: widget.events[index],
          isActive: index == _currentIndex,
        );
      },
    );
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.message,
    required this.icon,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.textMuted),
            const SizedBox(height: AppSpacing.lg),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                color: AppColors.textMuted,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
