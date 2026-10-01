import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Maximize, Pause, Play, VolumeHigh, VolumeSlash } from 'iconsax-react';

export interface AppVideoPlayerProps {
  src: string;
  poster?: string;
  /** Sizing/aspect passed through to the wrapper (what callers used to put on `<video>`). */
  className?: string;
  /** Feed behaviour: start muted and play only while the player is mostly on screen. */
  autoPlayMuted?: boolean;
  /** Start muted without the on-screen autoplay behaviour (cover-video style). */
  muted?: boolean;
  loop?: boolean;
  /** Called when the media fails to load (cover screens swap in a fallback). */
  onError?: () => void;
}

function clockTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The app's own video player: a `<video>` without native controls plus a custom
 * bottom control bar (play/pause, seek track in brand primary, time, volume,
 * fullscreen) laid over a gradient scrim. The bar shows while paused or while
 * the pointer moves, and fades out ~2.5s after the last input during playback.
 */
export function AppVideoPlayer({
  src,
  poster,
  className = '',
  autoPlayMuted = false,
  muted = false,
  loop = false,
  onError,
}: AppVideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);
  const userPaused = useRef(false);
  const dragging = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(autoPlayMuted || muted);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barVisible, setBarVisible] = useState(true);

  function scheduleHide(): void {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setBarVisible(true);
    if (videoRef.current && !videoRef.current.paused) {
      hideTimer.current = window.setTimeout(() => setBarVisible(false), 2_500);
    }
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    setPlaying(false);
    userPaused.current = false;
  }, [src]);

  // Feed behaviour: autoplay muted, but only while mostly on screen.
  useEffect(() => {
    if (!autoPlayMuted) return undefined;
    const video = videoRef.current;
    const wrap = wrapRef.current;
    if (!video || !wrap || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const onScreen = entry.isIntersecting && entry.intersectionRatio >= 0.6;
          if (onScreen && !userPaused.current) {
            video.muted = true;
            setIsMuted(true);
            try {
              void video.play()?.catch(() => undefined);
            } catch {
              /* jsdom has no media playback */
            }
          } else if (!onScreen) {
            video.pause();
          }
        }
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [autoPlayMuted]);

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      try {
        void video.play()?.catch(() => undefined);
      } catch {
        /* jsdom has no media playback */
      }
    } else {
      userPaused.current = true;
      video.pause();
    }
  }

  function nudge(deltaSeconds: number): void {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const next = Math.min(Math.max(video.currentTime + deltaSeconds, 0), video.duration);
    video.currentTime = next;
    setCurrent(next);
    scheduleHide();
  }

  function seekAt(clientX: number, track: HTMLDivElement): void {
    const rect = track.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const next = Math.min(Math.max(ratio, 0), 1) * video.duration;
    video.currentTime = next;
    setCurrent(next);
  }

  function onTrackPointerDown(event: PointerEvent<HTMLDivElement>): void {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    seekAt(event.clientX, event.currentTarget);
  }

  function onTrackPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (dragging.current) seekAt(event.clientX, event.currentTarget);
  }

  function onTrackPointerUp(event: PointerEvent<HTMLDivElement>): void {
    dragging.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function toggleMute(): void {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    scheduleHide();
  }

  function toggleFullscreen(): void {
    const wrap = wrapRef.current;
    if (!wrap) return;
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        void document.exitFullscreen?.();
      } else {
        void wrap.requestFullscreen?.();
      }
    } catch {
      /* fullscreen is optional — no-op where unsupported */
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest?.('button, [role="slider"]') != null;
    if (event.key === ' ' || event.key === 'Enter') {
      if (interactive) return;
      event.preventDefault();
      togglePlay();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nudge(-5);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nudge(5);
    }
  }

  const percent = duration > 0 ? Math.min((current / duration) * 100, 100) : 0;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-black ${className}`}
      onPointerMove={scheduleHide}
      onKeyDown={onKeyDown}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop={loop}
        muted={isMuted}
        preload="metadata"
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setPlaying(false);
          setBarVisible(true);
          if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }}
        onTimeUpdate={() => setCurrent(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onVolumeChange={() => setIsMuted(videoRef.current?.muted ?? false)}
        onError={onError}
      />

      {!playing && (
        <button
          type="button"
          aria-label="Play video"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors duration-200 hover:bg-black/60"
        >
          <Play size={26} variant="Bold" />
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
          barVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onFocus={scheduleHide}
      >
        <div className="bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-8">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.max(1, Math.round(duration))}
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${clockTime(current)} of ${clockTime(duration)}`}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
            className="relative h-4 cursor-pointer touch-none"
          >
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-white/25" />
            <span
              className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-primary"
              style={{ width: `${percent}%` }}
            />
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              style={{ left: `${percent}%` }}
            />
          </div>

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={togglePlay}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/15"
            >
              {playing ? <Pause size={16} variant="Bold" /> : <Play size={16} variant="Bold" />}
            </button>
            <span className="text-caption tabular-nums text-white/90">
              {clockTime(current)} / {clockTime(duration)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/15"
            >
              {isMuted ? <VolumeSlash size={16} /> : <VolumeHigh size={16} />}
            </button>
            <button
              type="button"
              aria-label="Fullscreen"
              onClick={toggleFullscreen}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/15"
            >
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
