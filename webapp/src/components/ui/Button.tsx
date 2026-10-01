import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Display';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:brightness-95 active:brightness-90 disabled:bg-neutral disabled:text-white',
  secondary: 'bg-neutralbg text-textprimary hover:bg-border disabled:text-neutral',
  ghost: 'bg-transparent text-primary hover:bg-primary-6 disabled:text-neutral',
  outline: 'bg-surface text-textprimary border border-border hover:border-primary hover:text-primary',
  danger: 'bg-danger text-white hover:brightness-95 disabled:bg-neutral',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-md gap-1.5',
  md: 'h-11 px-4 text-button gap-2',
  lg: 'h-12 px-5 text-button gap-2 rounded-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    icon,
    trailingIcon,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-bold transition-[filter,background-color,border-color,color] duration-200 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={16} className="opacity-90" />
      ) : (
        icon && <span className="shrink-0 [&>svg]:block">{icon}</span>
      )}
      <span className="min-w-0 truncate">{children}</span>
      {trailingIcon && !loading && (
        <span className="shrink-0 [&>svg]:block">{trailingIcon}</span>
      )}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, tone = 'default', className = '', children, type = 'button', ...rest },
  ref,
) {
  const toneClass =
    tone === 'danger'
      ? 'text-danger'
      : active
        ? 'text-primary bg-primary-6'
        : 'text-textprimary hover:bg-primary-6';
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${toneClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export function TextActionButton({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`text-button text-primary transition-opacity duration-200 hover:opacity-80 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
