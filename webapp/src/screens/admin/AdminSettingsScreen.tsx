import { useState } from 'react';
import { Box1, InfoCircle, Refresh } from 'iconsax-react';
import { db, getSeedVersion, setSeedVersion } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { SEED_VERSION, seedIfEmpty } from '../../services/seedService';
import { MOMO_NETWORKS, PAYOUT_OFFSET_DAYS } from '../../lib/constants';
import { useToast } from '../../app/ToastProvider';
import { OrgRowLink, OrgRows } from '../../components/OrgKit';
import { Button, ConfirmDialog, SectionHeader, Skeleton } from '../../components/ui';

interface Stat {
  key: string;
  label: string;
  count: number;
}

const STAT_SOURCES: { key: string; label: string; table: () => { count: () => Promise<number> } }[] = [
  { key: 'users', label: 'Users', table: () => db.users },
  { key: 'events', label: 'Events', table: () => db.events },
  { key: 'registrations', label: 'Registrations', table: () => db.registrations },
  { key: 'bookings', label: 'Bookings', table: () => db.bookings },
  { key: 'payments', label: 'Payments', table: () => db.payments },
  { key: 'refunds', label: 'Refunds', table: () => db.refunds },
  { key: 'reports', label: 'Reports', table: () => db.reports },
  { key: 'reviews', label: 'Reviews', table: () => db.reviews },
  { key: 'posts', label: 'Posts', table: () => db.posts },
  { key: 'chats', label: 'Chats', table: () => db.chats },
  { key: 'messages', label: 'Messages', table: () => db.messages },
  { key: 'notifications', label: 'Notifications', table: () => db.notifications },
  { key: 'discountCodes', label: 'Discount codes', table: () => db.discountCodes },
  { key: 'promotions', label: 'Promotions', table: () => db.promotions },
  { key: 'waitlist', label: 'Waitlist', table: () => db.waitlist },
  { key: 'eventSchedules', label: 'Schedule items', table: () => db.eventSchedules },
];

const SIMULATED = [
  { label: 'Mobile money', detail: MOMO_NETWORKS.join(', ') },
  { label: 'SMS messages', detail: 'Verification codes and reminders' },
  { label: 'Push notifications', detail: 'Local notifications only' },
  { label: 'Organizer payouts', detail: `${PAYOUT_OFFSET_DAYS}-day hold after the event` },
];

function platformLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web';
}

export default function AdminSettingsScreen() {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const stats = useLiveQuery(async () => {
    const seedVersion = await getSeedVersion();
    const counts = await Promise.all(STAT_SOURCES.map((source) => source.table().count()));
    const rows: Stat[] = STAT_SOURCES.map((source, index) => ({
      key: source.key,
      label: source.label,
      count: counts[index],
    }));
    return { seedVersion, rows };
  }, []);

  async function reseed() {
    setBusy(true);
    try {
      await setSeedVersion('');
      await seedIfEmpty();
      setConfirmOpen(false);
      toast.success('Demo data reseeded.');
    } catch (error) {
      toast.error(`Could not reseed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!stats) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading settings">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const total = stats.rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6 animate-fadeup">
      <section>
        <SectionHeader title="App info" />
        <OrgRows>
          <OrgRowLink
            icon={<InfoCircle size={18} />}
            title="App version"
            trailing={
              <span className="text-body text-textmuted">
                v{__APP_VERSION__} ({__COMMIT_HASH__}) · {__BUILD_DATE__}
              </span>
            }
          />
          <OrgRowLink
            icon={<InfoCircle size={18} />}
            title="Platform"
            trailing={<span className="text-body text-textmuted">{platformLabel()}</span>}
          />
          <OrgRowLink
            icon={<InfoCircle size={18} />}
            title="Environment"
            trailing={
              <span className="text-body text-textmuted">
                {import.meta.env.PROD ? 'Production' : 'Development'}
              </span>
            }
          />
          <OrgRowLink
            icon={<InfoCircle size={18} />}
            title="Seed version"
            trailing={
              <span className="text-body text-textmuted">
                {stats.seedVersion ?? 'Not seeded'}
              </span>
            }
          />
        </OrgRows>
        <p className="mt-2 text-caption text-textmuted">
          Bundled seed: {SEED_VERSION} · {total} records stored locally
        </p>
      </section>

      <section>
        <SectionHeader title="Stored records" />
        <ul className="grid grid-cols-2 gap-2 tablet:grid-cols-4">
          {stats.rows.map((row) => (
            <li
              key={row.key}
              className="rounded-base border border-border bg-surface p-3 shadow-card"
            >
              <span className="block truncate text-caption text-textmuted">{row.label}</span>
              <span className="mt-1 block text-title text-textprimary">{row.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeader title="Reset demo data" />
        <div className="rounded-base border border-border bg-surface p-4 shadow-card">
          <p className="text-body text-textmuted">
            Wipes every locally stored record and restores the bundled demo data. Anything you
            created on this device is lost.
          </p>
          <Button
            className="mt-3"
            variant="danger"
            icon={<Refresh size={18} />}
            onClick={() => setConfirmOpen(true)}
          >
            Reseed demo data
          </Button>
        </div>
      </section>

      <section>
        <SectionHeader title="Simulated features" />
        <OrgRows>
          {SIMULATED.map((item) => (
            <OrgRowLink
              key={item.label}
              icon={<Box1 size={18} />}
              title={item.label}
              subtitle={item.detail}
              trailing={
                <span className="rounded-pill bg-warningbg px-2 py-1 text-caption font-bold text-warning">
                  Simulated
                </span>
              }
            />
          ))}
        </OrgRows>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Reseed demo data?"
        body="Every local record is wiped and the bundled demo data is restored. This cannot be undone."
        confirmLabel="Reseed"
        danger
        loading={busy}
        onConfirm={() => void reseed()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
