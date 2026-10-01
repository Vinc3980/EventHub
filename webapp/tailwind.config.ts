import type { Config } from 'tailwindcss';
import {
  COLORS,
  RADIUS,
  SHADOW,
  SPACING,
  backgroundTinted,
  deepViolet,
  tailwindColors,
} from './src/theme/tokens';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: COLORS.white,
      black: COLORS.black,
      ...tailwindColors,
    },
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '800', letterSpacing: '-0.3px' }],
        title: ['20px', { lineHeight: '26px', fontWeight: '700', letterSpacing: '-0.2px' }],
        subtitle: ['16px', { lineHeight: '22px', fontWeight: '700' }],
        body: ['14px', { lineHeight: '21px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '17px', fontWeight: '500' }],
        section: ['13px', { lineHeight: '18px', fontWeight: '600' }],
        button: ['15px', { lineHeight: '20px', fontWeight: '700' }],
      },
      spacing: {
        xs: `${SPACING.xs}px`,
        sm: `${SPACING.sm}px`,
        md: `${SPACING.md}px`,
        lg: `${SPACING.lg}px`,
        xl: `${SPACING.xl}px`,
        xxl: `${SPACING.xxl}px`,
      },
      borderRadius: {
        sm: `${RADIUS.sm}px`,
        md: `${RADIUS.md}px`,
        base: `${RADIUS.base}px`,
        lg: `${RADIUS.lg}px`,
        pill: `${RADIUS.pill}px`,
      },
      boxShadow: {
        card: SHADOW.card,
        dark: SHADOW.dark,
      },
      backgroundImage: {
        'explore-gradient': `linear-gradient(135deg, ${COLORS.primary} 0%, ${deepViolet} 100%)`,
        'profile-duotone': `linear-gradient(135deg, ${COLORS.primary} 0%, ${deepViolet} 60%, ${COLORS.accent} 140%)`,
        'profile-wash': `linear-gradient(to top, rgba(43,95,255,0.35) 0%, rgba(43,95,255,0) 40%)`,
        'feed-scrim': `linear-gradient(to bottom, rgba(22,23,26,0) 0%, rgba(22,23,26,0.85) 100%)`,
        'tinted-page': `linear-gradient(${backgroundTinted}, ${backgroundTinted})`,
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        fadeup: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        fadeup: 'fadeup 250ms ease-out both',
      },
      screens: {
        tablet: '768px',
        desktop: '1024px',
      },
    },
  },
  plugins: [],
};

export default config;
