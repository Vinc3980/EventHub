import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:provider/provider.dart';

import '../../models/event_model.dart';
import '../../services/auth_service.dart';
import '../../services/event_service.dart';
import '../../services/follow_service.dart';
import '../../services/review_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/event_grid_tile.dart';
import '../../widgets/primary_button.dart';
import '../../widgets/profile_header_parts.dart';
import '../../widgets/secondary_button.dart';
import '../../widgets/shimmer_skeleton.dart';

/// Public organizer profile — the screen opened by tapping an organizer's
/// name from a feed card, event page, or chat.
///
/// Visual structure: a cobalt→pink duotone cover banner (behind a transparent
/// app bar) with a large ringed avatar overlapping its bottom edge, followed
/// by an Instagram-style centered identity block (name + verified badge,
/// handle, rating, follow button), plain bio text, light stats cards, and the
/// shared Instagram-style [EventGridTile] grid also used by the "my profile"
/// screen.
class OrganizerProfileScreen extends StatefulWidget {
  const OrganizerProfileScreen({super.key, required this.organizerId});

  final String organizerId;

  @override
  State<OrganizerProfileScreen> createState() => _OrganizerProfileScreenState();
}

class _OrganizerProfileScreenState extends State<OrganizerProfileScreen> {
  Map<String, dynamic>? _profile;
  List<Event> _allEvents = const [];
  double _avgRating = 0;
  int _reviewCount = 0;
  bool _loading = true;
  bool _scrolled = false;
  bool _blockedByMe = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final authService = context.read<AuthService>();
    final eventService = context.read<EventService>();
    final reviewService = context.read<ReviewService>();

    final profile = await authService.fetchUserProfile(widget.organizerId);
    final events = await eventService.eventsByOwner(widget.organizerId).first;
    final avg = reviewService.averageRating(widget.organizerId);
    final count = reviewService.reviewCount(widget.organizerId);
    final ownProfile =
        await authService.fetchUserProfile(authService.currentUid ?? '');

    if (mounted) {
      final blocked = List<String>.from(
          ownProfile?['blockedUids'] as List? ?? const []);
      setState(() {
        _profile = profile;
        _allEvents = events;
        _avgRating = avg;
        _reviewCount = count;
        _blockedByMe = blocked.contains(widget.organizerId);
        _loading = false;
      });
    }
  }

  bool get _isSelf {
    final currentUid = context.read<AuthService>().currentUid ?? '';
    return currentUid == widget.organizerId;
  }

  /// Block / unblock this organizer from the overflow menu.
  Future<void> _toggleBlock() async {
    final auth = context.read<AuthService>();
    final uid = auth.currentUid ?? '';
    final messenger = ScaffoldMessenger.of(context);
    final name = _profile?['name'] as String? ?? 'this organizer';
    if (_blockedByMe) {
      await auth.unblockUser(uid, widget.organizerId);
    } else {
      await auth.blockUser(uid, widget.organizerId);
    }
    if (!mounted) return;
    HapticFeedback.selectionClick();
    setState(() => _blockedByMe = !_blockedByMe);
    messenger.showSnackBar(
      SnackBar(
        content: Text(_blockedByMe ? '$name blocked.' : '$name unblocked.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    // Banner runs behind the transparent app bar: status bar + toolbar + ~116px.
    final bannerHeight = topPad + kToolbarHeight + 116;
    final scrolledAt = bannerHeight - kToolbarHeight - topPad;

    if (_loading) {
      return Scaffold(
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          systemOverlayStyle: SystemUiOverlayStyle.light,
        ),
        body: _buildLoadingSkeleton(bannerHeight),
      );
    }

    final name = _profile?['name'] as String? ?? 'Organizer';
    final email = _profile?['email'] as String? ?? '';
    final phone = _profile?['phone'] as String? ?? '';
    final bio = _profile?['bio'] as String? ?? '';
    final avatarUrl = _profile?['avatarUrl'] as String? ?? '';
    final bannerUrl = _profile?['bannerUrl'] as String? ?? '';
    final verified = _profile?['verifiedOrganizer'] as bool? ?? false;
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();

    final published = _allEvents.where((e) => e.status == 'published').toList();
    final completed =
        _allEvents.where((e) => e.status == 'completed').toList();
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
        // Block/unblock lives in an overflow menu — a following organizer
        // shouldn't get a prominent unfollow/block button.
        actions: [
          if (!_isSelf)
            PopupMenuButton<String>(
              icon: Icon(
                IconsaxPlusLinear.more,
                color: overBanner ? Colors.white : AppColors.textPrimary,
              ),
              color: AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              onSelected: (_) => _toggleBlock(),
              itemBuilder: (ctx) => [
                PopupMenuItem(
                  height: 44,
                  child: Text(
                    _blockedByMe ? 'Unblock' : 'Block',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
      body: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification.depth != 0) return false;
          final scrolled = notification.metrics.pixels > scrolledAt;
          if (scrolled != _scrolled) {
            setState(() => _scrolled = scrolled);
          }
          return false;
        },
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            // ── Banner + overlapping avatar + identity block ──
            _enter(
              _buildHeader(
                name: name,
                email: email,
                bannerUrl: bannerUrl,
                avatarUrl: avatarUrl,
                initial: initial,
                verified: verified,
                bannerHeight: bannerHeight,
              ),
              0,
            ),

            // ── Bio — plain text, no box ──
            if (bio.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, 0),
                child: Text(
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
              ),

            // ── Phone — plain muted line ──
            if (phone.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl, AppSpacing.md, AppSpacing.xl, 0),
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(IconsaxPlusLinear.call,
                          size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          phone,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.textMuted),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // ── Stats — light primary-tinted cards (same as "my profile") ──
            _enter(
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, 0),
                child: Row(
                  children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Published', value: published.length)),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                        child: _StatCard(
                            label: 'Completed', value: completed.length)),
                  ],
                ),
              ),
              1,
            ),

            // ── Events — shared Instagram-style grid ──
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl, AppSpacing.xxl, AppSpacing.xl, AppSpacing.lg),
              child: Text('Events', style: AppTheme.headlineMedium),
            ),
            if (_allEvents.isEmpty)
              const _EmptyIconState(
                icon: IconsaxPlusLinear.calendar,
                message: 'No events yet.',
              )
            else
              GridView.builder(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xxl),
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 3,
                  crossAxisSpacing: 3,
                  childAspectRatio: 1,
                ),
                itemCount: _allEvents.length,
                itemBuilder: (context, index) {
                  final tile = EventGridTile(event: _allEvents[index]);
                  if (MediaQuery.of(context).disableAnimations) return tile;
                  return tile
                      .animate()
                      .fadeIn(
                        duration: 300.ms,
                        delay: Duration(milliseconds: 50 * index),
                      )
                      .slideY(begin: 0.05, end: 0);
                },
              ),
          ],
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
  // Header — banner behind avatar, centered identity block
  // ---------------------------------------------------------------------------

  Widget _buildHeader({
    required String name,
    required String email,
    required String bannerUrl,
    required String avatarUrl,
    required String initial,
    required bool verified,
    required double bannerHeight,
  }) {
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

        // Identity block.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            children: [
              // Name + verified badge.
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

              // Handle (email) in muted text.
              if (email.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textMuted),
                ),
              ],

              const SizedBox(height: AppSpacing.sm),

              // Star rating — filled stars use the neon-pink accent.
              _RatingRow(avg: _avgRating, count: _reviewCount),

              // Follow — filled PrimaryButton flips to outline SecondaryButton.
              if (!_isSelf) ...[
                const SizedBox(height: AppSpacing.lg),
                _ProfileFollowButton(targetUserId: widget.organizerId),
              ],
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Loading skeleton matching the new header layout
  // ---------------------------------------------------------------------------

  Widget _buildLoadingSkeleton(double bannerHeight) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        ClipRRect(
          borderRadius:
              const BorderRadius.vertical(bottom: Radius.circular(28)),
          child: ShimmerSkeleton.box(
              width: double.infinity, height: bannerHeight, radius: 0),
        ),
        const SizedBox(height: 60),
        const Center(child: ShimmerSkeleton.circle(size: 96)),
        const SizedBox(height: 16),
        Center(
            child: ShimmerSkeleton.box(width: 140, height: 20, radius: 6)),
        const SizedBox(height: 8),
        Center(
            child: ShimmerSkeleton.box(width: 180, height: 13, radius: 6)),
        const SizedBox(height: 28),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Row(
            children: [
              Expanded(
                  child: ShimmerSkeleton.box(height: 44, radius: 12)),
              const SizedBox(width: 12),
              Expanded(
                  child: ShimmerSkeleton.box(height: 44, radius: 12)),
            ],
          ),
        ),
      ],
    );
  }
}

// =============================================================================
// Header sub-widgets — shared ProfileBanner / ProfileAvatar live in
// ../../widgets/profile_header_parts.dart (used by this screen and the
// shared "my profile" screen so both headers stay in lockstep).
// =============================================================================

/// Star rating row — filled stars in neon-pink accent (half stars at a
/// lighter tint), empty stars in border gray, followed by the average and
/// review count in muted text.
class _RatingRow extends StatelessWidget {
  const _RatingRow({required this.avg, required this.count});

  final double avg;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ...List.generate(5, (i) {
          final star = i + 1;
          final bool filled;
          final bool half;
          if (star <= avg.round()) {
            filled = true;
            half = false;
          } else if (star - 0.5 <= avg) {
            filled = false;
            half = true;
          } else {
            filled = false;
            half = false;
          }
          return Icon(
            filled || half
                ? IconsaxPlusBold.star
                : IconsaxPlusLinear.star,
            size: 18,
            color: filled
                ? AppColors.accent
                : half
                    ? AppColors.accent.withValues(alpha: 0.45)
                    : AppColors.border,
          );
        }),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            count > 0
                ? '${avg.toStringAsFixed(1)} ($count reviews)'
                : 'No reviews yet',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

/// Stat card — light primary-alpha-0.06 fill, 15px radius, no border; bold
/// number over a muted label (same treatment as the "my profile" stats row).
class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Text(
            '$value',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// Empty-state block: soft primary-tinted circular chip with an iconsax glyph
/// over a muted message — matches the shared profile screen's empty states.
class _EmptyIconState extends StatelessWidget {
  const _EmptyIconState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
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
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// Follow button
// =============================================================================

/// Follow toggle with the standard filled-to-outline flip: [PrimaryButton]
/// ("Follow") when not following, [SecondaryButton] ("Following") once
/// followed. Reads live state from the [FollowService] stream.
class _ProfileFollowButton extends StatefulWidget {
  const _ProfileFollowButton({required this.targetUserId});

  final String targetUserId;

  @override
  State<_ProfileFollowButton> createState() => _ProfileFollowButtonState();
}

class _ProfileFollowButtonState extends State<_ProfileFollowButton> {
  bool _loading = false;

  Future<void> _toggle(String currentUid) async {
    setState(() => _loading = true);
    await context.read<FollowService>().toggleFollow(
          currentUid,
          widget.targetUserId,
        );
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final currentUid = context.read<AuthService>().currentUid ?? '';
    if (currentUid.isEmpty) return const SizedBox.shrink();

    return StreamBuilder<bool>(
      stream: context.read<FollowService>().isFollowingStream(
            currentUid,
            widget.targetUserId,
          ),
      builder: (context, snapshot) {
        final isFollowing = snapshot.data ?? false;
        if (isFollowing) {
          return SecondaryButton(
            label: 'Following',
            loading: _loading,
            onPressed: () => _toggle(currentUid),
          );
        }
        return PrimaryButton(
          label: 'Follow',
          loading: _loading,
          onPressed: () => _toggle(currentUid),
        );
      },
    );
  }
}
