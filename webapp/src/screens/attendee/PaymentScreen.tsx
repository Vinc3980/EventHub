import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Information, Wallet1 } from 'iconsax-react';
import { Button, Field, Input, Select, Sheet, Skeleton, ErrorState } from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import { db } from '../../db/db';
import {
  DiscountService,
  RegistrationService,
  SoldOutException,
  EventService,
  RefundService,
} from '../../services';
import { Event, type Booking } from '../../models';
import { MOMO_NETWORKS, platformFee } from '../../lib/constants';
import { formatCurrency } from '../../lib/format';

type Phase = 'form' | 'pending' | 'failed';

interface PaymentState {
  originalAmount?: number;
  discountCodeId?: string;
}

export default function PaymentScreen() {
  const { eventId = '', bookingId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { uid, user } = useAuth();
  const { error: showError } = useToast();

  const navState = (location.state ?? null) as PaymentState | null;

  const [phase, setPhase] = useState<Phase>('form');
  const [momoNumber, setMomoNumber] = useState(user?.savedMomoNumber ?? '');
  const [momoNetwork, setMomoNetwork] = useState(
    (MOMO_NETWORKS as readonly string[]).includes(user?.savedMomoNetwork ?? '')
      ? (user?.savedMomoNetwork ?? MOMO_NETWORKS[0])
      : MOMO_NETWORKS[0],
  );
  const [paying, setPaying] = useState(false);
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const redeemed = useRef(false);

  const registrationService = useMemo(() => new RegistrationService(), []);
  const eventService = useMemo(() => new EventService(), []);
  const refundService = useMemo(() => new RefundService(), []);
  const discountService = useMemo(() => new DiscountService(), []);

  const { data: bookings, error: bookingsError } = useLive(
    () => registrationService.bookingsForUser(uid ?? ''),
    [uid, bookingId],
  );
  const booking = useMemo(
    () => (bookings ?? []).find((row) => row.id === bookingId) as Booking | undefined,
    [bookings, bookingId],
  );

  const payment = useLive(() => refundService.paymentForBooking(bookingId), [bookingId]).data;

  const { data: event } = useLive<Event | null>(
    () => eventService.getEvent(eventId),
    [eventId],
  );

  const tierName =
    useLive<string>(
      async () => {
        if (!booking) return '';
        const reg = await db.registrations.get(booking.regId);
        return String(reg?.ticketType ?? '');
      },
      [booking?.regId ?? ''],
    ).data ?? '';

  const total = payment?.amount ?? navState?.originalAmount ?? 0;
  const subtotal = navState?.originalAmount ?? payment?.amount ?? 0;
  const discountAmount = Math.max(0, subtotal - total);
  const fee = platformFee(total);
  const amountLabel = formatCurrency(total);
  const canPay = momoNumber.trim().length > 0 && payment != null;

  useEffect(() => {
    if (!booking) return;
    if (booking.status === 'confirmed') {
      void finish();
      return;
    }
    if (booking.status === 'payment_failed' && phase === 'pending') {
      setPhase('failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status, phase]);

  async function finish() {
    if (navState?.discountCodeId && !redeemed.current) {
      redeemed.current = true;
      try {
        await discountService.redeemCode(navState.discountCodeId);
      } catch {
        // redemption must never block the ticket
      }
    }
    navigate(`/booking/${bookingId}`, { replace: true });
  }

  async function pay() {
    if (!payment || !booking || paying) return;
    setPaying(true);
    try {
      if (tierName.length > 0) {
        const remaining = await eventService.remainingCapacity(eventId, tierName);
        if (remaining === 0) {
          setSoldOutOpen(true);
          return;
        }
      }
      // SIMULATED: the MoMo gateway call resolves locally, no network request.
      registrationService.resolveMomoPaymentSimulated(payment.id, bookingId);
      setPhase('pending');
    } catch (err) {
      if (err instanceof SoldOutException) {
        setSoldOutOpen(true);
      } else {
        showError('Payment request failed. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  }

  function cancel() {
    navigate(`/event/${eventId}`, { replace: true });
  }

  if (bookingsError) {
    return <ErrorState title="Something went wrong." body="Payment request failed. Please try again." />;
  }

  if (!booking || !payment) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading payment">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (phase === 'pending') {
    return (
      <div className="animate-fadeup flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card">
        <span className="flex h-16 w-16 items-center justify-center rounded-base bg-neutralbg">
          <span
            className="h-8 w-8 animate-spin rounded-full border-[3px] border-current border-t-transparent text-primary"
            aria-hidden="true"
          />
        </span>
        <h1 className="mt-5 text-title text-textprimary">Waiting for MoMo approval</h1>
        <p className="mt-2 text-body text-textmuted">
          Check your phone and approve the payment of {amountLabel}.
        </p>
        <p className="mt-1 text-caption text-textmuted">
          This can take a few seconds. Do not close this screen.
        </p>
        <div className="mt-6 w-full max-w-[320px]">
          <Button variant="secondary" fullWidth onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="animate-fadeup flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card">
        <span className="flex h-16 w-16 items-center justify-center rounded-base bg-dangerbg">
          <Information size={30} className="text-danger" />
        </span>
        <h1 className="mt-5 text-title text-textprimary">Payment failed</h1>
        <p className="mt-2 text-body text-textmuted">Payment was declined. Please try again.</p>
        <div className="mt-6 flex w-full max-w-[320px] flex-col gap-3">
          <Button fullWidth onClick={() => setPhase('form')}>
            Retry
          </Button>
          <Button variant="secondary" fullWidth onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeup pb-4">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
            <Wallet1 size={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-subtitle text-textprimary">
              {event?.title ?? 'Payment'}
            </p>
            <p className="truncate text-caption text-textmuted">{event?.venue}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body text-textmuted">Ticket subtotal</span>
            <span className="shrink-0 text-body font-semibold text-textprimary">
              {formatCurrency(subtotal)}
            </span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-body text-textmuted">Discount</span>
              <span className="shrink-0 text-body font-semibold text-success">
                - {formatCurrency(discountAmount)}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body text-textmuted">Platform fee (2%)</span>
            <span className="shrink-0 text-body font-semibold text-textprimary">
              {formatCurrency(fee)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <span className="min-w-0 truncate text-subtitle font-extrabold text-textprimary">
              Total
            </span>
            <span className="shrink-0 text-subtitle font-extrabold text-textprimary">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-subtitle text-textprimary">MoMo number</h2>
        <div className="mt-3 space-y-3">
          <Field label="MoMo number" required>
            <Input
              inputMode="numeric"
              autoComplete="tel"
              placeholder="024 000 0000"
              leading={<Wallet1 size={18} />}
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
            />
          </Field>
          <Field label="Network" required>
            <Select value={momoNetwork} onChange={(e) => setMomoNetwork(e.target.value)}>
              {MOMO_NETWORKS.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-5">
          <Button fullWidth size="lg" loading={paying} disabled={!canPay} onClick={() => void pay()}>
            {`Pay ${formatCurrency(total, { compact: true })}`}
          </Button>
        </div>
      </section>

      <Sheet open={soldOutOpen} onClose={() => setSoldOutOpen(false)} title="Sold out" variant="center">
        <p className="text-body text-textmuted">This ticket type just sold out — pick another.</p>
        <div className="mt-4">
          <Button fullWidth onClick={() => setSoldOutOpen(false)}>
            Close
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
