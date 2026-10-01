import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight2,
  Calendar1,
  Flag,
  Money,
  People,
  Ticket,
  TickCircle,
  Timer1,
  Wallet1,
} from 'iconsax-react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { SectionHeader, Skeleton, StatusTag } from '../../components/ui';
import { formatCurrency } from '../../lib/format';
import { platformFee } from '../../lib/constants';

interface QueueItem {
  id: string;
  title: string;
  date: Date;
  category: string;
  ownerName: string;
}

interface ReportItem {
  id: string;
  targetLabel: string;
  reason: string;
  reporterName: string;
}

interface ActivityItem {
  id: string;
  title: string;
  stamp: string;
  status: string;
}

interface Snapshot {
  published: number;
  pending: number;
  rejected: number;
  completed: number;
  users: number;
  openReports: number;
  confirmed: number;
  gmv: number;
  queue: QueueItem[];
  reports: ReportItem[];
  activity: ActivityItem[];
}

const BREAKDOWN_TONE: Record<string, string> = {
  Published: 'bg-success',
  Pending: 'bg-warning',
  Rejected: 'bg-danger',
  Completed: 'bg-neutral',
};

function shortDate(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function activityStamp(value: unknown): string {
  const parsed = new Date(typeof value === 'string' ? value : '');
  if (Number.isNaN(parsed.getTime())) return '';
  const date = parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

async function loadSnapshot(): Promise<Snapshot> {
  const [events, users, reports, bookings, registrations] = await Promise.all([
    db.events.toArray(),
    db.users.toArray(),
    db.reports.toArray(),
    db.bookings.toArray(),
    db.registrations.toArray(),
  ]);

  const nameById = new Map<string, string>();
  for (const row of users) {
    nameById.set(String(row.uid ?? ''), String(row.name ?? 'Unknown'));
  }
  const eventById = new Map<string, Record<string, unknown>>();
  for (const row of events) {
    eventById.set(String(row.id ?? ''), row);
  }
  const registrationById = new Map<string, Record<string, unknown>>();
  for (const row of registrations) {
    registrationById.set(String(row.id ?? ''), row);
  }

  let published = 0;
  let pending = 0;
  let rejected = 0;
  let completed = 0;
  let gmv = 0;
  let confirmed = 0;

  for (const row of events) {
    const status = String(row.status ?? '');
    if (status === 'published') published++;
    else if (status === 'pending_review') pending++;
    else if (status === 'rejected') rejected++;
    else if (status === 'completed') completed++;
  }

  const activity: (ActivityItem & { createdAtMs: number })[] = [];
  for (const booking of bookings) {
    const status = String(booking.status ?? '');
    const user = nameById.get(String(booking.userId ?? '')) ?? 'Unknown';
    const event = eventById.get(String(booking.eventId ?? ''));
    const title = String(event?.title ?? 'Event');
    const createdAt = new Date(String(booking.createdAt ?? ''));
    activity.push({
      id: String(booking.id ?? ''),
      title: `${user} booked ${title}`,
      stamp: activityStamp(booking.createdAt),
      status,
      createdAtMs: Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime(),
    });
    if (status !== 'confirmed') continue;
    confirmed++;
    const registration = registrationById.get(String(booking.regId ?? ''));
    if (!registration || !event) continue;
    const tiers = (event.ticketTypes as Record<string, unknown>[]) ?? [];
    const tier = tiers.find((item) => item.name === registration.ticketType);
    gmv += Number(tier?.price ?? 0);
  }
  activity.sort((a, b) => b.createdAtMs - a.createdAtMs);

  const queue: QueueItem[] = events
    .filter((row) => String(row.status ?? '') === 'pending_review')
    .map((row) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      date: new Date(String(row.date ?? '')),
      category: String(row.category ?? 'social'),
      ownerName: nameById.get(String(row.ownerId ?? '')) ?? 'Unknown',
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const openReports: (ReportItem & { createdAtMs: number })[] = [];
  for (const row of reports) {
    if (String(row.status ?? '') !== 'open') continue;
    const targetType = String(row.targetType ?? '');
    const targetId = String(row.targetId ?? '');
    let targetLabel = 'Deleted event';
    if (targetType === 'event') {
      targetLabel = String(eventById.get(targetId)?.title ?? 'Deleted event');
    } else if (targetType === 'user') {
      targetLabel = nameById.get(targetId) ?? 'Unknown';
    }
    const createdAt = new Date(String(row.createdAt ?? ''));
    openReports.push({
      id: String(row.id ?? ''),
      targetLabel,
      reason: String(row.reason ?? 'other'),
      reporterName: nameById.get(String(row.reporterId ?? '')) ?? 'Unknown',
      createdAtMs: Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime(),
    });
  }
  openReports.sort((a, b) => b.createdAtMs - a.createdAtMs);

  return {
    published,
    pending,
    rejected,
    completed,
    users: users.length,
    openReports: openReports.length,
    confirmed,
    gmv,
    queue,
    reports: openReports.slice(0, 3),
    activity: activity.slice(0, 5),
  };
}

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-base border border-border bg-surface p-3.5 shadow-card">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-subtitle text-textprimary">{value}</p>
        <p className="truncate text-caption text-textmuted">{label}</p>
      </div>
    </div>
  );
}

function ViewAllLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-button text-primary transition-opacity duration-200 hover:opacity-80"
    >
      View all
      <ArrowRight2 size={14} />
    </Link>
  );
}

export default function AdminDashboard() {
  const snapshot = useLiveQuery(loadSnapshot, []);

  if (!snapshot) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const breakdown = [
    { label: 'Published', count: snapshot.published },
    { label: 'Pending', count: snapshot.pending },
    { label: 'Rejected', count: snapshot.rejected },
    { label: 'Completed', count: snapshot.completed },
  ];
  const breakdownTotal = breakdown.reduce((sum, item) => sum + item.count, 0);
  const fee = platformFee(snapshot.gmv);

  return (
    <div className="space-y-6 animate-fadeup">
      <section aria-label="Platform stats">
        <div className="grid grid-cols-2 gap-3 desktop:grid-cols-3">
          <StatTile
            icon={<TickCircle size={18} />}
            value={String(snapshot.published)}
            label="Published events"
            tone="bg-successbg text-success"
          />
          <StatTile
            icon={<Timer1 size={18} />}
            value={String(snapshot.pending)}
            label="Pending events"
            tone="bg-warningbg text-warning"
          />
          <StatTile
            icon={<People size={18} />}
            value={String(snapshot.users)}
            label="Users"
            tone="bg-primary-10 text-primary"
          />
          <StatTile
            icon={<Flag size={18} />}
            value={String(snapshot.openReports)}
            label="Open reports"
            tone="bg-dangerbg text-danger"
          />
          <StatTile
            icon={<Money size={18} />}
            value={formatCurrency(snapshot.gmv)}
            label="GMV"
            tone="bg-neutralbg text-textmuted"
          />
          <StatTile
            icon={<Wallet1 size={18} />}
            value={formatCurrency(fee)}
            label="Platform revenue"
            tone="bg-background-tinted text-primary"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Event Status" />
        <div className="rounded-base border border-border bg-surface p-4 shadow-card">
          {breakdownTotal > 0 && (
            <div className="flex h-2 w-full overflow-hidden rounded-sm">
              {breakdown
                .filter((item) => item.count > 0)
                .map((item) => (
                  <span
                    key={item.label}
                    className={`h-full min-w-0 ${BREAKDOWN_TONE[item.label]}`}
                    style={{ flexGrow: item.count }}
                  />
                ))}
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {breakdown.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-caption text-textmuted">
                <span
                  className={`h-2.5 w-2.5 rounded-sm ${BREAKDOWN_TONE[item.label]}`}
                  aria-hidden="true"
                />
                {item.label} ({item.count})
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionHeader title="Pending review" action={<ViewAllLink to="/admin/events" />} />
        {snapshot.queue.length === 0 ? (
          <p className="rounded-base border border-border bg-surface p-4 text-body text-textmuted shadow-card">
            No events pending review.
          </p>
        ) : (
          <div className="space-y-2">
            {snapshot.queue.map((item) => (
              <Link
                key={item.id}
                to={`/admin/events/${item.id}/review`}
                className="flex items-center gap-3 rounded-base border border-border bg-surface p-3.5 shadow-card transition-shadow duration-200 hover:shadow-card"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-textprimary">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">
                    {shortDate(item.date)} · {capitalize(item.category)}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">
                    by {item.ownerName}
                  </span>
                </span>
                <StatusTag status="pending_review" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Open reports" action={<ViewAllLink to="/admin/reports" />} />
        {snapshot.reports.length === 0 ? (
          <p className="rounded-base border border-border bg-surface p-4 text-body text-textmuted shadow-card">
            No open reports.
          </p>
        ) : (
          <div className="space-y-2">
            {snapshot.reports.map((item) => (
              <Link
                key={item.id}
                to="/admin/reports"
                className="block rounded-base border border-border bg-surface p-3.5 shadow-card transition-shadow duration-200 hover:shadow-card"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warningbg text-warning">
                    <Flag size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-textprimary">
                      {item.targetLabel}
                    </span>
                    <span className="block truncate text-caption text-textmuted">
                      Reported by {item.reporterName}
                    </span>
                  </span>
                  <StatusTag status="open" />
                </span>
                <span className="mt-2 block truncate text-caption italic text-textmuted">
                  "{capitalize(item.reason)}"
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Recent bookings"
          action={
            <span className="text-caption text-textmuted">{snapshot.confirmed} total</span>
          }
        />
        {snapshot.activity.length === 0 ? (
          <p className="rounded-base border border-border bg-surface p-4 text-body text-textmuted shadow-card">
            No bookings yet.
          </p>
        ) : (
          <div className="space-y-2">
            {snapshot.activity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-base border border-border bg-surface p-3 shadow-card"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutralbg text-textmuted">
                  <Ticket size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-textprimary">
                    {item.title}
                  </span>
                  {item.stamp && (
                    <span className="block truncate text-caption text-textmuted">{item.stamp}</span>
                  )}
                </span>
                <StatusTag status={item.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-caption text-textmuted">
        <Calendar1 size={14} />
        {snapshot.confirmed} confirmed bookings across the platform.
      </p>
    </div>
  );
}
