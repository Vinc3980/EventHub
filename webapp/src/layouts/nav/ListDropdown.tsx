/**
 * Shared dropdown list component for Help, Account, and other action menus.
 * Supports click-only or hoverable intent.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DropdownPanel, useDismissOnOutside, useEscape } from './Dropdown';
import type { NavEntry } from './navConfig';

export interface ListDropdownProps {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  align?: 'left' | 'right';
  widthClass?: string;
  items?: NavEntry[];
  children?: React.ReactNode;
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  hoverable?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPointerEnterItem?: (id: string, pointerType?: string) => void;
  onPointerLeaveItem?: (id: string, pointerType?: string) => void;
  onPointerEnterPanel?: (id: string, pointerType?: string) => void;
  onTriggerClick?: (id: string) => void;
}

export function ListDropdown({
  id: propId,
  label,
  icon,
  items,
  align = 'right',
  widthClass = 'w-[320px]',
  children,
  triggerContent,
  triggerClassName,
  hoverable = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onPointerEnterItem,
  onPointerLeaveItem,
  onPointerEnterPanel,
  onTriggerClick,
}: ListDropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const menuId = propId ?? label.toLowerCase();
  const panelId = `${menuId}-menu`;
  const triggerId = `${menuId}-trigger`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(false);
    } else {
      setInternalOpen(false);
    }
  };

  useDismissOnOutside(isOpen, [triggerRef, panelRef], close);
  useEscape(isOpen, () => {
    close();
    triggerRef.current?.focus();
  });

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (hoverable && onPointerEnterItem) {
      onPointerEnterItem(menuId, e.pointerType);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (hoverable && onPointerLeaveItem) {
      onPointerLeaveItem(menuId, e.pointerType);
    }
  };

  const handleClick = () => {
    if (hoverable && onTriggerClick) {
      onTriggerClick(menuId);
    } else if (controlledOnOpenChange) {
      controlledOnOpenChange(!isOpen);
    } else {
      setInternalOpen((v) => !v);
    }
  };

  return (
    <div
      className="relative"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={label}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        className={
          triggerClassName ??
          `flex h-[72px] items-center gap-1.5 px-3 text-body font-semibold transition-colors duration-200 ${
            isOpen ? 'text-primary' : 'text-textmuted hover:text-textprimary'
          }`
        }
      >
        {triggerContent ?? (
          <>
            {icon}
            {label}
          </>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          onPointerEnter={(e) => {
            if (hoverable && onPointerEnterPanel) {
              onPointerEnterPanel(menuId, e.pointerType);
            }
          }}
        >
          <DropdownPanel id={panelId} labelledBy={triggerId} align={align} widthClass={widthClass}>
            <div onClick={close} role="presentation">
              {children}
              {items?.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.id}
                    to={entry.to ?? '/help'}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-primary-6 focus:outline-none focus-visible:bg-primary-6 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-6 text-primary">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-bold text-textprimary">{entry.label}</span>
                      {entry.description && (
                        <span className="block truncate text-caption text-textmuted">{entry.description}</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </DropdownPanel>
        </div>
      )}
    </div>
  );
}
