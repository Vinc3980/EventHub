import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock1, Sms } from 'iconsax-react';
import { Button, Field, Input } from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { safeNext } from '../../app/guards';
import { AuthService } from '../../services/authService';
import { AuthLayout } from '../../layouts/AuthLayout';

interface FieldErrors {
  email: string | null;
  password: string | null;
}

const DEMO_ACCOUNTS = [
  { role: 'Attendee', email: 'nana@eventhub.app' },
  { role: 'Organizer', email: 'kwame@eventhub.app' },
  { role: 'Admin', email: 'admin@eventhub.app' },
] as const;

const DEMO_PASSWORD = 'demo123';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const authService = useMemo(() => new AuthService(), []);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ email: null, password: null });
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fillAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setFieldErrors({ email: null, password: null });
    setAuthError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      email: email.trim().length === 0 ? 'Enter your email.' : null,
      password: password.length === 0 ? 'Enter your password.' : null,
    };
    setFieldErrors(nextErrors);
    setAuthError(null);
    if (nextErrors.email || nextErrors.password) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      const nextUid = await authService.currentUid();
      const profile = nextUid ? await authService.fetchUserProfile(nextUid) : null;
      const roles = (profile?.roles as string[] | undefined) ?? [];
      const fallback = roles.includes('admin') ? '/admin' : '/home';
      // Return to the page that required a session (section 3.5).
      navigate(safeNext(location.search, fallback));
    } catch (error) {
      setAuthError(AuthService.friendlyMessage(error));
      setLoading(false);
    }
  }

  const passwordError = fieldErrors.password ?? authError;

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue.">
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Email" required error={fieldErrors.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            leading={<Sms size={18} />}
            value={email}
            invalid={Boolean(fieldErrors.email)}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Password" required error={passwordError}>
          <Input
            type="password"
            autoComplete="current-password"
            leading={<Lock1 size={18} />}
            value={password}
            invalid={Boolean(passwordError)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Log in
        </Button>
      </form>

      <div className="mt-5 rounded-md border border-border bg-neutralbg p-3">
        <p className="text-caption font-bold text-textprimary">Demo account</p>
        <p className="mt-0.5 text-caption text-textmuted">Password: {DEMO_PASSWORD}</p>
        <ul className="mt-2 space-y-1">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fillAccount(account.email)}
                aria-label={`Fill demo account for ${account.role}`}
                className="flex w-full items-center gap-2 rounded-sm bg-surface px-2.5 py-2 text-left transition-colors duration-200 hover:bg-primary-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-semibold text-textprimary">
                    {account.role}
                  </span>
                  <span className="block truncate text-caption text-textmuted">
                    {account.email}
                  </span>
                </span>
                <span className="shrink-0 text-caption font-bold text-primary">Fill</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-center text-caption text-textmuted">
        New to EventHub?{' '}
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="font-bold text-primary transition-opacity duration-200 hover:opacity-80"
        >
          Create account
        </button>
      </p>
    </AuthLayout>
  );
}
