/**
 * Application shell (section 3.3). The left navigation is gone: a horizontal top
 * nav carries the desktop navigation, a compact bar + drawer + bottom tabs
 * carry phone/tablet, and a footer closes every default-layout page.
 *
 * Three layouts, selected from route metadata:
 *  - `default` — top nav + PageHeader + footer + bottom tabs;
 *  - `focused` — checkout-style: slim back header only (no footer, no tabs);
 *  - `bare`    — full-height tool (chat thread, QR scanner): slim back header.
 */
import { Suspense, useCallback, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'iconsax-react';
import { useAuth } from '../app/AuthProvider';
import { OfflineBanner, PageBackdrop, Skeleton } from '../components/ui';
import { EventPickerSheet } from '../components/EventPickerSheet';
import { EventToolProvider } from '../components/EventToolContext';
import { useOnline } from '../hooks/useBreakpoint';
import { backdropFor, layoutFor, routeMeta } from '../routes/routeMeta';
import { Footer } from './Footer';
import { PageHeader } from './PageHeader';
import { NavDrawer } from './nav/NavDrawer';
import { BottomTabs, CompactTopBar } from './nav/MobileChrome';
import { TopNav } from './nav/TopNav';

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundImage:
          'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
      }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

const FALLBACK = (
  <div className="space-y-4" aria-busy="true" aria-label="Loading">
    <Skeleton className="h-8 w-52" />
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-40 w-full" />
  </div>
);

export function AppShell() {
  const { uid } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toolTemplate, setToolTemplate] = useState<string | null>(null);
  const layout = layoutFor(location.pathname);
  const backdrop = backdropFor(location.pathname);
  const meta = routeMeta(location.pathname);

  // Event-scoped nav entries hand over a `/organizer/events/:id/<tool>`
  // template — the picker sheet asks which event, then navigates.
  const onEventTool = useCallback((template: string) => {
    setToolTemplate(template);
  }, []);

  // ---- focused / bare: slim back header, no footer, no bottom tabs -------
  if (layout !== 'default') {
    return (
      <div
        className={`flex min-h-screen flex-col bg-background ${layout === 'bare' ? 'h-screen' : ''}`}
        data-backdrop={backdrop}
      >
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background-tinted px-3 backdrop-blur">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => window.history.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-textprimary transition-colors duration-200 hover:bg-primary-6"
          >
            <ArrowLeft size={22} />
          </button>
          <Link to={uid ? '/home' : '/'} className="flex min-w-0 items-center gap-2">
            <BrandMark size={28} />
            <span className="min-w-0 truncate text-subtitle font-extrabold tracking-tight text-textprimary">
              {meta.title}
            </span>
          </Link>
        </header>
        {!online && <OfflineBanner />}
        <main className={`min-w-0 flex-1 px-4 pb-8 pt-4 ${layout === 'bare' ? 'overflow-hidden' : ''}`}>
          <div className="mx-auto w-full max-w-[900px] min-w-0">
            <Suspense fallback={FALLBACK}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    );
  }

  // ---- default: top nav + page header + footer + bottom tabs -------------
  return (
    <EventToolProvider value={{ openEventTool: onEventTool }}>
      <div className="relative flex min-h-screen flex-col bg-transparent" data-backdrop={backdrop}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-base focus:bg-primary focus:px-4 focus:py-2 focus:font-bold focus:text-white focus:shadow-popover"
        >
          Skip to content
        </a>
        <PageBackdrop variant="app" mode={backdrop} />
        <TopNav onEventTool={onEventTool} />
        <CompactTopBar onOpenMenu={() => setDrawerOpen(true)} />
        {!online && <OfflineBanner />}

        <main id="main-content" className="page-container min-w-0 flex-1 pb-24 pt-4 tablet:pb-10">
          <PageHeader />
          <Suspense fallback={FALLBACK}>
            <Outlet />
          </Suspense>
        </main>

        <Footer uid={uid} />
        <BottomTabs onOpenMenu={() => setDrawerOpen(true)} />
        <NavDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onEventTool={onEventTool}
        />
        <EventPickerSheet template={toolTemplate} onClose={() => setToolTemplate(null)} />
      </div>
    </EventToolProvider>
  );
}
