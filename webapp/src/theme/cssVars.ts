import { COLORS, SHADOW, backgroundTinted, deepViolet, tints } from './tokens';

/** The cobalt → deep-violet gradient reused by featured hub chips and tiles. */
export const TILE_GRADIENT = `linear-gradient(135deg, ${COLORS.primary} 0%, ${deepViolet} 100%)`;

/**
 * Writes the token file's values as CSS custom properties. `tokens.ts` remains
 * the only place a colour literal exists; this is the single bridge to CSS.
 */
export function applyCssVariables(): void {
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  set('--eh-primary', COLORS.primary);
  set('--eh-accent', COLORS.accent);
  set('--eh-background', COLORS.background);
  set('--eh-surface', COLORS.surface);
  set('--eh-text-primary', COLORS.textPrimary);
  set('--eh-text-muted', COLORS.textMuted);
  set('--eh-border', COLORS.border);
  set('--eh-success', COLORS.success);
  set('--eh-success-bg', COLORS.successBg);
  set('--eh-danger', COLORS.danger);
  set('--eh-danger-bg', COLORS.dangerBg);
  set('--eh-warning', COLORS.warning);
  set('--eh-warning-bg', COLORS.warningBg);
  set('--eh-neutral', COLORS.neutral);
  set('--eh-neutral-bg', COLORS.neutralBg);
  set('--eh-skeleton', COLORS.skeleton);
  set('--eh-background-tinted', backgroundTinted);
  set('--eh-deep-violet', deepViolet);
  set('--eh-tint-primary-10', tints.primary10);
  set('--eh-shadow-card', SHADOW.card);
  set('--eh-shadow-dark', SHADOW.dark);
  set('--eh-tile-gradient', TILE_GRADIENT);
}
