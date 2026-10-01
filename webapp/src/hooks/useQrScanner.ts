import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

export type QrScannerStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'unsupported' | 'error';

export interface QrScanner {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  status: QrScannerStatus;
  lastResult: string | null;
  start: () => void;
  stop: () => void;
}

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
type ScannerControls = { stop: () => void };

/** An identical code is not re-emitted for this long after it was processed. */
const SAME_CODE_WINDOW_MS = 2_000;
/** Decoding pauses briefly after any successful hit, so one code isn't reprocessed every frame. */
const SCAN_PAUSE_MS = 1_500;

function createDetector(): BarcodeDetectorInstance | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (typeof ctor !== 'function') return null;
  try {
    return new ctor({ formats: ['qr_code'] });
  } catch {
    return null; // Detector exists but can't do QR — fall back to the JS decoder.
  }
}

function classifyCameraError(err: unknown): QrScannerStatus {
  const name = err instanceof DOMException ? err.name : (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'unsupported';
  }
  return 'error';
}

/**
 * Real QR scanning: native BarcodeDetector where available, @zxing/browser as the
 * Safari/Firefox fallback. Owns the camera stream (acquired here so permission
 * errors are classified honestly) and always releases it on stop, tab-hide and unmount.
 */
export function useQrScanner(onResult: (code: string) => void): QrScanner {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<QrScannerStatus>('idle');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const wantedRef = useRef(false);
  const genRef = useRef(0);
  const lastCodeRef = useRef('');
  const lastCodeAtRef = useRef(0);
  const resumeAtRef = useRef(0);

  const teardown = useCallback(() => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    detectingRef.current = false;
    controlsRef.current?.stop();
    controlsRef.current = null;
    detectorRef.current = null;
    const video = videoRef.current;
    if (video != null && video.srcObject != null) {
      try {
        video.pause();
      } catch {
        // jsdom / detached element — pause is best-effort.
      }
      video.srcObject = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleCode = useCallback((raw: string) => {
    const code = raw.trim();
    if (code === '') return;
    const now = Date.now();
    if (now < resumeAtRef.current) return;
    if (code === lastCodeRef.current && now - lastCodeAtRef.current < SAME_CODE_WINDOW_MS) return;
    lastCodeRef.current = code;
    lastCodeAtRef.current = now;
    resumeAtRef.current = now + SCAN_PAUSE_MS;
    setLastResult(code);
    onResultRef.current(code);
  }, []);

  const begin = useCallback(
    async (gen: number): Promise<void> => {
      teardown();
      const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
      if (mediaDevices == null || typeof mediaDevices.getUserMedia !== 'function') {
        if (gen === genRef.current) setStatus('unsupported');
        return;
      }
      if (gen === genRef.current) setStatus('requesting');
      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (err) {
        if (gen === genRef.current) setStatus(classifyCameraError(err));
        return;
      }
      if (gen !== genRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video == null) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (gen === genRef.current) setStatus('error');
        return;
      }
      try {
        video.srcObject = stream;
      } catch {
        // No srcObject support (jsdom/exotic engines) — decoding still gets the
        // stream from zxing or fails into the error status.
      }
      try {
        await video.play();
      } catch {
        // Muted + playsInline autoplays everywhere we support; if play() still
        // rejects the stream stays attached and decoding can continue.
      }
      if (gen !== genRef.current) {
        teardown();
        return;
      }
      const detector = createDetector();
      if (detector != null) {
        detectorRef.current = detector;
        if (gen === genRef.current) setStatus('scanning');
        const step = () => {
          rafRef.current = null;
          if (gen !== genRef.current) return;
          rafRef.current = window.requestAnimationFrame(step);
          void (async () => {
            if (detectingRef.current || Date.now() < resumeAtRef.current) return;
            const el = videoRef.current;
            if (el == null || el.readyState < 2) return;
            detectingRef.current = true;
            try {
              const codes = await detectorRef.current?.detect(el);
              if (gen === genRef.current && codes != null && codes.length > 0) {
                handleCode(String(codes[0]?.rawValue ?? ''));
              }
            } catch {
              // Transient detection failures (frame not ready) are non-fatal.
            } finally {
              detectingRef.current = false;
            }
          })();
        };
        rafRef.current = window.requestAnimationFrame(step);
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (gen !== genRef.current) {
          teardown();
          return;
        }
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result != null && gen === genRef.current) handleCode(result.getText());
        });
        if (gen !== genRef.current) {
          controls.stop();
          teardown();
          return;
        }
        controlsRef.current = controls;
        setStatus('scanning');
      } catch (err) {
        if (gen !== genRef.current) return;
        teardown();
        setStatus(err instanceof Error && err.name === 'NotAllowedError' ? 'denied' : 'error');
      }
    },
    [handleCode, teardown],
  );

  const start = useCallback(() => {
    wantedRef.current = true;
    resumeAtRef.current = 0;
    void begin(++genRef.current);
  }, [begin]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    genRef.current += 1;
    teardown();
    setStatus('idle');
  }, [teardown]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        genRef.current += 1;
        teardown();
      } else if (wantedRef.current) {
        void begin(++genRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wantedRef.current = false;
      genRef.current += 1;
      teardown();
    };
  }, [begin, teardown]);

  return { videoRef, status, lastResult, start, stop };
}
