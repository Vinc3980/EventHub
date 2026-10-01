import { memo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Calendar1, Location } from 'iconsax-react';
import { Event } from '../../models';
import { formatDateCard, formatCurrency } from '../../lib/format';
import { COLORS, deepViolet } from '../../theme/tokens';
import { FeaturedBadge, PriceTag, StatusTag } from './Display';
import { CoverMedia as MediaCover } from './CoverMedia';

/** Reserved accent use #2 — the filled save (heart/bookmark). */
export function SaveButton({
  saved,
  onClick,
  size = 18,
  className = '',
}: {
  saved: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={saved ? 'Remove from saved' : 'Save event'}
      aria-pressed={saved}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 backdrop-blur transition-transform duration-200 hover:scale-105 ${className}`}
    >
      <Bookmark
        size={size}
        variant={saved ? 'Bold' : 'Linear'}
        color={saved ? COLORS.accent : COLORS.textPrimary}
      />
    </button>
  );
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="rounded-pill bg-surface/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-textprimary backdrop-blur">
      {category}
    </span>
  );
}

function CoverMedia({ ev, className }: { ev: Event; className: string }) {
  return (
    <MediaCover
      url={ev.coverImageUrl}
      className={className}
      fallback={
        <div
          className={className}
          style={{
            backgroundImage: `linear-gradient(135deg, ${COLORS.primary} 0%, ${deepViolet} 100%)`,
          }}
          aria-hidden="true"
        />
      }
    />
  );
}

interface CardBase {
  ev: Event;
  saved: boolean;
  onSave: () => void;
}

/**
 * Feed card — the Home stream card (mobile `event_feed_card.dart`):
 * full-bleed 16:9 media with a bottom scrim carrying title/date/venue/price.
 */
export const EventFeedCard = memo(function EventFeedCard({ ev, saved, onSave, href }: CardBase & { href: string }) {
  return (
    <article className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <Link to={href} className="block focus-visible:outline-offset-4">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutralbg">
          <CoverMedia ev={ev} className="h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(22,23,26,0) 0%, rgba(22,23,26,0.85) 100%)',
            }}
          />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <CategoryChip category={ev.category} />
            {ev.isCurrentlyFeatured && <FeaturedBadge />}
          </div>
          <div className="absolute inset-x-3 bottom-3 min-w-0">
            <h3 className="truncate text-subtitle text-white">{ev.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-white/85">
              <span className="inline-flex min-w-0 items-center gap-1">
                <Calendar1 size={13} />
                <span className="truncate">{formatDateCard(ev.date)}</span>
              </span>
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <Location size={13} />
                <span className="truncate">{ev.venue}</span>
              </span>
            </div>
            <div className="mt-1.5">
              <PriceTag
                amount={ev.cheapestPrice}
                original={ev.cheapestOriginalPrice}
                free={ev.isFree}
                className="[&>span:first-child]:text-white [&_span]:!text-white"
              />
            </div>
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3">
        <SaveButton saved={saved} onClick={(e) => { e.preventDefault(); onSave(); }} />
      </div>
    </article>
  );
});

/**
 * Event card — the standard vertical card (mobile `event_card.dart`) used in
 * list/grid contexts outside the feed.
 */
export const EventCard = memo(function EventCard({
  ev,
  saved,
  onSave,
  href,
  footer,
  compact,
}: CardBase & { href: string; footer?: ReactNode; compact?: boolean }) {
  return (
    <article className="overflow-hidden rounded-base border border-border bg-surface transition-shadow duration-200 hover:shadow-card">
      <div className="relative">
        <Link to={href} className="block">
          <div className={`relative w-full overflow-hidden bg-neutralbg ${compact ? 'aspect-[16/10]' : 'aspect-video'}`}>
            <CoverMedia ev={ev} className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <CategoryChip category={ev.category} />
              {ev.isCurrentlyFeatured && <FeaturedBadge />}
            </div>
          </div>
        </Link>
        <div className="absolute right-3 top-3">
          <SaveButton saved={saved} onClick={(e) => { e.preventDefault(); onSave(); }} />
        </div>
        {ev.status !== 'published' && (
          <div className="absolute bottom-3 left-3">
            <StatusTag status={ev.status} />
          </div>
        )}
      </div>
      <div className="p-3.5">
        <Link to={href} className="block min-w-0">
          <h3 className="truncate text-subtitle text-textprimary">{ev.title}</h3>
        </Link>
        <div className="mt-1 flex min-w-0 flex-col gap-1 text-caption text-textmuted">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Calendar1 size={13} className="shrink-0" />
            <span className="truncate">{formatDateCard(ev.date)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Location size={13} className="shrink-0" />
            <span className="truncate">{ev.venue}</span>
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <PriceTag amount={ev.cheapestPrice} original={ev.cheapestOriginalPrice} free={ev.isFree} />
          {footer}
        </div>
      </div>
    </article>
  );
});

/**
 * Grid tile — Explore (mobile `event_grid_tile.dart`), two columns on phones,
 * three from 768px, four from 1024px.
 */
export const EventGridTile = memo(function EventGridTile({
  ev,
  saved,
  onSave,
  href,
}: CardBase & { href: string }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-base border border-border bg-surface transition-shadow duration-200 hover:shadow-card">
      <div className="relative">
        <Link to={href} className="block">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutralbg">
            <CoverMedia ev={ev} className="h-full w-full object-cover" />
            {ev.isCurrentlyFeatured && (
              <div className="absolute left-2 top-2">
                <FeaturedBadge />
              </div>
            )}
          </div>
        </Link>
        <div className="absolute right-2 top-2">
          <SaveButton saved={saved} onClick={(e) => { e.preventDefault(); onSave(); }} size={16} />
        </div>
      </div>
      <div className="min-w-0 p-3">
        <Link to={href} className="block min-w-0">
          <h3 className="truncate text-body font-bold text-textprimary">{ev.title}</h3>
        </Link>
        <p className="mt-0.5 truncate text-caption text-textmuted">{ev.venue}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-caption font-semibold text-textmuted">
            {formatDateCard(ev.date)}
          </span>
          <span className="shrink-0 text-caption font-bold text-primary">
            {ev.isFree ? 'Free' : formatCurrency(ev.cheapestPrice, { compact: true })}
          </span>
        </div>
      </div>
    </article>
  );
});
