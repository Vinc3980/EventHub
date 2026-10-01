import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentDownload, Star1, TickCircle, Timer } from 'iconsax-react';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { formatCurrency } from '../../lib/format';
import { EventService } from '../../services';
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { OrgHeading, OrgStatCard, downloadTextFile } from '../../components/OrgKit';

const eventService = new EventService();

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-24 shrink-0 truncate text-caption text-textprimary">{label}</span>
      <span className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-neutralbg">
        <span
          className="block h-full rounded-md bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-caption font-bold text-textprimary">{count}</span>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-base border px-4 py-3 ${
        highlight ? 'border-success bg-successbg' : 'border-border bg-surface'
      }`}
    >
      <span
        className={`min-w-0 truncate text-body ${
          highlight ? 'font-bold text-textprimary' : 'font-medium text-textprimary'
        }`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 text-subtitle font-extrabold ${
          muted ? 'text-textmuted' : highlight ? 'text-success' : 'text-textprimary'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function EventAnalyticsScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const { toast } = useToast();
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);

  const { data, loading, error } = useLive(async () => {
    const [event, bookingRows, regRows, paymentRows, reviewRows] = await Promise.all([
      eventService.getEvent(eventId),
      db.bookings.toArray(),
      db.registrations.toArray(),
      db.payments.toArray(),
      db.reviews.toArray(),
    ]);

    const bookings = bookingRows.filter((row) => String(row['eventId']) === eventId);
    const bookingIds = new Set(bookings.map((row) => String(row['id'])));
    const regIds = new Set(bookings.map((row) => String(row['regId'])));
    const regs = regRows.filter((row) => regIds.has(String(row['id'])));

    let totalRevenue = 0;
    let platformFees = 0;
    for (const row of paymentRows) {
      if (bookingIds.has(String(row['bookingId']))) {
        totalRevenue += Number(row['amount'] ?? 0);
        platformFees += Number(row['platformFee'] ?? 0);
      }
    }

    const countBy = (field: string): Record<string, number> => {
      const counts: Record<string, number> = {};
      for (const row of regs) {
        const value = String(row[field] ?? '');
        if (value !== '') counts[value] = (counts[value] ?? 0) + 1;
      }
      return counts;
    };

    const reviews = reviewRows.filter((row) => String(row['eventId']) === eventId);
    const rating =
      reviews.length > 0
        ? reviews.reduce((total, row) => total + Number(row['rating'] ?? 0), 0) / reviews.length
        : null;

    const tierSold = event
      ? await Promise.all(event.ticketTypes.map((tier) => eventService.soldCountForTier(eventId, tier.name)))
      : [];

    return {
      event,
      totalBookings: bookings.length,
      checkedIn: bookings.filter((row) => row['checkedIn'] === true).length,
      totalRevenue,
      platformFees,
      relationship: countBy('attendeeType'),
      organization: countBy('organization'),
      gender: countBy('gender'),
      rating,
      tierSold,
    };
  }, [eventId, retry]);

  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await eventService.exportAttendeeListCsv(eventId);
      downloadTextFile(`${eventId}-attendees.csv`, csv);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Export failed: ${message}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading analytics">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState title="Could not load analytics." onRetry={() => setRetry((n) => n + 1)} />;
  }

  const { event } = data;
  const attendanceRate = data.totalBookings > 0 ? data.checkedIn / data.totalBookings : 0;
  const payout = data.totalRevenue - data.platformFees;
  const relationshipEntries = Object.entries(data.relationship);
  const orgEntries = Object.entries(data.organization);
  const genderEntries = Object.entries(data.gender);
  const maxOf = (entries: [string, number][]) =>
    entries.reduce((max, [, count]) => (count > max ? count : max), 0);
  const tierSales =
    event?.ticketTypes.map((tier, index) => ({
      name: tier.name,
      capacity: tier.capacity,
      sold: data.tierSold[index] ?? 0,
      revenue: (data.tierSold[index] ?? 0) * tier.price,
    })) ?? [];
  const maxSold = tierSales.reduce((max, tier) => (tier.sold > max ? tier.sold : max), 0);
  const noBreakdowns =
    relationshipEntries.length === 0 && orgEntries.length === 0 && genderEntries.length === 0 && tierSales.length === 0;

  return (
    <div className="space-y-6 animate-fadeup">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-title text-textprimary">{event?.title ?? 'Event'}</h1>
        <Button
          variant="secondary"
          size="sm"
          icon={<DocumentDownload size={16} />}
          onClick={() => void exportCsv()}
          disabled={exporting}
          className="shrink-0"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OrgStatCard value={data.totalBookings} label="Registrations" />
        <OrgStatCard value={data.checkedIn} label="Checked in" tone="success" />
        <OrgStatCard value={data.totalBookings} label="Views" />
        <OrgStatCard value={data.rating === null ? '—' : data.rating.toFixed(1)} label="Rating" />
      </div>

      <section>
        <OrgHeading title="Attendance rate" />
        <div className="flex flex-col items-center rounded-base border border-border bg-surface py-6 shadow-card">
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="14" className="stroke-neutralbg" />
              <circle
                cx="60"
                cy="60"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="14"
                strokeLinecap="round"
                className="stroke-success transition-[stroke-dasharray] duration-500"
                style={{
                  strokeDasharray: `${RING_CIRCUMFERENCE * attendanceRate} ${RING_CIRCUMFERENCE}`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-title font-extrabold text-textprimary">{Math.round(attendanceRate * 100)}%</p>
              <p className="text-caption text-textmuted">
                {data.checkedIn} / {data.totalBookings}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-caption text-textmuted">
            <span className="inline-flex items-center gap-1.5">
              <TickCircle size={14} className="text-success" />
              {data.checkedIn} checked in
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer size={14} />
              {data.totalBookings} registered
            </span>
          </div>
        </div>
      </section>

      {data.totalRevenue > 0 && (
        <section>
          <OrgHeading title="Revenue" />
          <div className="space-y-2">
            <StatRow label="Total collected" value={formatCurrency(data.totalRevenue)} />
            <StatRow label="Platform fees" value={formatCurrency(data.platformFees)} muted />
            <StatRow label="Your payout" value={formatCurrency(payout)} highlight />
          </div>
        </section>
      )}

      {tierSales.length > 0 && (
        <section>
          <OrgHeading title="Sales by ticket type" />
          <div className="space-y-2.5">
            {tierSales.map((tier) => (
              <div key={tier.name} className="rounded-base border border-border bg-surface p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-body font-bold text-textprimary">{tier.name}</span>
                  <span className="shrink-0 text-caption text-textmuted">
                    {tier.sold} / {tier.capacity} sold
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-neutralbg">
                  <div
                    className="h-full rounded-pill bg-primary transition-[width] duration-300"
                    style={{ width: `${maxSold > 0 ? Math.round((tier.sold / maxSold) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-caption font-semibold text-primary">
                  {tier.revenue > 0 ? `${formatCurrency(tier.revenue)} revenue` : 'Free'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {relationshipEntries.length > 0 && (
        <section>
          <OrgHeading title="By relationship" />
          <div className="rounded-base border border-border bg-surface p-4 shadow-card">
            {relationshipEntries.map(([label, count]) => (
              <BarRow key={label} label={label} count={count} max={maxOf(relationshipEntries)} />
            ))}
          </div>
        </section>
      )}

      {orgEntries.length > 0 && (
        <section>
          <OrgHeading title="By organization" />
          <div className="rounded-base border border-border bg-surface p-4 shadow-card">
            {orgEntries.map(([label, count]) => (
              <BarRow key={label} label={label} count={count} max={maxOf(orgEntries)} />
            ))}
          </div>
        </section>
      )}

      {genderEntries.length > 0 && (
        <section>
          <OrgHeading title="By gender" />
          <div className="rounded-base border border-border bg-surface p-4 shadow-card">
            {genderEntries.map(([label, count]) => (
              <BarRow key={label} label={label} count={count} max={maxOf(genderEntries)} />
            ))}
          </div>
        </section>
      )}

      {noBreakdowns && (
        <EmptyState
          icon={<Star1 size={26} />}
          title="No registration data"
          body="No registration data available for breakdowns."
        />
      )}
    </div>
  );
}
