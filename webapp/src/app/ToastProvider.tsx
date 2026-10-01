import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CloseCircle, InfoCircle, TickCircle } from 'iconsax-react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Callable with `.success` / `.error` helpers, so both usage styles work. */
export interface ToastApi {
  (message: string, tone?: ToastTone): void;
  success(message: string): void;
  error(message: string): void;
}

interface ToastContextValue {
  toast: ToastApi;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, { className: string; Icon: typeof InfoCircle }> = {
  success: { className: 'border-successbg text-success', Icon: TickCircle },
  error: { className: 'border-dangerbg text-danger', Icon: CloseCircle },
  info: { className: 'border-border text-textprimary', Icon: InfoCircle },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const base = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const value = useMemo<ToastContextValue>(() => {
    const api = base as ToastApi;
    api.success = (m: string) => base(m, 'success');
    api.error = (m: string) => base(m, 'error');
    return { toast: api, success: api.success, error: api.error };
  }, [base]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 tablet:bottom-8"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => {
          const { className, Icon } = TONE_STYLE[item.tone];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex max-w-[420px] items-start gap-2 rounded-base border bg-surface px-4 py-3 text-body shadow-card animate-fadeup ${className}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{item.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
