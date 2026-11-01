/**
 * Fixed photographic backdrop layer (section 4.3).
 *
 * Sits at position: fixed; inset: 0; z-index: -1 (no background-attachment: fixed
 * scroll jank). Renders responsive WebP with LQIP placeholder, CSS-only fallback,
 * and respects Save-Data / prefers-reduced-data.
 */
import { useEffect, useState } from 'react';
import { BACKGROUNDS } from '../../theme/backgrounds';

export interface PageBackdropProps {
  variant?: 'app' | 'auth';
  mode?: 'rich' | 'soft' | 'none';
  className?: string;
}

export function PageBackdrop({
  variant = 'app',
  mode = 'rich',
  className = '',
}: PageBackdropProps) {
  const [loaded, setLoaded] = useState(false);
  const [reducedData, setReducedData] = useState(false);

  useEffect(() => {
    // Check Save-Data header/connection flag or prefers-reduced-data media query
    const nav = navigator as unknown as { connection?: { saveData?: boolean } };
    const saveData = Boolean(nav.connection?.saveData);
    const mql = window.matchMedia('(prefers-reduced-data: reduce)');
    setReducedData(saveData || mql.matches);
  }, []);

  if (mode === 'none') {
    return null;
  }

  const bg = BACKGROUNDS[variant];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* CSS-only baseline: dual radial highlights + gradient. Always painted first */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundColor: 'var(--eh-background)',
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(43, 95, 255, 0.45) 0%, transparent 45%),
            radial-gradient(circle at 85% 80%, rgba(27, 0, 85, 0.5) 0%, transparent 50%),
            linear-gradient(160deg, rgba(43, 95, 255, 0.78) 0%, rgba(27, 0, 85, 0.88) 100%)
          `,
        }}
      />

      {/* Responsive photograph (unless reduced-data is active) */}
      {!reducedData && (
        <>
          {/* LQIP low-quality blurred placeholder */}
          <div
            className={`absolute inset-0 scale-105 bg-cover bg-center filter blur-lg transition-opacity duration-500 ${
              loaded ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              backgroundImage: `url(${bg.lqip})`,
            }}
          />

          <picture>
            <source srcSet={bg.srcSet} type="image/webp" />
            <img
              src={bg.src}
              alt={bg.alt}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setLoaded(true)}
              className={`h-full w-full object-cover object-center transition-opacity duration-700 ${
                loaded ? 'opacity-100' : 'opacity-0'
              } ${mode === 'soft' ? 'filter blur-2xl scale-110' : ''}`}
            />
          </picture>
        </>
      )}

      {/* Rich overlay vs Soft tinted wash */}
      {mode === 'rich' ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(160deg, rgba(43, 95, 255, 0.78) 0%, rgba(27, 0, 85, 0.88) 100%)',
          }}
        />
      ) : (
        /* Soft mode: ≥90% background-tinted wash heavily muting the photo */
        <div className="absolute inset-0 bg-background/92 backdrop-blur-3xl" />
      )}
    </div>
  );
}
