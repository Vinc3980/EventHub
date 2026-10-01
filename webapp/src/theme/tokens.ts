/**
 * EventHub design tokens — THE single source of truth for colour, type,
 * spacing, radius and elevation. Mirrors `lib/theme/app_colors.dart` and
 * `lib/theme/app_spacing.dart` in the Flutter app, extended with the derived
 * tokens required by the web design system (section 1 of the spec).
 *
 * No raw hex may appear anywhere else in the codebase: components use the
 * Tailwind theme classes generated from this file (see `tailwind.config.ts`)
 * or the CSS custom properties written by `applyThemeTokens()` in
 * `theme/global.css`.
 */

export type RGB = readonly [number, number, number];

/** Parse "#2B5FFF" into an RGB triple. */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ] as const;
}

/** Alpha-blend `top` over `bottom` at `alpha` (0..1) — Flutter's alphaBlend. */
export function blend(top: string, bottom: string, alpha: number): string {
  const t = hexToRgb(top);
  const b = hexToRgb(bottom);
  const mix = (i: number) => Math.round(t[i] * alpha + b[i] * (1 - alpha));
  return rgbToHex([mix(0), mix(1), mix(2)]);
}

export function rgbToHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** primary @ alpha over surface (used for tints/chips). */
export function tint(color: string, alpha: number, over = COLORS.surface): string {
  return blend(color, over, alpha);
}

// ---------------------------------------------------------------------------
// Core palette
// ---------------------------------------------------------------------------
export const COLORS = {
  /** Cobalt Blue — buttons, links, selected states, app bar */
  primary: '#2B5FFF',
  /** Neon Pink — narrow use only (see RESERVED_ACCENT_USES) */
  accent: '#FF2E93',

  /** default page background */
  background: '#FAFAFA',
  /** cards, sheets */
  surface: '#FFFFFF',

  /** body/headings */
  textPrimary: '#16171A',
  /** secondary text */
  textMuted: '#6B7280',

  /** hairlines, dividers */
  border: '#E5E7EB',

  /** confirmed, published, applied */
  success: '#17B26A',
  successBg: '#D4F5E2',

  /** errors, destructive */
  danger: '#E5484D',
  dangerBg: '#FDE1E1',

  /** pending states */
  warning: '#F59E0B',
  warningBg: '#FEF3C7',

  /** unselected chips, disabled */
  neutral: '#9CA3AF',
  neutralBg: '#F3F4F6',

  /** loading shimmer */
  skeleton: '#EBEBEB',

  /** pure white + black used only for scrims/overlays on media */
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorName = keyof typeof COLORS;

/**
 * The ONLY places accent pink may be used (plus the avatar gradient ring):
 *  1. Featured badges
 *  2. Active/filled save (heart/bookmark)
 *  3. Filled star ratings
 *  4. Pinned-message highlight
 *  5. Unread dots
 *  6. Filled "liked" heart on a feed post
 */
export const RESERVED_ACCENT_USES = [
  'featured-badge',
  'filled-save',
  'filled-star-rating',
  'pinned-message',
  'unread-dot',
  'avatar-gradient-ring',
  'liked-heart',
] as const;

// ---------------------------------------------------------------------------
// Derived tokens (computed, never hard-coded)
// ---------------------------------------------------------------------------

/** primary at 6% alpha blended over surface → ≈ #F2F5FF */
export const backgroundTinted = blend(COLORS.primary, COLORS.surface, 0.06);

/**
 * accent at ~55% alpha blended over primary → rich, dark, violet-leaning blue.
 * Used only for the Explore backdrop gradient and the profile duotone banner.
 */
export const deepViolet = blend(COLORS.accent, COLORS.primary, 0.55);

/** Chip / icon-chip / fallback-tile tints. */
export const tints = {
  primary6: blend(COLORS.primary, COLORS.surface, 0.06),
  primary8: blend(COLORS.primary, COLORS.surface, 0.08),
  primary10: blend(COLORS.primary, COLORS.surface, 0.1),
  primary14: blend(COLORS.primary, COLORS.surface, 0.14),
  primary16: blend(COLORS.primary, COLORS.surface, 0.16),
  accent10: blend(COLORS.accent, COLORS.surface, 0.1),
  accent12: blend(COLORS.accent, COLORS.surface, 0.12),
} as const;

// ---------------------------------------------------------------------------
// Spacing (4-pt grid)
// ---------------------------------------------------------------------------
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------
export const RADIUS = { sm: 8, md: 12, base: 16, lg: 24, pill: 100 } as const;

// ---------------------------------------------------------------------------
// Typography — Plus Jakarta Sans
// ---------------------------------------------------------------------------
export const FONT_FAMILY = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

export const TYPOGRAPHY = {
  display: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.3px' },
  title: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.2px' },
  subtitle: { fontSize: 16, fontWeight: 700 },
  body: { fontSize: 14, fontWeight: 500 },
  caption: { fontSize: 12, fontWeight: 500 },
  sectionLabel: { fontSize: 13, fontWeight: 600 },
  button: { fontSize: 15, fontWeight: 700 },
} as const;

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------
export const SHADOW = {
  /** cobalt-tinted card shadow for light backgrounds */
  card: '0 4px 16px rgba(43, 95, 255, 0.07)',
  /** dark-surface shadow for the Explore backdrop */
  dark: '0 6px 20px rgba(0, 0, 0, 0.20)',
} as const;

// ---------------------------------------------------------------------------
// Motion (calm — funerals share the app with weddings)
// ---------------------------------------------------------------------------
export const MOTION = {
  durationMs: 250,
  staggerMs: 60,
  /** max slide distance in px (≈4% of a small card) */
  slidePx: 8,
} as const;

// ---------------------------------------------------------------------------
// Tailwind theme fragment (consumed by tailwind.config.ts)
// ---------------------------------------------------------------------------
export const tailwindColors: Record<string, string> = {
  primary: COLORS.primary,
  'primary-6': tints.primary6,
  'primary-8': tints.primary8,
  'primary-10': tints.primary10,
  'primary-14': tints.primary14,
  'primary-16': tints.primary16,
  accent: COLORS.accent,
  'accent-10': tints.accent10,
  'accent-12': tints.accent12,
  background: COLORS.background,
  'background-tinted': backgroundTinted,
  surface: COLORS.surface,
  deepviolet: deepViolet,
  textprimary: COLORS.textPrimary,
  textmuted: COLORS.textMuted,
  border: COLORS.border,
  success: COLORS.success,
  successbg: COLORS.successBg,
  danger: COLORS.danger,
  dangerbg: COLORS.dangerBg,
  warning: COLORS.warning,
  warningbg: COLORS.warningBg,
  neutral: COLORS.neutral,
  neutralbg: COLORS.neutralBg,
  skeleton: COLORS.skeleton,
};
