import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseSquare, Warning2 } from 'iconsax-react';
import { Button } from './Button';
import { IconButton } from './Button';

/**
 * Modal sheet — the web equivalent of the mobile bottom sheet / dialog.
 * Mobile: anchored to the bottom with 24px top radius. Desktop (≥768px):
 * a centred card capped at 560px (variant="center").
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'bottom',
  wide,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'bottom' | 'center';
  wide?: boolean;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center tablet:items-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
        tabIndex={-1}
      />
      <div
        className={`relative flex max-h-[88vh] w-full flex-col bg-surface shadow-dark animate-fadeup ${
          variant === 'bottom'
            ? 'rounded-t-lg tablet:rounded-base'
            : 'mx-4 rounded-base'
        } ${wide ? 'tablet:max-w-[720px]' : 'tablet:max-w-[560px]'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id={labelledBy} className="min-w-0 truncate text-title text-textprimary">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <CloseSquare size={22} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      variant="center"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            danger ? 'bg-dangerbg text-danger' : 'bg-warningbg text-warning'
          }`}
        >
          <Warning2 size={20} />
        </span>
        <p className="min-w-0 text-body text-textmuted">{body}</p>
      </div>
    </Sheet>
  );
}
