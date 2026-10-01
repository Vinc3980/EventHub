import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Core palette -----------------------------------------------------------
  static const Color primary = Color(0xFF2B5FFF);
  static const Color accent = Color(0xFFFF2E93);

  // Surfaces ---------------------------------------------------------------
  static const Color background = Color(0xFFFAFAFA);
  static const Color surface = Color(0xFFFFFFFF);

  // Text -------------------------------------------------------------------
  static const Color textPrimary = Color(0xFF16171A);
  static const Color textMuted = Color(0xFF6B7280);

  // Borders / dividers -----------------------------------------------------
  static const Color border = Color(0xFFE5E7EB);

  // Semantic ---------------------------------------------------------------
  static const Color success = Color(0xFF17B26A);
  static const Color danger = Color(0xFFE5484D);

  // Derived surfaces (low-opacity fills) -----------------------------------
  static const Color successBg = Color(0xFFD4F5E2);
  static const Color dangerBg = Color(0xFFFDE1E1);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color neutral = Color(0xFF9CA3AF);
  static const Color neutralBg = Color(0xFFF3F4F6);

  // Derived page tint — primary at 6% blended over surface (≈ #F0F4FF).
  // Screen-scoped exceptions only (e.g. registration form background);
  // the app theme keeps [background].
  static final Color backgroundTinted =
      Color.alphaBlend(primary.withValues(alpha: 0.06), surface);

  // Derived deep violet — accent blended over primary (same alphaBlend
  // technique as the profile banner fallback). A rich, dark, slightly
  // violet-leaning blue built only from the two brand colours; used as the
  // far end of the Explore wallpaper gradient.
  static final Color deepViolet =
      Color.alphaBlend(accent.withValues(alpha: 0.45), primary);

  // Loading skeleton -------------------------------------------------------
  static const Color skeleton = Color(0xFFEBEBEB);

  // Shorthand aliases used by older code ------------------------------------
  static const Color bg = background;
  static const Color card = surface;
}
