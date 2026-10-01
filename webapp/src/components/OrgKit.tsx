import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight3, Calendar1, Home2, Message, User } from 'iconsax-react';
import type { Observable, Subscription, Table } from 'dexie';
import { useLive, type LiveResult } from '../db/live';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Live data — bridges a service Observable into `useLiveQuery`
// ---------------------------------------------------------------------------
async function liveValue<T>(
  source: Observable<T>,
  touch: Table<Row, string>[],
): Promise<T> {
  await Promise.all(touch.map((table) => table.toArray()));
  return new Promise<T>((resolve, reject) => {
    const sub: Subscription = source.subscribe({
      next: (value) => {
        sub.unsubscribe();
        resolve(value);
      },
      error: (error) => {
        sub.unsubscribe();
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });
  });
}

/**
 * Reactive read for a service observable: the surrounding live query
 * re-queries whenever anything in `touch` changes, and the emitted value comes
 * straight from the service method named in `source`.
 */
export function useServiceLive<T>(
  source: Observable<T>,
  deps: unknown[],
  touch: Table<Row, string>[],
): LiveResult<T> {
  return useLive(() => liveValue(source, touch), deps);
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------
export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
export function OrgCard({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-base border border-border bg-surface shadow-card ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function OrgHeading({
  title,
  action,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="min-w-0 truncate text-subtitle text-textprimary">{title}</h2>
      {action}
    </div>
  );
}

export function OrgStatCard({
  value,
  label,
  hint,
  tone,
  loading,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  tone?: 'success' | 'primary';
  loading?: boolean;
}) {
  const valueTone =
    tone === 'success' ? 'text-success' : tone === 'primary' ? 'text-primary' : 'text-textprimary';
  return (
    <div className="min-w-0 flex-1 rounded-base border border-border bg-surface px-3 py-4 text-center shadow-card">
      <p className={`truncate text-title ${valueTone}`} aria-label={typeof value === 'string' ? value : undefined}>
        {loading ? <span className="inline-block h-6 w-10 animate-pulse rounded-sm bg-skeleton" /> : value}
      </p>
      <p className="mt-1 truncate text-caption text-textmuted">{label}</p>
      {hint && <p className="mt-0.5 truncate text-caption text-textmuted">{hint}</p>}
    </div>
  );
}

export function OrgTile({
  to,
  icon,
  label,
  description,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-1 flex-col gap-2 rounded-base border border-border bg-surface p-4 shadow-card transition-colors duration-200 hover:border-primary"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-10 text-primary [&>svg]:block">
        {icon}
      </span>
      <span className="min-w-0 truncate text-button text-textprimary">{label}</span>
      {description && <span className="min-w-0 truncate text-caption text-textmuted">{description}</span>}
    </Link>
  );
}

export function OrgRowLink({
  to,
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  to?: string;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-10 text-primary [&>svg]:block">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-textprimary">{title}</span>
        {subtitle !== undefined && (
          <span className="mt-0.5 block truncate text-caption text-textmuted">{subtitle}</span>
        )}
      </span>
      {trailing ?? (to ? <ArrowRight3 size={16} className="shrink-0 text-textmuted" /> : null)}
    </>
  );
  const base =
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-primary-6';
  if (to) {
    return (
      <Link to={to} className={base}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {content}
    </button>
  );
}

export function OrgRows({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-base border border-border bg-surface shadow-card ${className}`}>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status banner — event lifecycle callouts
// ---------------------------------------------------------------------------
export function OrgBanner({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  icon: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  const toneClass = {
    success: 'bg-successbg text-success',
    warning: 'bg-warningbg text-warning',
    danger: 'bg-dangerbg text-danger',
    neutral: 'bg-neutralbg text-textmuted',
    primary: 'bg-primary-10 text-primary',
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-base p-4 ${toneClass}`}>
      <span className="shrink-0 [&>svg]:block">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold">{title}</p>
        {body && <p className="mt-0.5 text-caption opacity-90">{body}</p>}
        {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section nav — dashboard quick links (mirrors the mobile bottom bar routes)
// ---------------------------------------------------------------------------
const ORGANIZER_NAV = [
  { to: '/organizer', icon: <Home2 size={18} />, label: 'Dashboard' },
  { to: '/organizer/events', icon: <Calendar1 size={18} />, label: 'My events' },
  { to: '/chats', icon: <Message size={18} />, label: 'Chat' },
  { to: '/profile', icon: <User size={18} />, label: 'Profile' },
];

export function OrgSectionNav({ current }: { current: string }) {
  return (
    <nav aria-label="Organizer sections" className="flex gap-2 overflow-x-auto no-scrollbar">
      {ORGANIZER_NAV.map((item) => {
        const active = item.to === current;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-section transition-colors duration-200 ${
              active
                ? 'border-primary bg-primary-10 text-primary'
                : 'border-border bg-surface text-textmuted hover:border-primary hover:text-primary'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
