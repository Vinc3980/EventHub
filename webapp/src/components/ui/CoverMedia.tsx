import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { Event } from '../../models';

interface CoverMediaProps {
  url: string;
  className?: string;
  alt?: string;
  style?: CSSProperties;
  /** Rendered when url is empty (the media element takes over otherwise). */
  fallback?: ReactNode;
  /** Called when the media fails to load; default hides the element. */
  onError?: () => void;
}

/**
 * Event cover renderer: a muted looping <video> for video covers (including
 * data-URL uploads), an <img> for everything else, and the caller's fallback
 * when there is no cover at all.
 */
export function CoverMedia({
  url,
  className,
  alt = '',
  style,
  fallback = null,
  onError,
}: CoverMediaProps) {
  if (url.trim() === '') return <>{fallback}</>;

  function handleError(event: SyntheticEvent<HTMLImageElement | HTMLVideoElement>) {
    if (onError) {
      onError();
      return;
    }
    event.currentTarget.style.visibility = 'hidden';
  }

  if (Event.isVideo(url)) {
    return (
      <video
        src={url}
        aria-label={alt === '' ? 'Event cover video' : alt}
        muted
        loop
        playsInline
        preload="metadata"
        className={className}
        style={style}
        onError={handleError}
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className}
      style={style}
      onError={handleError}
    />
  );
}
