/**
 * Shared popover shell for the desktop nav (section 3.2 of the spec).
 *
 * Behaviour: closes on outside pointerdown, on Escape (returning focus to the
 * anchor) and on Tab (focus is leaving anyway). Motion is a 150ms fade + 6px
 * slide, disabled under prefers-reduced-motion.
 */
import { useEffect, type ReactNode, type RefObject } from 'react';

/** Call `onDismiss` when a pointerdown lands outside every given element. */
export function useDismissOnOutside(
  active: boolean,
  anchors: RefObject<HTMLElement | null>[],
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      for (const anchor of anchors) {
        if (anchor.current && anchor.current.contains(target)) return;
      }
      onDismiss();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onDismiss, ...anchors]);
}

/** Call `onEscape` when Escape is pressed anywhere while `active`. */
export function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

export interface DropdownPanelProps {
  id: string;
  labelledBy: string;
  align?: 'left' | 'right';
  /** Tailwind width class — kept as a prop so the mega panel and list panel differ. */
  widthClass?: string;
  children: ReactNode;
}

/**
 * The floating panel itself. Positioned absolutely against its (relative)
 * trigger wrapper; `align="right"` pins the right edge so the panel never
 * clips past the viewport's right side.
 */
export function DropdownPanel({
  id,
  labelledBy,
  align = 'left',
  widthClass = 'w-[320px]',
  children,
}: DropdownPanelProps) {
  return (
    <div
      id={id}
      role="menu"
      aria-labelledby={labelledBy}
      className={`absolute top-full z-50 mt-2 ${widthClass} max-w-[calc(100vw-32px)] animate-panelin motion-reduce:animate-none ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      <div className="overflow-hidden rounded-base border border-border bg-surface shadow-popover">{children}</div>
    </div>
  );
}
