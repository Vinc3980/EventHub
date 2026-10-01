import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CloseCircle, Keyboard, NotificationBing, Profile2User, Scan, TickCircle } from 'iconsax-react';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { relativeStamp } from '../../lib/format';
import { CheckInException, RegistrationService } from '../../services';
import { Button, ErrorState, Input, SearchField, Segmented, Sheet, Skeleton, Spinner } from '../../components/ui';
import { useQrScanner } from '../../hooks/useQrScanner';

const registrationService = new RegistrationService();

type Mode = 'camera' | 'manual' | 'search';

type SearchResult = {
  bookingId: string;
  fullName: string;
  seatNumber: string;
  status: string;
  checkedIn: boolean;
  qrCode: string;
};

type Feedback =
  | { kind: 'success'; fullName: string; seatNumber: string }
  | { kind: 'error'; message: string };

const MODES: { value: Mode; label: string }[] = [
  { value: 'camera', label: 'Scan QR' },
  { value: 'manual', label: 'Manual code entry' },
  { value: 'search', label: 'Search by name' },
];

const SYNC_NOTE_STORAGE_PREFIX = 'eh:scan-checkin-note:';

function readSyncNoteDismissed(eventId: string): boolean {
  try {
    return window.localStorage.getItem(SYNC_NOTE_STORAGE_PREFIX + eventId) === '1';
  } catch {
    return false;
  }
}

export default function QrScannerScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const { toast } = useToast();

  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<Mode>('camera');
  const [manualCode, setManualCode] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [syncNoteDismissed, setSyncNoteDismissed] = useState(() => readSyncNoteDismissed(eventId));

  const { data: recent, error } = useLive(async () => {
    const [bookingRows, regRows] = await Promise.all([db.bookings.toArray(), db.registrations.toArray()]);
    const regs = new Map(regRows.map((row) => [String(row['id']), row]));
    return bookingRows
      .filter((row) => String(row['eventId']) === eventId && row['checkedIn'] === true)
      .sort((a, b) => String(b['checkedInAt'] ?? '').localeCompare(String(a['checkedInAt'] ?? '')))
      .slice(0, 5)
      .map((row) => ({
        id: String(row['id']),
        fullName: String(regs.get(String(row['regId']))?.['fullName'] ?? 'Attendee'),
        seatNumber: String(row['seatNumber'] ?? ''),
        checkedInAt: String(row['checkedInAt'] ?? ''),
      }));
  }, [eventId, retry]);

  const { videoRef, status, start, stop } = useQrScanner((code) => {
    void processCode(code, false);
  });

  useEffect(() => {
    if (mode === 'camera') start();
    else stop();
  }, [mode, start, stop]);

  function dismissSyncNote() {
    setSyncNoteDismissed(true);
    try {
      window.localStorage.setItem(SYNC_NOTE_STORAGE_PREFIX + eventId, '1');
    } catch {
      // Storage unavailable (private mode) — dismissal stays in memory only.
    }
  }

  async function processCode(code: string, allowSeatFallback: boolean): Promise<void> {
    if (busy || code === '') return;
    setBusy(true);
    try {
      const result = await registrationService.checkIn({ eventId, scannedCode: code });
      setFeedback({ kind: 'success', fullName: result.fullName, seatNumber: result.seatNumber });
      setRetry((value) => value + 1);
    } catch (err) {
      if (allowSeatFallback && err instanceof CheckInException && err.code === 'not_found') {
        try {
          const result = await registrationService.checkInBySeat({ eventId, seatNumber: code });
          setFeedback({ kind: 'success', fullName: result.fullName, seatNumber: result.seatNumber });
          setRetry((value) => value + 1);
        } catch (seatErr) {
          setFeedback({
            kind: 'error',
            message:
              seatErr instanceof CheckInException
                ? seatErr.message
                : `Unexpected error: ${seatErr instanceof Error ? seatErr.message : String(seatErr)}`,
          });
        }
      } else {
        setFeedback({
          kind: 'error',
          message:
            err instanceof CheckInException
              ? err.message
              : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitManualCode() {
    const code = manualCode.trim();
    if (code === '') return;
    setManualCode('');
    await processCode(code, true);
  }

  async function searchByName() {
    const term = query.trim().toLowerCase();
    if (term === '') return;
    setSearching(true);
    try {
      const [bookingRows, regRows] = await Promise.all([db.bookings.toArray(), db.registrations.toArray()]);
      const regs = new Map(regRows.map((row) => [String(row['id']), row]));
      const found: SearchResult[] = [];
      for (const row of bookingRows) {
        if (String(row['eventId']) !== eventId) continue;
        const fullName = String(regs.get(String(row['regId']))?.['fullName'] ?? '');
        if (!fullName.toLowerCase().includes(term)) continue;
        found.push({
          bookingId: String(row['id']),
          fullName,
          seatNumber: String(row['seatNumber'] ?? ''),
          status: String(row['status'] ?? ''),
          checkedIn: row['checkedIn'] === true,
          qrCode: String(row['qrCode'] ?? ''),
        });
      }
      setResults(found);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function checkInResult(result: SearchResult): Promise<void> {
    if (result.checkedIn) {
      toast('Already checked in.', 'error');
      return;
    }
    if (result.status === 'cancelled') {
      toast('This booking has been cancelled.', 'error');
      return;
    }
    if (result.qrCode !== '') {
      await processCode(result.qrCode, false);
      return;
    }
    setBusy(true);
    try {
      const checked = await registrationService.checkInBySeat({ eventId, seatNumber: result.seatNumber });
      setFeedback({ kind: 'success', fullName: checked.fullName, seatNumber: checked.seatNumber });
      setRetry((value) => value + 1);
    } catch (err) {
      setFeedback({
        kind: 'error',
        message:
          err instanceof CheckInException
            ? err.message
            : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <ErrorState title="Could not load check-ins." onRetry={() => setRetry((value) => value + 1)} />;
  }

  const cameraMessage =
    status === 'denied'
      ? "Camera access was denied. Allow camera access in your browser's site settings, or use Manual code entry / Search by name below."
      : status === 'unsupported'
        ? "This device doesn't support camera scanning. Use Manual code entry or Search by name instead."
        : 'Something went wrong while starting the camera. Please try again.';

  return (
    <div className="space-y-5 animate-fadeup">
      {!syncNoteDismissed && (
        <div className="flex items-start gap-2 bg-warningbg px-4 py-2 text-caption text-textprimary">
          <NotificationBing size={14} className="mt-0.5 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            Check-ins sync live across tabs on this device, but not between separate devices. If more than one device
            is checking tickets at this event, duplicate check-ins for the same ticket won&apos;t be caught across
            them.
          </span>
          <button
            type="button"
            aria-label="Dismiss check-in sync notice"
            onClick={dismissSyncNote}
            className="-mr-1 shrink-0 rounded-full p-0.5 text-warning transition-opacity duration-200 hover:opacity-70"
          >
            <CloseCircle size={16} />
          </button>
        </div>
      )}

      <Segmented options={MODES} value={mode} onChange={(next) => setMode(next as Mode)} ariaLabel="Scan mode" />

      {mode === 'camera' &&
        (status === 'denied' || status === 'unsupported' || status === 'error' ? (
          <div className="flex flex-col items-center gap-3 rounded-base border border-border bg-surface px-4 py-6 text-center shadow-card">
            <Scan size={44} className="text-textmuted" />
            <p className="max-w-md text-body text-textmuted">{cameraMessage}</p>
            {status !== 'unsupported' && (
              <Button variant="secondary" onClick={() => start()}>
                Retry camera
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-base border border-border shadow-card">
              <div className="relative flex h-72 items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <div className="relative flex flex-col items-center gap-3">
                  {status === 'scanning' ? (
                    <>
                      <div className="h-56 w-56 rounded-lg border-2 border-white/50" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40">
                        <Scan size={48} />
                      </span>
                    </>
                  ) : (
                    <>
                      <Spinner size={28} className="text-white/80" />
                      <span className="text-body text-white/80">Requesting camera access…</span>
                    </>
                  )}
                </div>
              </div>
              <p className="bg-black/60 px-4 py-4 text-center text-body text-white">
                Point the camera at the attendee&apos;s QR code
              </p>
            </div>
          </div>
        ))}

      {mode === 'manual' && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-4 text-center">
          <Keyboard size={56} className="text-textmuted" />
          <h1 className="text-title text-textprimary">Enter code manually</h1>
          <p className="text-body text-textmuted">Type the QR code or seat number</p>
          <div className="w-full pt-2">
            <Input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="e.g. S-123 or code..."
              aria-label="Ticket code"
              className="text-center text-lg uppercase"
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitManualCode();
                }
              }}
            />
          </div>
          <div className="w-full pt-1">
            <Button fullWidth onClick={() => void submitManualCode()} loading={busy}>
              Check In
            </Button>
          </div>
        </div>
      )}

      {mode === 'search' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Profile2User size={44} className="text-textmuted" />
            <h1 className="text-subtitle text-textprimary">Search by attendee name</h1>
            <p className="text-caption text-textmuted">Partial name search — type any part of the name</p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void searchByName();
            }}
          >
            <div className="min-w-0 flex-1">
              <SearchField value={query} onChange={setQuery} placeholder="Search by name..." />
            </div>
            <Button type="submit" className="shrink-0">
              Search
            </Button>
          </form>
          {searching ? (
            <div className="space-y-2" aria-busy="true" aria-label="Searching attendees">
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-[72px] w-full" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={result.bookingId}
                  type="button"
                  onClick={() => void checkInResult(result)}
                  className="flex w-full items-center gap-3 rounded-base border border-border bg-surface px-4 py-3 text-left shadow-card transition-colors duration-200 hover:border-primary"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      result.checkedIn
                        ? 'bg-successbg text-success'
                        : result.status === 'cancelled'
                          ? 'bg-dangerbg text-danger'
                          : 'bg-neutralbg text-textmuted'
                    }`}
                  >
                    {result.checkedIn ? (
                      <TickCircle size={20} />
                    ) : result.status === 'cancelled' ? (
                      <CloseCircle size={20} />
                    ) : (
                      <Profile2User size={20} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-textprimary">{result.fullName}</span>
                    <span className="mt-0.5 block truncate text-caption text-textmuted">
                      {result.seatNumber !== '' ? result.seatNumber : 'No seat assigned'}
                    </span>
                  </span>
                  {result.checkedIn ? (
                    <span className="shrink-0 text-caption font-semibold text-success">Checked in</span>
                  ) : result.status === 'cancelled' ? (
                    <span className="shrink-0 text-caption font-semibold text-danger">Cancelled</span>
                  ) : (
                    <span className="shrink-0 text-caption font-semibold text-primary">Check in</span>
                  )}
                </button>
              ))}
            </div>
          ) : searched && query.trim() !== '' ? (
            <p className="py-3 text-center text-body text-textmuted">No attendees found.</p>
          ) : null}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-subtitle text-textprimary">Recent check-ins</h2>
          <span className="shrink-0 text-caption text-textmuted">{recent?.length ?? 0}</span>
        </div>
        {(recent ?? []).length === 0 ? (
          <p className="rounded-base border border-border bg-surface px-4 py-3 text-body text-textmuted">
            Checked-in attendees appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {(recent ?? []).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-base border border-border bg-surface px-4 py-3 shadow-card"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-successbg text-success">
                  <TickCircle size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-textprimary">{entry.fullName}</span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">
                    {entry.seatNumber !== '' ? entry.seatNumber : 'RSVP'}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-textmuted">
                  {entry.checkedInAt !== '' ? relativeStamp(entry.checkedInAt) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Sheet
        open={feedback !== null}
        onClose={() => setFeedback(null)}
        variant="center"
        title={feedback?.kind === 'success' ? 'Checked In!' : 'Check-in Failed'}
      >
        {feedback?.kind === 'success' ? (
          <div className="flex flex-col items-center gap-3 rounded-base bg-successbg px-4 py-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
              <TickCircle size={40} />
            </span>
            <p className="text-title text-success">{feedback.fullName}</p>
            <span className="rounded-pill bg-white px-4 py-1.5 text-body font-extrabold text-success">
              {feedback.seatNumber !== '' ? feedback.seatNumber : 'RSVP'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-base bg-dangerbg px-4 py-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-danger text-white">
              <CloseCircle size={40} />
            </span>
            <p className="text-body text-textprimary">{feedback?.message}</p>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setFeedback(null)}>Close</Button>
        </div>
      </Sheet>
    </div>
  );
}
