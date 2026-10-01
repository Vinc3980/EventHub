import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/event_model.dart';
import '../screens/attendee/event_page.dart';
import '../theme/app_colors.dart';
import 'status_tag.dart';

/// Minimal Instagram-style grid tile for profile event grids.
///
/// Full-bleed cover image in a square tile with only two overlays:
/// a compact [StatusTag] in the top-right and — for paid events — a small
/// ticket icon in the bottom-left (à la Instagram's carousel/reel
/// indicators). No title, date, or organizer text on the tile itself.
/// Tapping opens the full [EventPageScreen].
class EventGridTile extends StatelessWidget {
  const EventGridTile({super.key, required this.event, this.status});

  final Event event;

  /// Optional badge status override — e.g. the attendee's booking status
  /// ('confirmed') instead of the event's own status. Falls back to
  /// [Event.status] when null/empty.
  final String? status;

  @override
  Widget build(BuildContext context) {
    final badge =
        (status == null || status!.isEmpty) ? event.status : status!;

    return Semantics(
      label: '${event.title}, $badge',
      button: true,
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => EventPageScreen(eventId: event.id),
          ),
        ),
        child: Container(
          decoration: const BoxDecoration(color: AppColors.skeleton),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _Cover(coverUrl: event.coverImageUrl),
              Positioned(top: 6, right: 6, child: StatusTag(status: badge, compact: true)),
              if (!event.isFree)
                const Positioned(
                  left: 8,
                  bottom: 8,
                  child: Icon(
                    Icons.confirmation_number,
                    size: 16,
                    color: Colors.white,
                    shadows: [
                      Shadow(
                        color: Colors.black45,
                        offset: Offset(0, 1),
                        blurRadius: 2,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.coverUrl});

  final String coverUrl;

  @override
  Widget build(BuildContext context) {
    if (coverUrl.isEmpty) return const _Placeholder();

    if (coverUrl.startsWith('http')) {
      return CachedNetworkImage(
        imageUrl: coverUrl,
        fit: BoxFit.cover,
        placeholder: (_, __) => const _Placeholder(),
        errorWidget: (_, __, ___) => const _Placeholder(),
      );
    }

    return Image.file(
      File(coverUrl),
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => const _Placeholder(),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.skeleton,
      child: const Center(
        child: Icon(Icons.event_outlined, size: 24, color: AppColors.textMuted),
      ),
    );
  }
}
