import 'dart:io';

import 'package:animations/animations.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/event_model.dart';
import '../screens/attendee/event_page.dart';
import '../screens/organizer/organizer_profile_screen.dart';
import '../services/auth_service.dart';
import '../services/follow_service.dart';
import '../theme/app_colors.dart';
import 'status_tag.dart';

class EventCard extends StatefulWidget {
  const EventCard({super.key, required this.event, this.onTap});

  final Event event;
  final VoidCallback? onTap;

  @override
  State<EventCard> createState() => _EventCardState();
}

class _EventCardState extends State<EventCard> {
  bool _saved = false;
  bool _loadingSaved = true;

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final uid = context.read<AuthService>().currentUid;
    if (uid == null) {
      if (mounted) setState(() => _loadingSaved = false);
      return;
    }
    final profile = await context.read<AuthService>().fetchUserProfile(uid);
    final saved =
        List<String>.from(profile?['savedEventIds'] as List? ?? const []);
    if (mounted) {
      setState(() {
        _saved = saved.contains(widget.event.id);
        _loadingSaved = false;
      });
    }
  }

  Future<void> _toggleSaved() async {
    final uid = context.read<AuthService>().currentUid;
    if (uid == null) return;
    final updated = await context
        .read<AuthService>()
        .toggleSaveEvent(uid, widget.event.id);
    if (mounted) {
      setState(() => _saved = updated.contains(widget.event.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateLabel =
        DateFormat('EEE, d MMM yyyy').format(widget.event.date);

    return Semantics(
      label: '${widget.event.title}, $dateLabel, ${widget.event.status}',
      button: true,
      child: OpenContainer(
        transitionDuration: const Duration(milliseconds: 350),
        openBuilder: (context, _) =>
            EventPageScreen(eventId: widget.event.id),
        closedShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        closedElevation: 0,
        closedColor: AppColors.surface,
        closedBuilder: (context, openContainer) {
          return GestureDetector(
            onTap: widget.onTap ?? openContainer,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AspectRatio(
                    aspectRatio: 16 / 10,
                    child: _Cover(event: widget.event),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.event.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(IconsaxPlusLinear.calendar,
                                size: 13, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                dateLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            if (widget.event.isCurrentlyFeatured)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color:
                                      AppColors.accent.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(100),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(IconsaxPlusBold.star,
                                        size: 9, color: AppColors.accent),
                                    SizedBox(width: 3),
                                    Text(
                                      'Featured',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.accent,
                                        letterSpacing: 0.2,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            StatusTag(
                                status: widget.event.status, compact: true),
                            GestureDetector(
                              onTap: _toggleSaved,
                              child: _loadingSaved
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 1.5),
                                    )
                                  : Icon(
                                      _saved
                                          ? IconsaxPlusBold.bookmark
                                          : IconsaxPlusLinear.bookmark,
                                      size: 18,
                                      color: _saved
                                          ? AppColors.accent
                                          : AppColors.textMuted,
                                    ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _OrganizerChip(ownerId: widget.event.ownerId),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    if (event.coverImageUrl.isNotEmpty) {
      if (event.coverImageUrl.startsWith('http')) {
        return CachedNetworkImage(
          imageUrl: event.coverImageUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          placeholder: (_, __) => const _Placeholder(),
          errorWidget: (_, __, ___) => const _Placeholder(),
        );
      } else {
        return Image.file(
          File(event.coverImageUrl),
          fit: BoxFit.cover,
          width: double.infinity,
          errorBuilder: (_, __, ___) => const _Placeholder(),
        );
      }
    }
    return const _Placeholder();
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.16),
      child: const Center(
        child: Icon(IconsaxPlusLinear.calendar,
            color: AppColors.primary, size: 36),
      ),
    );
  }
}

class _OrganizerChip extends StatelessWidget {
  const _OrganizerChip({required this.ownerId});
  final String ownerId;

  @override
  Widget build(BuildContext context) {
    final currentUid = context.read<AuthService>().currentUid ?? '';
    final isSelf = currentUid == ownerId;

    return FutureBuilder<Map<String, dynamic>?>(
      future: context.read<AuthService>().fetchUserProfile(ownerId),
      builder: (context, snapshot) {
        final data = snapshot.data;
        final name = data?['name'] as String? ?? '';
        if (name.isEmpty) return const SizedBox.shrink();
        final initial = name[0].toUpperCase();
        return Row(
          children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) =>
                          OrganizerProfileScreen(organizerId: ownerId),
                    ),
                  );
                },
                child: Row(
                  children: [
                    Container(
                      width: 20,
                      height: 20,
                      decoration: const BoxDecoration(
                        color: AppColors.skeleton,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          initial,
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (!isSelf && currentUid.isNotEmpty) ...[
              const SizedBox(width: 6),
              _CompactFollowButton(targetUserId: ownerId),
            ],
          ],
        );
      },
    );
  }
}

class _CompactFollowButton extends StatefulWidget {
  const _CompactFollowButton({required this.targetUserId});
  final String targetUserId;

  @override
  State<_CompactFollowButton> createState() => _CompactFollowButtonState();
}

class _CompactFollowButtonState extends State<_CompactFollowButton> {
  bool _loading = false;

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
        return GestureDetector(
          onTap: _loading
              ? null
              : () async {
                  setState(() => _loading = true);
                  await context.read<FollowService>().toggleFollow(
                        currentUid,
                        widget.targetUserId,
                      );
                  if (mounted) setState(() => _loading = false);
                },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isFollowing ? AppColors.skeleton : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: isFollowing ? AppColors.border : AppColors.primary,
                  width: 1,
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(strokeWidth: 1.5),
                    )
                  : Text(
                      isFollowing ? 'Following' : 'Follow',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: isFollowing
                            ? AppColors.textMuted
                            : AppColors.primary,
                      ),
                    ),
          ),
        );
      },
    );
  }
}
