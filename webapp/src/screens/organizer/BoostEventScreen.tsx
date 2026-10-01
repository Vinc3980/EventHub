import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Flash, Star1 } from 'iconsax-react';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { formatCurrency } from '../../lib/format';
import { EventService, PromotionService } from '../../services';
import { Button, ErrorState, Skeleton } from '../../components/ui';
import { OrgBanner, OrgHeading } from '../../components/OrgKit';

const eventService = new EventService();
const promotionService = new PromotionService();

const TIERS = [
  { days: 3, label: '3 days', subtitle: 'Quick boost' },
  { days: 7, label: '7 days', subtitle: 'Most popular' },
  { days: 14, label: '14 days', subtitle: 'Maximum reach' },
];

export default function BoostEventScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [retry, setRetry] = useState(0);
  const [days, setDays] = useState(7);
  const [boosting, setBoosting] = useState(false);

  const { data: event, loading, error } = useLive(async () => {
    await db.events.toArray();
    return eventService.getEvent(eventId);
  }, [eventId, retry]);

  async function boost() {
    setBoosting(true);
    try {
      await promotionService.boostEvent(eventId, days);
      toast(`Event boosted for ${days} days!`, 'success');
      navigate(`/organizer/events/${eventId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Boost failed: ${message}`, 'error');
      setBoosting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading boost options">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load event." onRetry={() => setRetry((n) => n + 1)} />;
  }

  if (!event) {
    return <ErrorState title="Event not found." />;
  }

  return (
    <div className="space-y-5 animate-fadeup">
      <section className="rounded-base border border-border bg-surface p-5 shadow-card">
        <h1 className="text-subtitle font-extrabold text-textprimary">Feature your event</h1>
        <p className="mt-2 text-body text-textmuted">
          Boosted events appear at the top of Explore and Home feeds, marked with a Featured badge.
        </p>
        <p className="mt-1.5 text-body font-bold text-textprimary">{event.title}</p>
        {event.isCurrentlyFeatured && (
          <div className="mt-3">
            <OrgBanner
              tone="primary"
              icon={<Star1 size={20} />}
              title="Already featured"
              body={`Featured until ${event.featuredUntil ? event.featuredUntil.substring(0, 10) : '—'}. Boosting again extends the window.`}
            />
          </div>
        )}
      </section>

      <section>
        <OrgHeading title="Choose a boost duration" />
        <div className="space-y-2.5" role="radiogroup" aria-label="Choose a boost duration">
          {TIERS.map((tier) => {
            const selected = days === tier.days;
            return (
              <button
                key={tier.days}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDays(tier.days)}
                className={`flex w-full items-center gap-3.5 rounded-base border px-4 py-4 text-left transition-colors duration-200 ${
                  selected ? 'border-primary bg-primary-6' : 'border-border bg-surface hover:border-primary'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-primary' : 'border-textmuted'
                  }`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-textprimary">{tier.label}</span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">{tier.subtitle}</span>
                </span>
                <span className="shrink-0 text-subtitle font-extrabold text-primary">
                  {formatCurrency(promotionService.priceForTier(tier.days))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rounded-base bg-warningbg p-3.5 text-caption leading-relaxed text-warning">
        This is a simulated charge for testing. No real payment is processed. Replace with Paystack / Flutterwave
        before launch.
      </div>

      <Button fullWidth icon={<Flash size={16} />} onClick={() => void boost()} loading={boosting} disabled={boosting}>
        {boosting ? 'Processing…' : 'Boost now'}
      </Button>
    </div>
  );
}
