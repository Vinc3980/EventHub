import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { SearchNormal, ArrowDown2, CloseCircle } from 'iconsax-react';

// ---------------------------------------------------------------------------
// Field wrapper — label + helper/error text, desktop input height 48px
// ---------------------------------------------------------------------------
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-1 text-caption font-semibold text-textprimary">
        <span className="min-w-0 truncate">{label}</span>
        {required && <span className="text-primary">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-caption text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-caption text-textmuted">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  'w-full rounded-md border bg-surface px-3.5 text-body text-textprimary placeholder:text-neutral transition-colors duration-200 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-neutralbg';

const CONTROL_STATE = (invalid?: boolean) =>
  invalid ? 'border-danger' : 'border-border hover:border-neutral';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, leading, trailing, className = '', ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center">
      {leading && (
        <span className="pointer-events-none absolute left-3 flex text-textmuted [&>svg]:block">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        className={`h-12 ${CONTROL} ${CONTROL_STATE(invalid)} ${leading ? 'pl-10' : ''} ${
          trailing ? 'pr-10' : ''
        } ${className}`}
        {...rest}
      />
      {trailing && <span className="absolute right-3 flex text-textmuted [&>svg]:block">{trailing}</span>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`min-h-[104px] w-full resize-y rounded-md border bg-surface px-3.5 py-3 text-body text-textprimary placeholder:text-neutral transition-colors duration-200 focus:border-primary focus:outline-none ${CONTROL_STATE(
        invalid,
      )} ${className}`}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className = '', children, ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center">
      <select
        ref={ref}
        className={`h-12 ${CONTROL} ${CONTROL_STATE(invalid)} appearance-none pr-10 ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ArrowDown2 size={16} className="pointer-events-none absolute right-3 text-textmuted" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// SearchField — 52px tall card with leading icon
// ---------------------------------------------------------------------------
export function SearchField({
  value,
  onChange,
  placeholder = 'Search events, venues, organizers',
  className = '',
  autoFocus,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <div className={`relative flex items-center ${className}`}>
      <SearchNormal size={20} className="pointer-events-none absolute left-4 text-textmuted" />
      <input
        id={id}
        ref={inputRef}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-[52px] w-full rounded-base border border-border bg-surface pl-12 pr-11 text-body text-textprimary placeholder:text-neutral focus:border-primary focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 text-textmuted hover:text-textprimary"
        >
          <CloseCircle size={18} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control / Tabs
// ---------------------------------------------------------------------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`no-scrollbar flex w-full gap-1 overflow-x-auto rounded-pill bg-neutralbg p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`h-9 shrink-0 rounded-pill px-4 text-[13px] font-semibold transition-colors duration-200 ${
              active ? 'bg-surface text-primary shadow-card' : 'text-textmuted hover:text-textprimary'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  className = '',
}: {
  tabs: { value: string; label: string; badge?: number }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`no-scrollbar flex gap-1 overflow-x-auto border-b border-border ${className}`} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`relative h-11 shrink-0 px-3 text-[14px] font-semibold transition-colors duration-200 ${
              active ? 'text-primary' : 'text-textmuted hover:text-textprimary'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="rounded-pill bg-primary-10 px-1.5 text-[10px] font-bold text-primary">
                  {tab.badge}
                </span>
              )}
            </span>
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-pill bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-body font-semibold text-textprimary">{label}</p>
        {description && <p className="mt-0.5 text-caption text-textmuted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-neutral'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
