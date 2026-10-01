import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/registration_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/event_grid_tile.dart';
import '../../widgets/profile_header_parts.dart';
import '../../widgets/shimmer_skeleton.dart';
import 'follow_list_screen.dart';
import 'settings_screen.dart';

/// Instagram-style profile screen used by both attendee and organizer roles.
///
/// Shows: avatar + name + bio, stats row (Events / Followers / Following),
/// and a tabbed grid of the user's events (organizer) or bookings (attendee)
/// alongside their saved events.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  bool _scrolled = false;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadProfile();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final uid = context.read<AuthService>().currentUid ?? '';
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final name = _profile?['name'] as String? ?? 'Profile';
    final topPad = MediaQuery.of(context).padding.top;
    // Banner runs behind the transparent app bar: status bar + toolbar + ~116px.
    final bannerHeight = topPad + kToolbarHeight + 116;
    // Flip the bar to its solid scrolled state once the banner's bottom edge
    // reaches the toolbar, so the dark title never sits on the photo.
    final scrolledAt = bannerHeight - kToolbarHeight - topPad;
    final overBanner = !_scrolled;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor:
            overBanner ? Colors.transparent : AppColors.background,
        foregroundColor: overBanner ? Colors.white : AppColors.textPrimary,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        systemOverlayStyle: overBanner
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        title: Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: overBanner ? Colors.white : AppColors.textPrimary,
          ),
        ),
        actions: [
          _SettingsAction(
            scrolled: !overBanner,
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
              // Reload profile in case user updated name/bio/avatar in settings.
              _loadProfile();
            },
          ),
          const SizedBox(width: AppSpacing.sm),
        ],
      ),
      body: _loading
          ? ProfileHeaderSkeleton(bannerHeight: bannerHeight)
          : NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.depth != 0) return false;
                final scrolled = notification.metrics.pixels > scrolledAt;
                if (scrolled != _scrolled) {
                  setState(() => _scrolled = scrolled);
                }
                return false;
              },
              child: RefreshIndicator(
                onRefresh: _loadProfile,
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _enter(_buildHeader(bannerHeight), 0),
                    const SizedBox(height: AppSpacing.lg),
                    _enter(_buildStatsRow(), 1),
                    const SizedBox(height: AppSpacing.lg),
                    _enter(_buildTabBar(), 2),
                    SizedBox(
                      height: 400,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildEventsTab(),
                          _buildSavedTab(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  /// One-shot group entrance: fade with a 100ms delay per group, skipped when
  /// the OS asks for reduced motion. Calm only — nothing bounces.
  Widget _enter(Widget child, int group) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return child
        .animate()
        .fadeIn(
          duration: 300.ms,
          delay: Duration(milliseconds: 100 * group),
        );
  }

  // ---------------------------------------------------------------------------
  // Header — Stage O treatment: banner behind overlapping avatar, identity block
  // ---------------------------------------------------------------------------

  Widget _buildHeader(double bannerHeight) {
    final name = _profile?['name'] as String? ?? 'User';
    final bio = _profile?['bio'] as String? ?? '';
    final avatarUrl = _profile?['avatarUrl'] as String? ?? '';
    final bannerUrl = _profile?['bannerUrl'] as String? ?? '';
    final verified = _profile?['verifiedOrganizer'] as bool? ?? false;
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Cover banner (behind the app bar) with avatar overlapping its
        // bottom edge (FB-style).
        Stack(
          clipBehavior: Clip.none,
          children: [
            ProfileBanner(bannerUrl: bannerUrl, height: bannerHeight),
            Positioned(
              left: 0,
              right: 0,
              bottom: -48,
              child: Center(
                child: ProfileAvatar(
                  avatarUrl: avatarUrl,
                  initial: initial,
                  radius: 44,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 60),

        // Identity block: name + verified badge, then bio.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: AppTheme.headlineLarge,
                    ),
                  ),
                  if (verified) ...[
                    const SizedBox(width: 6),
                    const Icon(IconsaxPlusBold.tick_circle,
                        size: 18, color: AppColors.primary),
                  ],
                ],
              ),
              if (bio.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  bio,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Stats row — three light primary-tinted cards, equal width, small gap
  // ---------------------------------------------------------------------------

  Widget _buildStatsRow() {
    final isOrganizer =
        (_profile?['roles'] as List? ?? const []).contains('organizer');
    final followers = (_profile?['followers'] as num?)?.toInt() ?? 0;
    final following = (_profile?['following'] as num?)?.toInt() ?? 0;
    final uid = context.read<AuthService>().currentUid ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: _StatCard(
              label: 'Events',
              future: isOrganizer
                  ? context.read<EventService>().eventsByOwner(uid).first
                  : context.read<RegistrationService>().bookingsForUser(uid).first,
              builder: (data) {
                if (data is List) return '${data.length}';
                return '0';
              },
              onTap: null,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _StatCard(
              label: 'Followers',
              value: '$followers',
              onTap: () => _openFollowList('followers'),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _StatCard(
              label: 'Following',
              value: '$following',
              onTap: () => _openFollowList('following'),
            ),
          ),
        ],
      ),
    );
  }

  void _openFollowList(String type) {
    final uid = context.read<AuthService>().currentUid ?? '';
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FollowListScreen(userId: uid, type: type),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Tab bar — pill segmented control (neutralBg track, sliding white pill)
  // ---------------------------------------------------------------------------

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.neutralBg,
        borderRadius: BorderRadius.circular(24),
      ),
      child: TabBar(
        controller: _tabController,
        labelColor: AppColors.textPrimary,
        unselectedLabelColor: AppColors.textMuted,
        labelStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        indicator: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.07),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerHeight: 0,
        splashBorderRadius: BorderRadius.circular(24),
        tabs: const [
          Tab(text: 'Events'),
          Tab(text: 'Saved'),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Events tab
  // ---------------------------------------------------------------------------

  Widget _buildEventsTab() {
    final uid = context.read<AuthService>().currentUid ?? '';
    final isOrganizer =
        (_profile?['roles'] as List? ?? const []).contains('organizer');

    if (isOrganizer) {
      return _buildOrganizerEventsGrid(uid);
    } else {
      return _buildAttendeeBookingsGrid(uid);
    }
  }

  Widget _buildOrganizerEventsGrid(String uid) {
    return StreamBuilder<List<Event>>(
      stream: context.read<EventService>().eventsByOwner(uid),
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
          return const _EmptyState(
            icon: IconsaxPlusLinear.calendar,
            title: 'No events yet',
            subtitle: 'Your events will appear here.',
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(20),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 3,
            mainAxisSpacing: 3,
          ),
          itemCount: events.length,
          itemBuilder: (context, index) {
            final event = events[index];
            final tile = EventGridTile(event: event);
            if (MediaQuery.of(context).disableAnimations) return tile;
            return tile
                .animate()
                .fadeIn(
                  duration: 300.ms,
                  delay: Duration(milliseconds: 40 * index),
                )
                .slideY(begin: 0.05, end: 0);
          },
        );
      },
    );
  }

  Widget _buildAttendeeBookingsGrid(String uid) {
    return StreamBuilder(
      stream: context.read<RegistrationService>().bookingsForUser(uid),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Center(child: Text('Could not load bookings.'));
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
        final bookings = snapshot.data!;
        if (bookings.isEmpty) {
          return const _EmptyState(
            icon: IconsaxPlusLinear.ticket,
            title: 'No bookings yet',
            subtitle: 'Your bookings will appear here.',
          );
        }
        // Deduplicate by eventId (one cell per unique event).
        final seenEventIds = <String>{};
        final uniqueBookings = bookings.where((b) {
          if (seenEventIds.contains(b.eventId)) return false;
          seenEventIds.add(b.eventId);
          return true;
        }).toList();
        return GridView.builder(
          padding: const EdgeInsets.all(20),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 3,
            mainAxisSpacing: 3,
          ),
          itemCount: uniqueBookings.length,
          itemBuilder: (context, index) {
            final booking = uniqueBookings[index];
            final tile = _BookingGridTile(
              eventId: booking.eventId,
              status: booking.status,
            );
            if (MediaQuery.of(context).disableAnimations) return tile;
            return tile.animate().fadeIn(
                  duration: 300.ms,
                  delay: Duration(milliseconds: 40 * index),
                );
          },
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Saved tab
  // ---------------------------------------------------------------------------

  Widget _buildSavedTab() {
    final savedIds = List<String>.from(
      _profile?['savedEventIds'] as List? ?? const [],
    );

    if (savedIds.isEmpty) {
      return const _EmptyState(
        icon: IconsaxPlusLinear.bookmark,
        title: 'No saved events',
        subtitle: 'Bookmark events to find them here later.',
      );
    }

    final eventService = context.read<EventService>();
    return FutureBuilder<List<Event?>>(
      future: Future.wait(savedIds.map((id) => eventService.getEvent(id))),
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
        return GridView.builder(
          padding: const EdgeInsets.all(20),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 3,
            mainAxisSpacing: 3,
          ),
          itemCount: events.length,
          itemBuilder: (context, index) {
            final event = events[index];
            final tile = EventGridTile(event: event);
            if (MediaQuery.of(context).disableAnimations) return tile;
            return tile
                .animate()
                .fadeIn(
                  duration: 300.ms,
                  delay: Duration(milliseconds: 40 * index),
                )
                .slideY(begin: 0.05, end: 0);
          },
        );
      },
    );
  }
}

// =============================================================================
// Helper widgets
// =============================================================================

/// One stat as a light card: primary-alpha-0.06 fill, 15px radius, no border,
/// bold number over a muted label. Tappable stats get a selection haptic.
class _StatCard extends StatelessWidget {
  const _StatCard({
    this.future,
    this.builder,
    this.value,
    required this.label,
    required this.onTap,
  });

  final Future? future;
  final String Function(dynamic data)? builder;
  final String? value;
  final String label;
  final VoidCallback? onTap;

  static const _numberStyle = TextStyle(
    fontSize: 19,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
  );

  @override
  Widget build(BuildContext context) {
    final content = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (future != null && builder != null)
            FutureBuilder(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  );
                }
                return Text(
                  builder!(snapshot.data),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _numberStyle,
                );
              },
            )
          else
            Text(
              value ?? '0',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: _numberStyle,
            ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );

    if (onTap != null) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap!();
        },
        child: content,
      );
    }
    return content;
  }
}

/// Empty-state block: soft primary-tinted circular chip holding an iconsax
/// glyph, over a bold title and muted subtitle (same idea as the event page's
/// designed placeholders).
class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 30, color: AppColors.primary),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// App-bar action in the cover-button language (44px translucent circle,
/// white hairline) while the bar floats over the banner, flipping to a soft
/// primary tint once the bar goes solid on scroll.
class _SettingsAction extends StatelessWidget {
  const _SettingsAction({required this.scrolled, required this.onPressed});

  final bool scrolled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Settings',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: scrolled
                ? AppColors.primary.withValues(alpha: 0.10)
                : Colors.white.withValues(alpha: 0.15),
            border: scrolled
                ? null
                : Border.all(
                    color: Colors.white.withValues(alpha: 0.4),
                    width: 1,
                  ),
          ),
          child: Icon(
            IconsaxPlusLinear.setting_2,
            size: 20,
            color: scrolled ? AppColors.primary : Colors.white,
          ),
        ),
      ),
    );
  }
}

/// Resolves a booking's event, then renders the shared [EventGridTile]
/// with the booking status ("Confirmed") as the badge.
class _BookingGridTile extends StatelessWidget {
  const _BookingGridTile({required this.eventId, required this.status});

  final String eventId;
  final String status;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Event?>(
      future: context.read<EventService>().getEvent(eventId),
      builder: (context, snapshot) {
        final event = snapshot.data;
        if (event == null) {
          return Container(
            color: AppColors.skeleton,
            child: const Center(
              child: Icon(IconsaxPlusLinear.calendar,
                  size: 24, color: AppColors.textMuted),
            ),
          );
        }
        return EventGridTile(event: event, status: status);
      },
    );
  }
}
