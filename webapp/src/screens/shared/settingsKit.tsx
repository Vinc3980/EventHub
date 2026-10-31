/**
 * Shared row/section primitives for the settings sub-pages (section 3.6),
 * lifted from the original monolithic SettingsScreen so `/settings/account`,
 * `/settings/security` and `/settings/notifications` all look identical.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight3 } from 'iconsax-react';

export function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
        {icon}
      </span>
      <h2 className="min-w-0 truncate text-section font-bold text-textmuted">{title}</h2>
    </div>
  );
}

export function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {children}
    </div>
  );
}

export function RowContent({
  icon,
  title,
  subtitle,
  trailing,
  muted,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  muted?: boolean;
}) {
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-body font-semibold ${
            muted ? 'text-textmuted' : 'text-textprimary'
          }`}
        >
          {title}
        </span>
        {subtitle !== undefined && (
          <span className="mt-0.5 block truncate text-caption text-textmuted">{subtitle}</span>
        )}
      </span>
      {trailing}
    </>
  );
}

export const ROW_BASE = 'flex w-full items-center gap-3 px-4 py-3 text-left';
export const ROW_CLASS = `${ROW_BASE} transition-colors duration-200 hover:bg-primary-6`;

export function RowLink({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link to={to} className={ROW_CLASS}>
      <RowContent
        icon={icon}
        title={title}
        subtitle={subtitle}
        trailing={<ArrowRight3 size={16} className="shrink-0 text-textmuted" />}
      />
    </Link>
  );
}

export function RowButton({
  onClick,
  icon,
  title,
  subtitle,
  trailing,
}: {
  onClick: () => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      <RowContent
        icon={icon}
        title={title}
        subtitle={subtitle}
        trailing={trailing ?? <ArrowRight3 size={16} className="shrink-0 text-textmuted" />}
      />
    </button>
  );
}
