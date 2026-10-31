/**
 * Module hub pages (section 3.6): a grid of large tiles, one per destination,
 * each carrying a live count where one exists. This is what turns the
 * categorical modules (Host, Tickets, Community, Account, Admin, Help) into
 * real "hub" pages instead of bare link lists.
 *
 * Motion: a 60ms stagger, ≤8px slide, honouring prefers-reduced-motion via
 * the `motion-reduce:animate-none` class.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Icon } from 'iconsax-react';
import { Skeleton } from './ui';
import { useEventTool } from './EventToolContext';

export interface HubTileData {
  id: string;
  label: string;
  description?: string;
  icon: Icon;
  /** Static destination. */
  to?: string;
  /** Event-scoped template — the page resolves it (usually via the picker). */
  eventTo?: string;
  /** Live count shown as a badge; `null` while loading, `undefined` when n/a. */
  count?: number | null;
  /** Renders wider (2 columns) and with the primary gradient chip. */
  featured?: boolean;
  /** Destructive styling (danger chip + red count). */
  danger?: boolean;
}

const CHIP_TONE = {
  default: 'bg-primary-6 text-primary',
  featured: 'text-white',
  danger: 'bg-dangerbg text-danger',
} as const;

export function HubTile({
  tile,
  index = 0,
  onClick,
}: {
  tile: HubTileData;
  index?: number;
  onClick?: () => void;
}) {
  const { openEventTool } = useEventTool();
  const Icon = tile.icon;
  const chipClass = tile.featured
    ? CHIP_TONE.featured
    : tile.danger
      ? CHIP_TONE.danger
      : CHIP_TONE.default;

  const activate = () => {
    if (tile.eventTo) openEventTool(tile.eventTo);
    else onClick?.();
  };

  const inner = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl ${chipClass}`}
          style={tile.featured ? { backgroundImage: 'var(--eh-tile-gradient)' } : undefined}
        >
          <Icon size={24} variant={tile.featured ? 'Bold' : 'Linear'} />
        </span>
        {tile.count !== undefined && (
          <span
            className={`shrink-0 rounded-pill px-2.5 py-1 text-caption font-bold ${
              tile.danger ? 'bg-dangerbg text-danger' : 'bg-neutralbg text-textmuted'
            }`}
          >
            {tile.count === null ? '—' : tile.count}
          </span>
        )}
      </span>
      <span className="mt-3 block min-w-0 truncate text-subtitle text-textprimary">{tile.label}</span>
      {tile.description && (
        <span className="mt-1 block min-w-0 line-clamp-2 text-caption text-textmuted">{tile.description}</span>
      )}
    </>
  );

  const className =
    'flex min-w-0 flex-col rounded-[20px] border border-border bg-surface p-4 text-left shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-popover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary animate-fadeup motion-reduce:animate-none';

  return (
    <div
      className={`min-w-0 ${tile.featured ? 'tablet:col-span-2' : ''}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {tile.to ? (
        <Link to={tile.to} className={`${className} block w-full`}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={activate} className={`${className} w-full`}>
          {inner}
        </button>
      )}
    </div>
  );
}

export function HubPage({
  intro,
  sections,
}: {
  intro?: ReactNode;
  sections: { id: string; title?: string; tiles: HubTileData[] }[];
}) {
  return (
    <div className="space-y-8">
      {intro}
      {sections.map((section) => (
        <section key={section.id} aria-label={section.title ?? section.id}>
          {section.title && (
            <h2 className="mb-3 text-title text-textprimary">{section.title}</h2>
          )}
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-3 wide:grid-cols-4">
            {section.tiles.map((tile, index) => (
              <HubTile key={tile.id} tile={tile} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Skeleton grid shown while the hub's live counts resolve. */
export function HubSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-3 wide:grid-cols-4"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: tiles }, (_, index) => (
        <div key={index} className="rounded-[20px] border border-border bg-surface p-4 shadow-card">
          <Skeleton className="h-[52px] w-[52px]" radius="rounded-xl" />
          <Skeleton className="mt-3 h-5 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
