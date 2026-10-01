import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar1, Location, Printer, Ticket } from 'iconsax-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusTag,
} from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import { EventService, RefundService, RegistrationService } from '../../services';
import { Event, type Booking, type Payment } from '../../models';
import { formatTicketDate } from '../../lib/format';

export default function BookingScreen() {
  const { bookingId = '' } = useParams();
  const { uid } = useAuth();
  const { success, error: showError } = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const eventServiceLocal = useMemo(() => new EventService(), []);
  const registrationService = useMemo(() => new RegistrationService(), []);
  const refundService = useMemo(() => new RefundService(), []);

  const { data: bookings, loading, error } = useLive(
    () => registrationService.bookingsForUser(uid ?? ''),
    [uid, bookingId],
  );
  const booking: Booking | undefined = (bookings ?? []).find((row) => row.id === bookingId);

  const { data: event } = useLive<Event | null>(
    () => eventServiceLocal.getEvent(booking?.eventId ?? ''),
    [booking?.eventId ?? ''],
  );

  const payment = useLive(() => refundService.paymentForBooking(bookingId), [bookingId]).data;

  async function requestRefund() {
    if (!booking) return;
    setBusy(true);
    try {
      await registrationService.cancelBooking(bookingId, { byOrganizer: false });
      const paid: Payment | null = payment ?? (await refundService.paymentForBooking(bookingId));
      if (paid && paid.amount > 0) {
        await refundService.requestRefund(booking, paid);
        success('Booking cancelled. Refund request submitted.');
      } else {
        success('Booking cancelled.');
      }
      setConfirmOpen(false);
    } catch (err) {
      showError(`Could not cancel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading ticket">
        <Skeleton className="h-80 w-full" radius="rounded-lg" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Something went wrong." body="Could not load bookings." />;
  }

  if (!booking) {
    return <EmptyState title="Booking not found." />;
  }

  return (
    <div className="animate-fadeup pb-4">
      <div className="print-ticket rounded-lg border border-border bg-surface p-6 shadow-card">
        <div className="flex justify-center">
          {booking.qrCode ? (
            <QRCodeSVG value={booking.qrCode} size={196} />
          ) : (
            <span className="flex h-[196px] w-[196px] items-center justify-center rounded-base bg-neutralbg p-6 text-center text-caption text-textmuted">
              QR pending
            </span>
          )}
        </div>

        {booking.seatNumber && (
          <div className="mt-4 flex justify-center">
            <span className="rounded-pill bg-successbg px-5 py-2 text-subtitle font-extrabold text-success">
              {booking.seatNumber}
            </span>
          </div>
        )}

        <h1 className="mt-5 text-center text-title text-textprimary">
          {event?.title ?? 'Booking'}
        </h1>

        {event && (
          <div className="mt-3 flex flex-col items-center gap-1.5 text-caption text-textmuted">
            <span className="inline-flex items-center gap-2">
              <Calendar1 size={14} className="shrink-0" />
              {formatTicketDate(event.date)}
            </span>
            <span className="inline-flex min-w-0 items-center gap-2">
              <Location size={14} className="shrink-0" />
              <span className="truncate">{event.venue}</span>
            </span>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <StatusTag status={booking.status} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 border-t border-border pt-4 text-caption text-textmuted">
          <Ticket size={14} className="shrink-0" />
          <span className="truncate">{booking.id}</span>
        </div>
      </div>

      <div className="no-print mt-4 space-y-3">
        <Button fullWidth size="lg" icon={<Printer size={18} />} onClick={() => window.print()}>
          Print ticket
        </Button>

        {event && (
          <Button
            fullWidth
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={booking.status === 'cancelled'}
          >
            Cancel / request refund
          </Button>
        )}

        {event?.thankYouMessage && (
          <p className="rounded-lg border border-border bg-surface p-4 text-body text-textmuted">
            {event.thankYouMessage}
          </p>
        )}

        {event && (
          <Link
            to={`/event/${event.id}/rate`}
            className="flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3.5 text-button text-primary transition-colors duration-200 hover:border-primary"
          >
            {`How was ${event.title}? Rate the organizer`}
          </Link>
        )}

        <div className="flex justify-center pt-1">
          <Link
            to="/bookings"
            className="text-button text-textmuted transition-colors duration-200 hover:text-primary"
          >
            My Bookings
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel booking?"
        body={`Are you sure you want to cancel your booking for ${event?.title ?? 'this event'}? This cannot be undone.`}
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        danger
        loading={busy}
        onConfirm={() => void requestRefund()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
