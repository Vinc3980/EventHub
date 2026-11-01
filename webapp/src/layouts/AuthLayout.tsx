/**
 * Shared layout for /login and /signup screens.
 * Mounts the dramatic auth photo backdrop with glassmorphic frosted card
 * and unified BrandMark header.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageBackdrop } from '../components/ui';

function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl font-extrabold text-white shadow-card"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        backgroundImage:
          'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
      }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Dramatic auth backdrop with rich contrast overlay */}
      <PageBackdrop variant="auth" mode="rich" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-[440px] rounded-[24px] border border-border/80 bg-surface/95 p-6 shadow-popover backdrop-blur-md sm:p-8">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2.5 transition-transform duration-200 hover:scale-[1.02]"
          >
            <BrandMark size={44} />
            <span className="text-display font-extrabold tracking-tight text-textprimary">
              EventHub
            </span>
          </Link>
          <h1 className="text-title font-bold text-textprimary">{title}</h1>
          {subtitle && <p className="mt-1 text-body text-textmuted">{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  );
}
