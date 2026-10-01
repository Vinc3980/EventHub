import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { liveQuery } from 'dexie';
import { AuthService, AuthException } from '../services/authService';
import { db, setSessionUid } from '../db/db';
import { User } from '../models';

interface AuthContextValue {
  uid: string | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  completeProfile: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authService = useMemo(() => new AuthService(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const sub = authService.authStateChanges.subscribe({
      next: (next) => {
        if (!active) return;
        setUid(next);
        if (!next) {
          setUser(null);
          setLoading(false);
        }
      },
      error: () => {
        if (active) setLoading(false);
      },
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [authService]);

  useEffect(() => {
    if (!uid) return undefined;
    let active = true;
    const sub = liveQuery(async () => {
      const row = await db.users.get(uid);
      return row ? User.fromMap(uid, row) : null;
    }).subscribe({
      next: (next) => {
        if (!active) return;
        setUser(next as User | null);
        setLoading(false);
      },
      error: () => {
        if (active) setLoading(false);
      },
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [uid]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await authService.signInWithEmail({ email, password });
    },
    [authService],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      await authService.signUpWithEmail({ email, password });
    },
    [authService],
  );

  const completeProfile = useCallback(
    async (name: string) => {
      const current = uid ?? (await authService.currentUid());
      if (!current) throw new AuthException('no-session', 'Please sign in again.');
      await authService.completeProfile({ uid: current, name, roles: ['user'] });
    },
    [authService, uid],
  );

  const signOut = useCallback(async () => {
    await setSessionUid(null);
    setUid(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ uid, user, loading, signIn, signUp, completeProfile, signOut }),
    [uid, user, loading, signIn, signUp, completeProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Effective role: `admin` for platform admins, `user` for every other account. */
export function effectiveRole(user: User | null): 'admin' | 'user' {
  if (!user) return 'user';
  if (user.roles.includes('admin')) return 'admin';
  return 'user';
}
