import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Add, CloseCircle, TickCircle } from 'iconsax-react';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { DiscountCode } from '../../models';
import { DiscountService } from '../../services';
import { Button, EmptyState, ErrorState, Field, Input, Skeleton } from '../../components/ui';
import { OrgRows, useServiceLive } from '../../components/OrgKit';

const discountService = new DiscountService();

export default function DiscountCodesScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const { toast } = useToast();

  const [retry, setRetry] = useState(0);
  const [code, setCode] = useState('');
  const [percentOff, setPercentOff] = useState('');
  const [maxUses, setMaxUses] = useState('50');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: codes, loading, error } = useServiceLive(
    discountService.codesForEvent(eventId),
    [eventId, retry],
    [db.discountCodes],
  );
  const list = codes ?? [];

  async function createCode() {
    const trimmedCode = code.trim();
    if (trimmedCode === '') {
      toast('Enter a code.', 'error');
      return;
    }
    const uses = Number.parseInt(maxUses.trim(), 10);
    if (!Number.isFinite(uses) || uses <= 0) {
      toast('Max uses must be greater than 0.', 'error');
      return;
    }
    const percent = Number.parseFloat(percentOff.trim());
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast('Enter a valid percentage (1-100).', 'error');
      return;
    }

    setCreating(true);
    try {
      const entry = new DiscountCode({ id: '', eventId, code: trimmedCode, percentOff: percent, capacity: uses });
      entry.expiresAt = expiresAt === '' ? undefined : new Date(`${expiresAt}T00:00:00.000Z`).toISOString();
      await discountService.createCode(entry);
      setCode('');
      setPercentOff('');
      setMaxUses('50');
      setExpiresAt('');
      toast('Discount code created.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not create code: ${message}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(entry: DiscountCode) {
    setTogglingId(entry.id);
    try {
      const row = await db.discountCodes.get(entry.id);
      if (row) {
        await db.discountCodes.put({ ...row, active: !entry.active });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not save: ${message}`, 'error');
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading discount codes">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState title="Could not load discount codes." onRetry={() => setRetry((n) => n + 1)} />
    );
  }

  return (
    <div className="space-y-5 animate-fadeup">
      <section className="rounded-base border border-border bg-surface p-4 shadow-card">
        <h2 className="mb-3 text-subtitle text-textprimary">Create a discount code</h2>
        <div className="space-y-3">
          <Field label="Code">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. SAVE20"
              aria-label="Code"
              className="uppercase"
            />
          </Field>
          <Field label="Percent off (%)">
            <Input
              value={percentOff}
              onChange={(event) => setPercentOff(event.target.value)}
              placeholder="10"
              inputMode="decimal"
              type="number"
              aria-label="Percent off (%)"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Max uses">
              <Input
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                inputMode="numeric"
                type="number"
                aria-label="Max uses"
              />
            </Field>
            <Field label="Expiry date (optional)" hint={expiresAt === '' ? 'No expiry' : undefined}>
              <Input
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                type="date"
                aria-label="Expiry date (optional)"
              />
            </Field>
          </div>
          <Button fullWidth icon={<Add size={16} />} onClick={() => void createCode()} loading={creating}>
            Create code
          </Button>
        </div>
      </section>

      {list.length === 0 ? (
        <EmptyState
          icon={<TickCircle size={26} />}
          title="No discount codes yet."
          body="Codes you create appear here with their usage."
        />
      ) : (
        <OrgRows>
          {list.map((entry) => {
            const details = [
              `${entry.used} / ${entry.capacity} used`,
              entry.percentOff > 0 ? `  ·  ${entry.percentOff.toFixed(0)}% off` : '',
              entry.expiresAt ? `  ·  expires ${entry.expiresAt.substring(0, 10)}` : '',
            ]
              .filter((part) => part !== '')
              .join('');
            return (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold uppercase text-textprimary">{entry.code}</span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">{details}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void toggleActive(entry)}
                  disabled={togglingId === entry.id}
                  aria-pressed={entry.active}
                  aria-label={`${entry.active ? 'Deactivate' : 'Activate'} ${entry.code}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                    entry.active ? 'text-success hover:bg-successbg' : 'text-textmuted hover:bg-neutralbg'
                  }`}
                >
                  {entry.active ? <TickCircle size={18} /> : <CloseCircle size={18} />}
                </button>
              </div>
            );
          })}
        </OrgRows>
      )}
    </div>
  );
}
