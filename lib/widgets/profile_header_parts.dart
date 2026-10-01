import 'dart:io';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Cover/banner image area used by profile headers.
///
/// Falls back to a rich cobalt→pink duotone wash — the app's on-brand
/// "colorful" language — when no [bannerUrl] is set (or the image fails to
/// load), keeps a light primary wash at the bottom edge when a photo is
/// present so the overlapping avatar and identity block transition smoothly,
/// and rounds its bottom corners to match the event header band's shape.
class ProfileBanner extends StatelessWidget {
  const ProfileBanner({
    super.key,
    required this.bannerUrl,
    this.height = 150,
  });

  final String bannerUrl;

  /// Total height. Profile screens pass a taller value so the banner can run
  /// behind the transparent app bar.
  final double height;

  Widget _fallback() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary.withValues(alpha: 0.9),
            AppColors.accent.withValues(alpha: 0.35),
          ],
        ),
      ),
      child: const SizedBox.expand(),
    );
  }

  /// Light primary→transparent wash over the bottom ~40% of a real photo:
  /// just enough to soften the cut to the white surface below, without
  /// obscuring the image (much lighter than the event header band's tint).
  Widget _bottomWash() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          stops: const [0, 0.4],
          colors: [
            AppColors.primary.withValues(alpha: 0.35),
            AppColors.primary.withValues(alpha: 0),
          ],
        ),
      ),
      child: const SizedBox.expand(),
    );
  }

  /// Very light top scrim so the white status-bar icons and app-bar title
  /// stay legible over bright banner content (the counterpart to the bottom
  /// wash — subtle enough not to mute the colour).
  Widget _topScrim() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: const [0, 0.3],
          colors: [
            Colors.black.withValues(alpha: 0.18),
            Colors.black.withValues(alpha: 0),
          ],
        ),
      ),
      child: const SizedBox.expand(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = bannerUrl.isNotEmpty;

    Widget? image;
    if (hasImage) {
      if (bannerUrl.startsWith('http')) {
        image = Image.network(
          bannerUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          height: height,
          errorBuilder: (_, __, ___) => _fallback(),
        );
      } else {
        image = Image.file(
          File(bannerUrl),
          fit: BoxFit.cover,
          width: double.infinity,
          height: height,
          errorBuilder: (_, __, ___) => _fallback(),
        );
      }
    }

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _fallback(),
            if (image != null) ...[image, _bottomWash()],
            _topScrim(),
          ],
        ),
      ),
    );
  }
}

/// Large profile avatar (88px image + gradient ring) with image-or-initial
/// fallback, matching the Stage L profile avatar treatment. The ring is a thin
/// primary→accent gradient instead of flat white so the avatar itself carries
/// the banner's duotone identity (decorative accent use only).
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.avatarUrl,
    required this.initial,
    required this.radius,
  });

  final String avatarUrl;
  final String initial;
  final double radius;

  Widget _initial() {
    return Center(
      child: Text(
        initial,
        style: TextStyle(
          fontSize: radius * 0.72,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;

    Widget? image;
    if (avatarUrl.isNotEmpty) {
      if (avatarUrl.startsWith('http')) {
        image = Image.network(
          avatarUrl,
          fit: BoxFit.cover,
          width: size,
          height: size,
          errorBuilder: (_, __, ___) => _initial(),
        );
      } else {
        image = Image.file(
          File(avatarUrl),
          fit: BoxFit.cover,
          width: size,
          height: size,
          errorBuilder: (_, __, ___) => _initial(),
        );
      }
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.accent],
        ),
      ),
      child: ClipOval(
        child: Container(
          width: size,
          height: size,
          decoration: const BoxDecoration(
            color: AppColors.skeleton,
            shape: BoxShape.circle,
          ),
          child: image ?? _initial(),
        ),
      ),
    );
  }
}
