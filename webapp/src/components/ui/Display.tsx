import type { ReactNode } from 'react';
import {
  Calendar1,
  CloseCircle,
  Heart,
  Information,
  NotificationBing,
  Star,
  Ticket,
} from 'iconsax-react';
import { formatCurrency } from '../../lib/format';
import { COLORS } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** Full-viewport loading indicator used by route changes and auth guards. */
export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background"
    >
      <Spinner size={32} className="text-primary" />
      <span className="text-body text-textmuted">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar — initials on a tint, optional accent gradient ring when `ring`
// ---------------------------------------------------------------------------
const AVATAR_TINTS = ['bg-primary-14', 'bg-primary-10', 'bg-successbg', 'bg-warningbg', 'bg-neutralbg', 'bg-primary-6'];

export function Avatar({
  name,
  url,
  size = 40,
  ring = false,
  className = '',
}: {
  name: string;
  url?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const label = parts.length === 0 ? '?' : parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  const tint = AVATAR_TINTS[(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 0) % AVATAR_TINTS.length];
  const img = url && url.trim().length > 0;

  const inner = img ? (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className="h-full w-full rounded-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  ) : (
    <span
      className={`flex h-full w-full items-center justify-center rounded-full font-bold ${tint}`}
      style={{ fontSize: Math.max(10, Math.round(size * 0.34)), color: COLORS.primary }}
    >
      {label}
    </span>
  );

  if (!ring) {
    return (
      <span
        className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        {inner}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-block shrink-0 rounded-full p-[2px] ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%)`,
      }}
    >
      <span className="block h-full w-full overflow-hidden rounded-full bg-surface p-[2px]">
        <span className="block h-full w-full overflow-hidden rounded-full">{inner}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusTag — same word→tone map as the mobile StatusTag widget
// ---------------------------------------------------------------------------
type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-successbg text-success',
  warning: 'bg-warningbg text-warning',
  danger: 'bg-dangerbg text-danger',
  neutral: 'bg-neutralbg text-textmuted',
  primary: 'bg-primary-10 text-primary',
};

const STATUS_TONE: Record<string, Tone> = {
  published: 'success',
  confirmed: 'success',
  completed: 'neutral',
  approved: 'success',
  resolved: 'success',
  active: 'success',
  promoted: 'success',
  success: 'success',
  paid: 'success',
  pending: 'warning',
  pending_review: 'warning',
  reviewing: 'warning',
  waiting: 'warning',
  requested: 'warning',
  draft: 'neutral',
  cancelled: 'neutral',
  expired: 'neutral',
  dismissed: 'neutral',
  notified: 'primary',
  rejected: 'danger',
  failed: 'danger',
  payment_failed: 'danger',
  denied: 'danger',
  open: 'danger',
  suspended: 'danger',
  refunded: 'primary',
  locked: 'neutral',
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] ?? 'neutral';
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusTag({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-caption font-semibold ${TONE_CLASS[statusTone(
        status,
      )]} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// FeaturedBadge / Stars / Price
// ---------------------------------------------------------------------------
export function FeaturedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold text-white ${className}`}
      style={{ backgroundColor: COLORS.accent }}
    >
      Featured
    </span>
  );
}

export function Stars({
  value,
  size = 16,
  onChange,
  label,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" role={onChange ? 'radiogroup' : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            size={size}
            variant={filled ? 'Bold' : 'Linear'}
            color={filled ? COLORS.accent : COLORS.neutral}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-checked={n === Math.round(value)}
            role="radio"
            onClick={() => onChange(n)}
            className="rounded-sm p-0.5 transition-transform duration-200 hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export function PriceTag({
  amount,
  original,
  free,
  className = '',
}: {
  amount: number;
  original?: number;
  free?: boolean;
  className?: string;
}) {
  const discounted = original != null && original > amount;
  if (free) {
    return <span className={`text-subtitle text-success ${className}`}>Free</span>;
  }
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="text-subtitle text-textprimary">{formatCurrency(amount, { compact: true })}</span>
      {discounted && (
        <span className="text-caption text-textmuted line-through">
          {formatCurrency(original as number, { compact: true })}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
export function SectionHeader({
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
      <h2 className="min-w-0 truncate text-title text-textprimary">{title}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / Empty / Error states — 8px base unit (desktop collapses the
// spacing of the mobile versions by design)
// ---------------------------------------------------------------------------
export function Skeleton({
  className = '',
  radius = 'rounded-base',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <span
      className={`relative block overflow-hidden bg-skeleton ${radius} ${className}`}
      aria-hidden="true"
    >
      <span className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-surface/70 to-transparent" />
    </span>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-6 text-primary">
        {icon ?? <Information size={26} />}
      </span>
      <h3 className="text-subtitle text-textprimary">{title}</h3>
      {body && <p className="mt-1 max-w-[36ch] text-body text-textmuted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<CloseCircle size={26} className="text-danger" />}
      title={title}
      body={body}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-border bg-surface px-4 py-2 text-button text-textprimary hover:border-primary hover:text-primary"
          >
            Try again
          </button>
        )
      }
    />
  );
}

export function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 bg-warningbg px-4 py-2 text-caption text-textprimary">
      <NotificationBing size={14} className="text-warning" />
      <span className="min-w-0 truncate">You are offline. Showing saved data.</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress + counters
// ---------------------------------------------------------------------------
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-pill bg-neutralbg ${className}`}>
      <div className="h-full rounded-pill bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MeterRow({
  label,
  value,
  total,
  tone = 'primary',
}: {
  label: string;
  value: number;
  total: number;
  tone?: 'primary' | 'warning';
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-caption text-textmuted">{label}</span>
        <span className="text-caption font-semibold text-textprimary">
          {value}/{total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-neutralbg">
        <div
          className={`h-full rounded-pill ${tone === 'warning' ? 'bg-warning' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip / Badge
// ---------------------------------------------------------------------------
export function Chip({
  children,
  selected,
  onClick,
  className = '',
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] font-semibold transition-colors duration-200';
  const state = selected
    ? 'border-primary bg-primary-10 text-primary'
    : 'border-border bg-surface text-textmuted hover:border-primary hover:text-primary';
  if (!onClick) {
    return <span className={`${base} ${state} ${className}`}>{children}</span>;
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${state} ${className}`} aria-pressed={selected}>
      {children}
    </button>
  );
}

export function CountBadge({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-pill px-1 text-[10px] font-bold leading-[18px] text-white ${className}`}
      style={{ backgroundColor: COLORS.accent }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function UnreadDot({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: COLORS.accent }}
      aria-label="Unread"
    />
  );
}

// ---------------------------------------------------------------------------
// Category icon tile — categories stay colour-neutral (no per-category hues)
// ---------------------------------------------------------------------------
export function CategoryIcon({
  category,
  size = 18,
  className = '',
}: {
  category: string;
  size?: number;
  className?: string;
}) {
  if (category === 'wedding') return <Heart size={size} variant="Bold" className={className} />;
  if (category === 'funeral') return <Calendar1 size={size} className={className} />;
  if (category === 'corporate') return <Ticket size={size} className={className} />;
  return <Star size={size} className={className} />;
}
