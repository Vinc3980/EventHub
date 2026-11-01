/**
 * A top-nav menu: trigger + mega/list panel (section 3.2).
 *
 * Keyboard contract (exercised by `src/test/nav-keyboard.test.tsx`):
 *  - trigger: Enter/Space/ArrowDown opens and focuses the first item,
 *    ArrowUp opens and focuses the last item, Escape closes.
 *  - panel:   ↑/↓ move within a column, ←/→ move across columns at the same
 *    row, Home/End jump inside the column, Escape closes and returns focus to
 *    the trigger, Tab closes (focus then continues naturally).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown2 } from 'iconsax-react';
import type { NavEntry, NavMenu as NavMenuConfig } from './navConfig';
import { entryHref } from './navConfig';
import { DropdownPanel, useDismissOnOutside, useEscape } from './Dropdown';

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 250;

/** Static classes per column count (Tailwind JIT cannot see template literals). */
const MEGA_GRID: Record<number, string> = {
  2: 'grid-cols-1 tablet:grid-cols-2',
  3: 'grid-cols-1 tablet:grid-cols-2 wide:grid-cols-3',
  4: 'grid-cols-1 tablet:grid-cols-2 wide:grid-cols-4',
};

export interface NavMenuProps {
  menu: NavMenuConfig;
  /** True when the current route belongs to this menu (drives the underline). */
  active: boolean;
  /** Signed-in uid, or null when browsing logged out. */
  uid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Event-scoped entries (`eventTo`) hand their template here — TopNav opens the picker. */
  onEventTool: (template: string) => void;
}

function ItemIcon({ icon: Icon }: { icon: NavEntry['icon'] }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
      <Icon size={18} />
    </span>
  );
}

export function NavMenu({ menu, active, uid, open, onOpenChange, onEventTool }: NavMenuProps) {
  const panelId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(0);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const close = useCallback(() => {
    clearTimers();
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => clearTimers, []);

  useDismissOnOutside(open, [triggerRef, panelRef], close);
  useEscape(open, () => {
    close();
    // Return focus to the trigger so keyboard users are not stranded.
    triggerRef.current?.focus();
  });

  const openPanel = (focus: 'first' | 'last' | 'none' = 'none') => {
    clearTimers();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const panelWidth = menu.sections.length > 1 ? 640 : 320;
      // Clamp the panel inside the viewport: a wide mega panel cannot always be
      // left- or right-aligned to its trigger without clipping an edge.
      const maxLeft = Math.max(16, window.innerWidth - panelWidth - 16);
      const desired = Math.min(Math.max(16, rect.left), maxLeft);
      setOffset(desired - rect.left);
    }
    onOpenChange(true);
    if (focus === 'none') return;
    // The panel mounts on the next tick — move focus once it exists.
    requestAnimationFrame(() => {
      const items = panelRef.current?.querySelectorAll<HTMLElement>('[data-navitem]');
      if (!items || items.length === 0) return;
      items[focus === 'first' ? 0 : items.length - 1]?.focus();
    });
  };

  const scheduleOpen = () => {
    clearTimers();
    openTimer.current = setTimeout(() => openPanel('none'), OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => onOpenChange(false), CLOSE_DELAY_MS);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openPanel('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openPanel('last');
    } else if (event.key === 'Escape' && open) {
      close();
    }
  };

  const focusItemAt = (items: HTMLElement[], index: number) => {
    items[index]?.focus();
  };

  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-navitem]') ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    const item = items[current];
    const col = Number(item.dataset.col ?? '0');
    const row = Number(item.dataset.row ?? '0');

    const inColumn = (column: number) =>
      items.filter((el) => Number(el.dataset.col ?? '0') === column);
    const column = inColumn(col);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = column.filter((el) => Number(el.dataset.row ?? '0') > row);
        focusItemAt(next.length > 0 ? items : column, next.length > 0 ? items.indexOf(next[0]) : 0);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = column.filter((el) => Number(el.dataset.row ?? '0') < row);
        focusItemAt(
          prev.length > 0 ? items : column,
          prev.length > 0 ? items.indexOf(prev[prev.length - 1]) : column.length - 1,
        );
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        const neighbour = inColumn(col + 1);
        if (neighbour.length === 0) break;
        const match = neighbour.find((el) => Number(el.dataset.row ?? '0') === row) ?? neighbour[0];
        focusItemAt(items, items.indexOf(match));
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const neighbour = inColumn(col - 1);
        if (neighbour.length === 0) break;
        const match = neighbour.find((el) => Number(el.dataset.row ?? '0') === row) ?? neighbour[0];
        focusItemAt(items, items.indexOf(match));
        break;
      }
      case 'Home':
        event.preventDefault();
        focusItemAt(items, items.indexOf(column[0]));
        break;
      case 'End':
        event.preventDefault();
        focusItemAt(items, items.indexOf(column[column.length - 1]));
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };

  const mega = menu.sections.length > 1;
  const columns = menu.sections.length;

  return (
    <div
      className="relative"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        id={labelId}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : openPanel('none'))}
        onKeyDown={onTriggerKeyDown}
        className={`relative flex h-[72px] items-center gap-1.5 px-3 text-body font-semibold transition-colors duration-200 ${
          active || open ? 'text-primary' : 'text-textmuted hover:text-textprimary'
        }`}
      >
        {menu.label}
        <ArrowDown2 size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        {(active || open) && (
          <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-pill bg-primary" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div ref={panelRef} onKeyDown={onPanelKeyDown}>
          <DropdownPanel id={panelId} labelledBy={labelId} offset={offset} widthClass={mega ? 'w-[640px]' : 'w-[320px]'}>
            <div
              className={
                mega
                  ? `grid max-h-[70vh] grid-cols-1 gap-1 overflow-y-auto p-3 ${MEGA_GRID[columns] ?? MEGA_GRID[2]}`
                  : 'max-h-[70vh] overflow-y-auto p-3'
              }
            >
              {menu.sections.map((section, col) => (
                <div key={section.id} className="min-w-0">
                  {section.title && (
                    <p className="px-2.5 pb-1.5 text-section uppercase tracking-wide text-textmuted">
                      {section.title}
                    </p>
                  )}
                  {section.items.map((entry, row) => {
                  const href = entryHref(entry, uid);
                  const Icon = entry.icon;
                  const body = (
                    <>
                      <ItemIcon icon={Icon} />
                      <span className="min-w-0">
                        <span className="block truncate text-body font-bold text-textprimary">{entry.label}</span>
                        {entry.description && (
                          <span className="block truncate text-caption text-textmuted">{entry.description}</span>
                        )}
                      </span>
                    </>
                  );
                  const className =
                    'flex min-w-0 items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-200 hover:bg-primary-6 focus:outline-none focus-visible:bg-primary-6 focus-visible:ring-2 focus-visible:ring-primary';

                  return entry.eventTo ? (
                    <button
                      key={`${section.id}-${entry.id}`}
                      type="button"
                      role="menuitem"
                      data-navitem=""
                      data-col={col}
                      data-row={row}
                      tabIndex={-1}
                      onClick={() => {
                        close();
                        onEventTool(entry.eventTo as string);
                      }}
                      className={className}
                    >
                      {body}
                    </button>
                  ) : (
                    <Link
                      key={`${section.id}-${entry.id}`}
                      to={href ?? '/login'}
                      role="menuitem"
                      data-navitem=""
                      data-col={col}
                      data-row={row}
                      tabIndex={-1}
                      onClick={close}
                      className={className}
                    >
                      {body}
                    </Link>
                  );
                  })}
                </div>
              ))}
            </div>
          </DropdownPanel>
        </div>
      )}
    </div>
  );
}
