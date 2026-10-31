import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth, effectiveRole } from './AuthProvider';
import { FullScreenLoader } from '../components/ui';
import { isPublicRoute } from '../routes/routeMeta';

/**
 * Build the `/login?next=…` target for the current location so the user
 * comes back to the screen that required them (section 3.5).
 */
export function loginPathFor(pathname: string, search = ''): string {
  const next = `${pathname}${search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

/** The `next` query param, validated to stay inside this app (no open redirect). */
export function safeNext(search: string, fallback = '/home'): string {
  const raw = new URLSearchParams(search).get('next');
  if (!raw) return fallback;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  // Only same-origin absolute paths are allowed.
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/login') || value.startsWith('/signup')) return fallback;
  return value;
}

/** Mirrors the mobile auth gate: unauthenticated users land on /login?next=… */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { uid, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!uid) {
    return <Navigate to={loginPathFor(location.pathname, location.search)} replace />;
  }
  return <>{children}</>;
}

/**
 * Route-level role guard. Attendee and organizer are merged into a single
 * `user` role, so only the admin section needs (and allows) a role check.
 */
export function RequireRole({
  role,
  children,
}: {
  role: 'admin';
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) return <Navigate to={loginPathFor(location.pathname, location.search)} replace />;

  if (effectiveRole(user) !== role) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

/**
 * Shared gate for actions that need a session without owning a route
 * (follow, save, report, waitlist, join tier, …). Call it during render,
 * then branch on the result: when it returns false the user has been sent
 * to /login?next=… and the action must not run.
 */
export function useRequireAuth(): boolean {
  const { uid, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authed = !loading && uid !== null;
  useEffect(() => {
    if (!loading && !uid) {
      navigate(loginPathFor(location.pathname, location.search), { replace: true });
    }
  }, [loading, uid, navigate, location.pathname, location.search]);
  return authed;
}

/** Signed-in visitors skip auth screens (same as the mobile redirect). */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { uid, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (uid) {
    const next = safeNext(location.search, '');
    if (next !== '') return <Navigate to={next} replace />;
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from !== '/login' && from !== '/signup') return <Navigate to={from} replace />;
    const role = effectiveRole(user);
    return <Navigate to={role === 'admin' ? '/admin' : '/home'} replace />;
  }
  return <>{children}</>;
}

/**
 * Renders `children` for public routes and gates everything else behind a
 * session. Used by the AppShell-free public routes in App.tsx.
 */
export function RequireAuthIfPrivate({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (isPublicRoute(location.pathname)) return <>{children}</>;
  return <RequireAuth>{children}</RequireAuth>;
}

/** Scroll restoration + focus reset for route changes. */
export function useRouteEffects(): void {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);
}
