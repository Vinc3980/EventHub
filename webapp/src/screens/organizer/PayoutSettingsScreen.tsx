import { useState } from 'react';
import { Wallet1 } from 'iconsax-react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { Button, EmptyState, Field, Input, Select, Skeleton } from '../../components/ui';
import { PayoutAccount } from '../../models';
import { MOMO_NETWORKS } from '../../lib/constants';
import { formatCurrency } from '../../lib/format';
import { nowIso } from '../../lib/ids';

const PROVIDERS = [...MOMO_NETWORKS, 'Bank'] as const;

export default function PayoutSettingsScreen() {
  const { uid } = useAuth();
  const { toast } = useToast();

  const saved = useLiveQuery(
    async () => (uid ? await db.payoutAccounts.get(uid) : undefined),
    [uid],
  );

  const [provider, setProvider] = useState<string>(PROVIDERS[0]);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  if (saved && !hydrated) {
    setProvider(
      (saved.momoNetwork as string) || (saved.provider as string) || PROVIDERS[0],
    );
    setNumber((saved.momoNumber as string) || (saved.accountNumber as string) || '');
    setName((saved.momoName as string) || (saved.accountName as string) || '');
    setHydrated(true);
  }

  const isSaved = Boolean(saved);
  const valid = number.trim().length >= 9 && name.trim().length > 0;

  async function save() {
    if (!uid || !valid) return;
    setSaving(true);
    try {
      const account = new PayoutAccount({
        id: uid,
        ownerId: uid,
        momoNumber: number.trim(),
        momoNetwork: provider,
        momoName: name.trim(),
      });
      await db.payoutAccounts.put({
        ...account.toMap(),
        id: uid,
        updatedAt: nowIso(),
      });
      toast.success('Payout account saved.');
    } catch (error) {
      toast.error(`Could not save payout account: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-8">
      <section>
        <h2 className="text-subtitle text-textprimary">Payout account</h2>
        <p className="mt-1 text-caption text-textmuted">
          Where your event earnings will be sent.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Provider" required>
            <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account / phone number" required>
            <Input
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="024 123 4567"
            />
          </Field>
          <Field label="Account name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button fullWidth loading={saving} disabled={!valid} onClick={() => void save()}>
            {isSaved ? 'Update' : 'Save'}
          </Button>
        </div>
      </section>

      <PayoutHistory uid={uid ?? ''} />

      <p className="rounded-md bg-warningbg p-3.5 text-caption text-warning">
        Payout transfers are not processed locally. This information will be used by
        a future Cloud Function to send earnings to your account.
      </p>
    </div>
  );
}

function PayoutHistory({ uid }: { uid: string }) {
  const history = useLiveQuery(async () => {
    if (!uid) return { rows: [], total: 0 };
    const [events, payments, bookings] = await Promise.all([
      db.events.toArray(),
      db.payments.toArray(),
      db.bookings.toArray(),
    ]);

    const myEvents = new Map<string, string>();
    for (const row of events) {
      if (row.ownerId === uid) {
        myEvents.set(String(row.id ?? ''), String(row.title ?? 'Untitled'));
      }
    }

    const bookingEvent = new Map<string, string>();
    for (const row of bookings) {
      bookingEvent.set(String(row.id ?? ''), String(row.eventId ?? ''));
    }

    const byEvent = new Map<string, number>();
    for (const payment of payments) {
      if (payment.status !== 'success') continue;
      const bookingId = String(payment.bookingId ?? '');
      if (!bookingId) continue;
      const eventId = bookingEvent.get(bookingId) ?? '';
      if (!myEvents.has(eventId)) continue;
      const payout = Number(payment.organizerPayout ?? 0);
      byEvent.set(eventId, (byEvent.get(eventId) ?? 0) + payout);
    }

    const rows = Array.from(byEvent.entries()).map(([eventId, amount]) => ({
      eventId,
      title: myEvents.get(eventId) ?? 'Event',
      amount,
    }));
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    return { rows, total };
  }, [uid]);

  return (
    <section>
      <h2 className="text-subtitle text-textprimary">Payout history</h2>
      <p className="mt-1 text-caption text-textmuted">
        Earnings from your completed events.
      </p>

      {!history ? (
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading payouts">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : history.rows.length === 0 ? (
        <div className="mt-3 rounded-base border border-border bg-surface p-5">
          <EmptyState
            icon={<Wallet1 size={26} />}
            title="No payouts yet."
            body="They'll appear here once your events have confirmed bookings."
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-base bg-successbg p-4 text-center">
            <p className="text-display text-success">Total earned: {formatCurrency(history.total)}</p>
          </div>
          <ul className="space-y-2">
            {history.rows.map((row) => (
              <li
                key={row.eventId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3"
              >
                <span className="min-w-0 truncate text-body font-semibold text-textprimary">
                  {row.title}
                </span>
                <span className="shrink-0 text-body font-bold text-success">
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
