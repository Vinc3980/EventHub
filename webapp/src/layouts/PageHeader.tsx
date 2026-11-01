/**
 * Shared page header (section 3.3): breadcrumb trail + page heading.
 *
 * Rendering rule, driven by route metadata:
 *  - `header: true`  → crumbs + H1 (the screen itself renders no heading);
 *  - `header` unset + a `parent` → a crumbs-only row above the screen's own
 *    heading (the screen keeps its H1);
 *  - neither → nothing (e.g. Home, Profile).
 *
 * Breadcrumbs are ancestors only — the current page is carried by the H1.
 */
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight2 } from 'iconsax-react';
import { breadcrumbs, routeMeta } from '../routes/routeMeta';
import type { ReactNode } from 'react';

export function PageHeader({ actions }: { actions?: ReactNode }) {
  const location = useLocation();
  const meta = routeMeta(location.pathname);
  const crumbs = breadcrumbs(location.pathname);

  // No heading and no ancestors → the screen owns the whole viewport top.
  if (!meta.header && crumbs.length === 0) return null;

  // Crumbs-only row (screen renders its own heading below).
  if (!meta.header) {
    return (
      <nav aria-label="Breadcrumb" className="mb-3">
        <CrumbTrail crumbs={crumbs} />
      </nav>
    );
  }

  return (
    <div className="mb-5 min-w-0">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <CrumbTrail crumbs={crumbs} />
        </nav>
      )}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-display text-textprimary on-backdrop-title">{meta.title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function CrumbTrail({ crumbs }: { crumbs: { label: string; to?: string }[] }) {
  return (
    <ol className="flex min-w-0 flex-wrap items-center gap-1 text-caption text-textmuted on-backdrop-muted">
      {crumbs.map((crumb, index) => (
        <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
          {index > 0 && <ArrowRight2 size={12} className="shrink-0 text-neutral" aria-hidden="true" />}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="min-w-0 truncate transition-colors duration-200 hover:text-primary"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="min-w-0 truncate">{crumb.label}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
