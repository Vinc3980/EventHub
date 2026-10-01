import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { setSessionUid } from '../db/db';
import { useQrScanner } from '../hooks/useQrScanner';
import { seedIfEmpty } from '../services/seedService';
import { putEvent } from './helpers';
import { resetDatabase } from './setup';

type MediaStreamLike = { getTracks(): Array<{ stop: () => void }> };

const originalMediaDevices = Object.getOwnPropertyDescriptor(Navigator.prototype, 'mediaDevices');
const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

function setMediaDevices(value: unknown): void {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, writable: true, value });
}

function setHiddenFlag(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

function fakeStream(trackStop: () => void): MediaStreamLike {
  return { getTracks: () => [{ stop: trackStop }] };
}

class FakeBarcodeDetector {
  static codes: string[] = [];
  detect: () => Promise<Array<{ rawValue: string }>>;

  constructor() {
    this.detect = async () => FakeBarcodeDetector.codes.map((rawValue) => ({ rawValue }));
  }
}

function ScannerHarness({ onResult }: { onResult: (code: string) => void }) {
  const scanner = useQrScanner(onResult);
  return (
    <div>
      <video
        ref={(element) => {
          scanner.videoRef.current = element;
          if (element != null) {
            Object.defineProperty(element, 'readyState', { configurable: true, get: () => 4 });
            element.play = () => Promise.resolve();
            element.pause = () => undefined;
          }
        }}
        playsInline
        muted
        autoPlay
        data-testid="scanner-video"
      />
      <output data-testid="status">{scanner.status}</output>
      <output data-testid="last-result">{scanner.lastResult ?? ''}</output>
      <button type="button" onClick={() => scanner.start()}>
        Start
      </button>
      <button type="button" onClick={() => scanner.stop()}>
        Stop
      </button>
    </div>
  );
}

beforeEach(async () => {
  await resetDatabase();
  window.localStorage.clear();
  FakeBarcodeDetector.codes = [];
  delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
});

afterEach(() => {
  if (originalMediaDevices != null) {
    Object.defineProperty(Navigator.prototype, 'mediaDevices', originalMediaDevices);
  }
  if (originalHidden != null) {
    Object.defineProperty(Document.prototype, 'hidden', originalHidden);
  }
  delete (document as unknown as { hidden?: unknown }).hidden;
  delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  vi.restoreAllMocks();
});

describe('scan screen — camera path', () => {
  it('states camera scanning is unsupported here and keeps manual/search fallbacks usable', async () => {
    await seedIfEmpty();
    await setSessionUid('org-1');
    await putEvent({ id: 'ev-scan-camera', title: 'Doors' });
    window.history.pushState({}, '', '/organizer/events/ev-scan-camera/scan');
    render(<App />);

    expect(
      await screen.findByText(/This device doesn't support camera scanning/, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simulate scan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry camera' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Manual code entry' }));
    expect(await screen.findByRole('heading', { name: 'Enter code manually' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ticket code')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Search by name' }));
    expect(await screen.findByRole('heading', { name: 'Search by attendee name' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
  }, 30_000);

  it('surfaces the per-device check-in notice once per event until it is dismissed', async () => {
    await seedIfEmpty();
    await setSessionUid('org-1');
    await putEvent({ id: 'ev-scan-notice', title: 'Doors' });
    window.history.pushState({}, '', '/organizer/events/ev-scan-notice/scan');
    const view = render(<App />);

    expect(
      await screen.findByText(/Check-ins sync live across tabs on this device/, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss check-in sync notice' }));
    expect(screen.queryByText(/Check-ins sync live across tabs on this device/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('eh:scan-checkin-note:ev-scan-notice')).toBe('1');

    view.unmount();
    render(<App />);
    expect(await screen.findByRole('tablist', { name: 'Scan mode' }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByText(/Check-ins sync live across tabs on this device/)).not.toBeInTheDocument();
  }, 30_000);
});

describe('useQrScanner hook', () => {
  it('decodes via BarcodeDetector, debounces repeats, and releases the camera on stop', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn(async () => fakeStream(trackStop));
    setMediaDevices({ getUserMedia });
    (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeBarcodeDetector;
    FakeBarcodeDetector.codes = ['QR-42'];

    const onResult = vi.fn();
    render(<ScannerHarness onResult={onResult} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('scanning'));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1), { timeout: 5_000 });
    expect(onResult).toHaveBeenCalledWith('QR-42');
    expect(screen.getByTestId('last-result').textContent).toBe('QR-42');

    // A QR code held in view keeps producing identical frames — only one call.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onResult).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('idle');
  }, 30_000);

  it('maps a permission denial to the denied status', async () => {
    setMediaDevices({
      getUserMedia: vi.fn(async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
      }),
    });

    render(<ScannerHarness onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('denied'));
  }, 30_000);

  it('reports unsupported when getUserMedia is unavailable', async () => {
    render(<ScannerHarness onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unsupported'));
  }, 30_000);

  it('releases the camera while the tab is hidden and resumes when it becomes visible', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn(async () => fakeStream(trackStop));
    setMediaDevices({ getUserMedia });
    (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeBarcodeDetector;

    render(<ScannerHarness onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('scanning'));
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    setHiddenFlag(true);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(trackStop).toHaveBeenCalledTimes(1));

    setHiddenFlag(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('scanning'));

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(trackStop).toHaveBeenCalledTimes(2);
  }, 30_000);
});
