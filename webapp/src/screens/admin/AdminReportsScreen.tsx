import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'iconsax-react';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { reportService } from '../../services/reportService';
import { useToast } from '../../app/ToastProvider';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { Report } from '../../models';

interface ReportItem {
  report: Report;
  targetLabel: string;
  reporterName: string;
}

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

function targetLink(report: Report): string {
  return report.targetType === 'user' ? `/u/${report.targetId}` : `/event/${report.targetId}`;
}

export default function AdminReportsScreen() {
  const toast = useToast();
  const [tab, setTab] = useState('open');
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, error } = useLive(async () => {
    const [reports, users, events] = await Promise.all([
      db.reports.toArray(),
      db.users.toArray(),
      db.events.toArray(),
    ]);
    const nameById = new Map<string, string>();
    for (const user of users) {
      nameById.set(String(user.uid ?? ''), String(user.name ?? 'Unknown'));
    }
    const titleById = new Map<string, string>();
    for (const event of events) {
      titleById.set(String(event.id ?? ''), String(event.title ?? ''));
    }
    const items: ReportItem[] = reports.map((row) => {
      const report = Report.fromMap(String(row.id ?? ''), row);
      const targetLabel =
        report.targetType === 'user'
          ? nameById.get(report.targetId) ?? 'Deleted profile'
          : titleById.get(report.targetId) ?? 'Deleted event';
      return {
        report,
        targetLabel,
        reporterName: nameById.get(report.reporterId) ?? 'Unknown',
      };
    });
    items.sort((a, b) => b.report.createdAt.getTime() - a.report.createdAt.getTime());
    return items;
  }, [retry]);

  async function dismiss(reportId: string) {
    setBusyId(reportId);
    try {
      await reportService.dismissReport(reportId);
      toast.success('Report dismissed.');
    } catch (err) {
      toast.error(`Could not dismiss report: ${String(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function removeContent(reportId: string) {
    setBusyId(reportId);
    try {
      await reportService.removeContent(reportId);
      toast.success('Content removed.');
    } catch (err) {
      toast.error(`Could not remove content: ${String(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load reports."
        onRetry={() => setRetry((n) => n + 1)}
      />
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading reports">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const shown = data.filter(({ report }) => {
    const status = String(report.status);
    return tab === 'open'
      ? status === 'open'
      : status === 'resolved' || status === 'removed';
  });

  return (
    <div className="space-y-4 animate-fadeup">
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Flag size={26} />}
          title={tab === 'open' ? 'No open reports' : 'No resolved reports'}
          body={tab === 'open' ? 'Nothing has been reported yet.' : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {shown.map(({ report, targetLabel, reporterName }) => (
            <li
              key={report.id}
              className="rounded-base border border-border bg-surface p-3.5 shadow-card"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-warningbg px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-warning">
                  {report.targetType}
                </span>
                <Link
                  to={targetLink(report)}
                  className="min-w-0 flex-1 truncate text-body font-bold text-textprimary hover:text-primary"
                >
                  {targetLabel}
                </Link>
              </div>
              <p className="mt-1.5 text-caption text-textmuted">
                Reported by {reporterName}
              </p>
              <p className="mt-1 text-body italic text-textprimary">"{report.reason}"</p>
              {report.details && (
                <p className="mt-1 text-caption text-textmuted">{report.details}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void dismiss(report.id)}
                  loading={busyId === report.id}
                  disabled={busyId != null && busyId !== report.id}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void removeContent(report.id)}
                  loading={busyId === report.id}
                  disabled={busyId != null && busyId !== report.id}
                >
                  Remove content
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
