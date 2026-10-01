import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../models/event_model.dart';
import '../screens/attendee/event_page.dart';
import '../screens/attendee/registration_form_screen.dart';
import '../screens/organizer/organizer_profile_screen.dart';
import '../services/auth_service.dart';
import '../services/event_service.dart';
import '../services/follow_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_theme.dart';
import '../widgets/primary_button.dart';
import '../widgets/text_action_button.dart';

/// Full-bleed, full-height event card for the vertical swipe feed.
///
/// Displays the event cover image as a full-screen background with a
/// bottom-third gradient overlay for text legibility. Action icons sit
/// in a vertical column on the right side (Instagram right-rail convention).
class EventFeedCard extends StatefulWidget {
  const EventFeedCard({super.key, required this.event, this.isActive = false});

  final Event event;
  final bool isActive;

  @override
  State<EventFeedCard> createState() => _EventFeedCardState();
}

class _EventFeedCardState extends State<EventFeedCard> {
  bool _saved = false;
  bool _loadingSaved = true;
  bool _following = false;
  late final String _currentUid;

  @override
  void initState() {
    super.initState();
    _currentUid = context.read<AuthService>().currentUid ?? '';
    _loadState();
  }

  Future<void> _loadState() async {
    if (_currentUid.isEmpty) {
      if (mounted) setState(() => _loadingSaved = false);
      return;
    }
    final profile =
        await context.read<AuthService>().fetchUserProfile(_currentUid);
    final saved = List<String>.from(
        profile?['savedEventIds'] as List? ?? const []);
    final followSvc = context.read<FollowService>();
    final isFollowing =
        followSvc.isFollowing(_currentUid, widget.event.ownerId);
    if (mounted) {
      setState(() {
        _saved = saved.contains(widget.event.id);
        _following = isFollowing;
        _loadingSaved = false;
      });
    }
  }

  Future<void> _toggleSaved() async {
    if (_currentUid.isEmpty) return;
    final updated = await context
        .read<AuthService>()
        .toggleSaveEvent(_currentUid, widget.event.id);
    if (mounted) {
      setState(() => _saved = updated.contains(widget.event.id));
    }
  }

  Future<bool> _toggleFollow() async {
    if (_currentUid.isEmpty) return _following;
    final result = await context
        .read<FollowService>()
        .toggleFollow(_currentUid, widget.event.ownerId);
    if (mounted) setState(() => _following = result);
    return result;
  }

  void _shareEvent() {
    final e = widget.event;
    Share.share(
      '${e.title} — ${DateFormat('EEE, d MMM yyyy').format(e.date)} '
      'at ${e.venue}',
    );
  }

  void _openEventInfo() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EventInfoSheet(
        event: widget.event,
        onFollow: _toggleFollow,
      ),
    );
  }

  void _openProfile() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            OrganizerProfileScreen(organizerId: widget.event.ownerId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final dateLabel = DateFormat('EEE, d MMM yyyy').format(event.date);
    final screenH = MediaQuery.of(context).size.height;

    return SizedBox(
      height: screenH,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // ── Full-bleed background image ──
          _BackgroundImage(coverUrl: event.coverImageUrl),

          // ── Bottom-third gradient overlay ──
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: screenH * 0.55,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    AppColors.textPrimary.withValues(alpha: 0.85),
                  ],
                  stops: const [0.0, 1.0],
                ),
              ),
            ),
          ),

          // ── Featured badge ──
          if (event.isCurrentlyFeatured)
            Positioned(
              top: AppSpacing.xl,
              left: AppSpacing.lg,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.star, size: 12, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Featured',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Bottom-left content ──
          Positioned(
            left: AppSpacing.lg,
            right: 72,
            bottom: AppSpacing.xxl + MediaQuery.of(context).padding.bottom,
            child: _EventInfoOverlay(
              event: event,
              dateLabel: dateLabel,
              onProfileTap: _openProfile,
            ),
          ),

          // ── Right-side action column ──
          Positioned(
            right: AppSpacing.md,
            bottom: AppSpacing.xxl + MediaQuery.of(context).padding.bottom + 40,
            child: _ActionColumn(
              following: _following,
              saved: _saved,
              loadingSaved: _loadingSaved,
              onFollow: _toggleFollow,
              onSave: _toggleSaved,
              onShare: _shareEvent,
              onInfo: _openEventInfo,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Background image with fallback ────────────────────────────────────────

class _BackgroundImage extends StatelessWidget {
  const _BackgroundImage({required this.coverUrl});
  final String coverUrl;

  @override
  Widget build(BuildContext context) {
    if (coverUrl.isEmpty) return const _FallbackBackground();

    if (coverUrl.startsWith('http')) {
      return CachedNetworkImage(
        imageUrl: coverUrl,
        fit: BoxFit.cover,
        width: double.infinity,
        placeholder: (_, __) => const _FallbackBackground(),
        errorWidget: (_, __, ___) => const _FallbackBackground(),
      );
    }

    return Image.file(
      File(coverUrl),
      fit: BoxFit.cover,
      width: double.infinity,
      errorBuilder: (_, __, ___) => const _FallbackBackground(),
    );
  }
}

class _FallbackBackground extends StatelessWidget {
  const _FallbackBackground();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.textPrimary,
      child: const Center(
        child: Icon(Icons.calendar_today_outlined, color: Colors.white, size: 64),
      ),
    );
  }
}

// ─── Bottom-left event info overlay ────────────────────────────────────────

class _EventInfoOverlay extends StatelessWidget {
  const _EventInfoOverlay({
    required this.event,
    required this.dateLabel,
    required this.onProfileTap,
  });

  final Event event;
  final String dateLabel;
  final VoidCallback onProfileTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Title
        Text(
          event.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTheme.headlineLarge.copyWith(
            color: Colors.white,
            height: 1.2,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // Organizer avatar + name
        GestureDetector(
          onTap: onProfileTap,
          child: Row(
            children: [
              _SmallAvatar(ownerId: event.ownerId),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _OrganizerName(ownerId: event.ownerId),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // Date + venue
        Row(
          children: [
            const Icon(Icons.calendar_today_outlined,
                size: 13, color: Colors.white70),
            const SizedBox(width: AppSpacing.xs),
            Text(
              dateLabel,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white70,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Row(
          children: [
            const Icon(Icons.location_on_outlined,
                size: 13, color: Colors.white70),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                event.venue,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  color: Colors.white70,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ],
    ).animate().fadeIn(duration: 250.ms);
  }
}

class _SmallAvatar extends StatelessWidget {
  const _SmallAvatar({required this.ownerId});
  final String ownerId;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: context.read<AuthService>().fetchUserProfile(ownerId),
      builder: (context, snap) {
        final profile = snap.data;
        final avatarUrl = profile?['avatarUrl'] as String? ?? '';
        final name = profile?['name'] as String? ?? 'O';
        final initial = name.isEmpty ? '?' : name[0].toUpperCase();

        return CircleAvatar(
          radius: 14,
          backgroundColor: AppColors.skeleton,
          backgroundImage: avatarUrl.isNotEmpty && !avatarUrl.startsWith('http')
              ? FileImage(File(avatarUrl))
              : null,
          child: avatarUrl.isEmpty
              ? Text(
                  initial,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                )
              : null,
        );
      },
    );
  }
}

class _OrganizerName extends StatelessWidget {
  const _OrganizerName({required this.ownerId});
  final String ownerId;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: context.read<AuthService>().fetchUserProfile(ownerId),
      builder: (context, snap) {
        final name = snap.data?['name'] as String? ?? 'Organizer';
        return Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        );
      },
    );
  }
}

// ─── Right-side action column ──────────────────────────────────────────────

class _ActionColumn extends StatelessWidget {
  const _ActionColumn({
    required this.following,
    required this.saved,
    required this.loadingSaved,
    required this.onFollow,
    required this.onSave,
    required this.onShare,
    required this.onInfo,
  });

  final bool following;
  final bool saved;
  final bool loadingSaved;
  final VoidCallback onFollow;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback onInfo;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Follow / Following toggle
        _ActionIcon(
          onTap: onFollow,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: following ? AppColors.primary : Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: following
                  ? null
                  : Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
            ),
            child: Icon(
              following ? Icons.check : Icons.person_add_outlined,
              color: Colors.white,
              size: 22,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Save / heart
        _ActionIcon(
          onTap: loadingSaved ? null : onSave,
          child: loadingSaved
              ? const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  saved ? Icons.favorite : Icons.favorite_border,
                  color: saved ? AppColors.accent : Colors.white,
                  size: 30,
                ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Share
        _ActionIcon(
          onTap: onShare,
          child: const Icon(
            Icons.share_outlined,
            color: Colors.white,
            size: 28,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Info
        _ActionIcon(
          onTap: onInfo,
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(
                  color: Colors.white.withValues(alpha: 0.4), width: 1),
            ),
            child: const Center(
              child: Text(
                'i',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({required this.onTap, required this.child});
  final VoidCallback? onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: child,
    );
  }
}

// ─── Event info bottom sheet (DraggableScrollableSheet) ────────────────────

/// Rich preview sheet opened from the feed card's "i" action.
///
/// Shows title/category, organizer + follow toggle, when/where, a ticket
/// summary, and a short description, with a fast RSVP path straight into
/// registration plus a link to the full event page. Follow state reads the
/// live [FollowService] stream and toggles through the card's own
/// `_toggleFollow`, so the sheet and the card's follow icon stay in sync.
class _EventInfoSheet extends StatelessWidget {
  const _EventInfoSheet({required this.event, required this.onFollow});

  final Event event;

  /// The feed card's follow toggle — one service call updates the card's
  /// icon; this sheet's button reflects it via the live follow stream.
  final VoidCallback onFollow;

  /// Fast path: straight into the registration form, skipping EventPage.
  void _rsvp(BuildContext context) {
    final tiers = [...event.ticketTypes]
      ..sort((a, b) => a.effectivePrice.compareTo(b.effectivePrice));
    final ticketType = tiers.isNotEmpty ? tiers.first.name : 'Free';
    final remaining =
        context.read<EventService>().remainingCapacity(event.id, ticketType);
    if (remaining == 0) return;

    final navigator = Navigator.of(context);
    navigator.pop();
    navigator.push(
      MaterialPageRoute(
        builder: (_) => RegistrationFormScreen(
          eventId: event.id,
          ticketType: ticketType,
        ),
      ),
    );
  }

  void _openFullDetails(BuildContext context) {
    final navigator = Navigator.of(context);
    navigator.pop();
    navigator.push(
      MaterialPageRoute(builder: (_) => EventPageScreen(eventId: event.id)),
    );
  }

  String _capitalize(String v) =>
      v.isEmpty ? v : v[0].toUpperCase() + v.substring(1);

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('EEE, d MMM yyyy').format(event.date);
    final timeLabel = DateFormat('h:mm a').format(event.date);
    final tierCount = event.ticketTypes.length;
    final hasDescription = event.description.trim().isNotEmpty;
    final bottomSafe = MediaQuery.of(context).padding.bottom;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.95,
      minChildSize: 0.3,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                AppColors.skeleton.withValues(alpha: 0.7),
                AppColors.surface.withValues(alpha: 0.97),
                AppColors.surface,
              ],
              stops: const [0.0, 0.12, 0.28],
            ),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: ListView(
            controller: scrollController,
            padding: EdgeInsets.fromLTRB(
              AppSpacing.xl,
              0,
              AppSpacing.xl,
              AppSpacing.lg + bottomSafe,
            ),
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // ── Title + category pill ──
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      event.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.headlineLarge.copyWith(height: 1.2),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.10),
                      borderRadius:
                          BorderRadius.circular(AppTheme.radiusPill),
                    ),
                    child: Text(
                      _capitalize(event.category),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),

              // ── Organizer row + compact follow toggle ──
              Row(
                children: [
                  _SmallAvatar(ownerId: event.ownerId),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: FutureBuilder<Map<String, dynamic>?>(
                      future: context
                          .read<AuthService>()
                          .fetchUserProfile(event.ownerId),
                      builder: (context, snap) {
                        final name =
                            snap.data?['name'] as String? ?? 'Organizer';
                        return Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  _SheetFollowButton(ownerId: event.ownerId, onFollow: onFollow),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),

              // ── Date/time + venue ──
              _SheetInfoRow(
                icon: IconsaxPlusLinear.calendar,
                text: '$dateLabel · $timeLabel',
              ),
              const SizedBox(height: AppSpacing.md),
              _SheetInfoRow(
                icon: IconsaxPlusLinear.location,
                text: event.venue.isEmpty ? 'Venue TBA' : event.venue,
              ),
              const SizedBox(height: AppSpacing.xl),

              // ── Ticket summary ──
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(IconsaxPlusLinear.ticket,
                        size: 16, color: AppColors.textMuted),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: event.isFree
                        ? Text(
                            'Free',
                            style: AppTheme.headlineMedium
                                .copyWith(color: AppColors.success),
                          )
                        : Row(
                            children: [
                              Text(
                                tierCount > 1
                                    ? 'From GHS ${event.cheapestPrice.toStringAsFixed(0)}'
                                    : 'GHS ${event.cheapestPrice.toStringAsFixed(0)}',
                                style: AppTheme.headlineMedium,
                              ),
                              if (tierCount > 1) ...[
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Text(
                                    '$tierCount ticket types',
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                  ),
                ],
              ),

              // ── Description preview ──
              if (hasDescription) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  event.description.trim(),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.45,
                    color: AppColors.textMuted,
                  ),
                ),
              ],

              // ── Actions ──
              const SizedBox(height: AppSpacing.lg),
              const Divider(),
              const SizedBox(height: AppSpacing.lg),
              PrimaryButton(
                label: event.isFree ? 'RSVP' : 'Get tickets',
                onPressed: () => _rsvp(context),
              ),
              Center(
                child: TextActionButton(
                  label: 'View full details',
                  onPressed: () => _openFullDetails(context),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Sheet sub-widgets ─────────────────────────────────────────────────────

class _SheetInfoRow extends StatelessWidget {
  const _SheetInfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 16, color: AppColors.textMuted),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 1.4,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}

/// Compact Follow/Following pill for the sheet. Displays live follow state
/// and delegates the toggle to the feed card so both stay in sync.
class _SheetFollowButton extends StatelessWidget {
  const _SheetFollowButton({required this.ownerId, required this.onFollow});

  final String ownerId;
  final VoidCallback onFollow;

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';

    Widget button(bool following) {
      return GestureDetector(
        onTap: onFollow,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: following ? AppColors.primary : AppColors.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusPill),
            border: Border.all(
              color: following ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (following) ...[
                const Icon(Icons.check, size: 12, color: Colors.white),
                const SizedBox(width: AppSpacing.xs),
              ],
              Text(
                following ? 'Following' : 'Follow',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: following ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (uid.isEmpty) return button(false);

    return StreamBuilder<bool>(
      stream: context.read<FollowService>().isFollowingStream(uid, ownerId),
      builder: (context, snapshot) => button(snapshot.data ?? false),
    );
  }
}
