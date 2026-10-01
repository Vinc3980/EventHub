import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRotateRight } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { formatCurrency } from '../../lib/format';
import { Refund } from '../../models';
import { EventService, RefundService } from '../../services';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Sheet, Skeleton } from '../../components/ui';
import { useServiceLive } from '../../components/OrgKit';

const eventService = new EventService();
const refundService = new RefundService();

function StatusChip({ status }: { status: string }) {
  const style =
    status === 'requested'
      ? 'bg-warningbg text-warning'
      : status === 'completed'
        ? 'bg-successbg text-success'
        : status === 'denied'
          ? 'bg-dangerbg text-danger'
          : 'bg-neutralbg text-textmuted';
  const label =
    status === 'requested' ? 'Pending' : status === 'completed' ? 'Completed' : status === 'denied' ? 'Denied' : status;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-caption font-semibold ${style}`}>
      {label}
    </span>
  );
}

export default function RefundRequestsScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const { uid } = useAuth();
  const { toast } = useToast();

  const [retry, setRetry] = useState(0);
  const [approving, setApproving] = useState<Refund | null>(null);
  const [denying, setDenying] = useState<Refund | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: refunds, loading, error } = useServiceLive(
    refundService.refundsForEvent(eventId),
    [eventId, retry],
    [db.refunds, db.bookings, db.events],
  );
  const list = refunds ?? [];

  const { data: event } = useLive(async () => {
    await db.events.toArray();
    return eventService.getEvent(eventId);
  }, [eventId, retry]);

  const { data: attendeeNames } = useLive(async () => {
    const [bookingRows, userRows] = await Promise.all([db.bookings.toArray(), db.users.toArray()]);
    const users = new Map(userRows.map((row) => [String(row['id']), row]));
    const names: Record<string, string> = {};
    for (const booking of bookingRows) {
      const user = users.get(String(booking['userId']));
      names[String(booking['id'])] = String(user?.['name'] ?? '') || 'Attendee';
    }
    return names;
  }, [eventId, retry, uid]);

  async function approveRefund() {
    if (!approving) return;
    setBusy(true);
    try {
      await refundService.approveRefund(approving.id);
      toast('Refund approved.', 'success');
      setApproving(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not approve: ${message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function denyRefund() {
    if (!denying) return;
    setBusy(true);
    try {
      await refundService.denyRefund(denying.id, reason.trim());
      toast('Refund denied.', 'success');
      setDenying(null);
      setReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not deny: ${message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading refund requests">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load refund requests." onRetry={() => setRetry((n) => n + 1)} />;
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<ArrowRotateRight size={26} />}
        title="No refund requests"
        body="Refund requests from attendees will appear here."
      />
    );
  }

  return (
    <div className="space-y-3 animate-fadeup">
      {list.map((refund) => (
        <div key={refund.id} className="rounded-base border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body font-bold text-textprimary">{event?.title ?? 'Event'}</p>
              <p className="mt-0.5 truncate text-caption text-textmuted">
                {attendeeNames?.[refund.bookingId] ?? 'Attendee'}
              </p>
            </div>
            <p className="shrink-0 text-body font-bold text-primary">{formatCurrency(refund.amount)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <StatusChip status={refund.status} />
            {refund.status === 'requested' && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReason('');
                    setDenying(refund);
                  }}
                  className="h-9 rounded-md px-3 text-button text-danger transition-colors duration-200 hover:bg-dangerbg"
                >
                  Deny
                </button>
                <Button size="sm" onClick={() => setApproving(refund)} disabled={busy}>
                  Approve
                </Button>
              </div>
            )}
          </div>
          {refund.denialReason != null && refund.denialReason !== '' && (
            <p className="mt-2 break-words text-caption text-textmuted">Reason: {refund.denialReason}</p>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={approving !== null}
        title="Approve refund?"
        body="The payment will be refunded and the booking will be cancelled."
        confirmLabel="Approve"
        cancelLabel="Cancel"
        loading={busy}
        onCancel={() => setApproving(null)}
        onConfirm={() => void approveRefund()}
      />

      <Sheet
        open={denying !== null}
        onClose={() => setDenying(null)}
        title="Deny refund?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDenying(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void denyRefund()} loading={busy}>
              Deny
            </Button>
          </>
        }
      >
        <p className="text-body text-textmuted">Provide a reason for denying this refund request.</p>
        <Field label="Reason (optional)" className="mt-4">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason (optional)" />
        </Field>
      </Sheet>
    </div>
  );
}
