import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth, effectiveRole } from './AuthProvider';
import { FullScreenLoader } from '../components/ui';

/** Mirrors the mobile auth gate: unauthenticated users land on /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { uid, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!uid) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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

  if (!uidOrNull(user)) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (effectiveRole(user) !== role) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function uidOrNull(user: { uid: string } | null): string | null {
  return user ? user.uid : null;
}

/** Signed-in visitors skip auth screens (same as the mobile redirect). */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { uid, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (uid) {
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from !== '/login' && from !== '/signup') return <Navigate to={from} replace />;
    const role = effectiveRole(user);
    return <Navigate to={role === 'admin' ? '/admin' : '/home'} replace />;
  }
  return <>{children}</>;
}

/** Scroll restoration + focus reset for route changes. */
export function useRouteEffects(): void {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);
}
