import { useState, type FormEvent } from 'react';
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

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ email: null, password: null });
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    const nextErrors: FieldErrors = {
      email:
        cleanEmail.length === 0
          ? 'Enter your email.'
          : !cleanEmail.includes('@')
            ? 'Enter a valid email.'
            : null,
      password: password.length < 6 ? 'Password must be at least 6 characters.' : null,
    };
    setFieldErrors(nextErrors);
    setAuthError(null);
    if (nextErrors.email || nextErrors.password) return;

    setLoading(true);
    try {
      await signUp(cleanEmail, password);
      navigate(safeNext(location.search, '/home'));
    } catch (error) {
      setAuthError(AuthService.friendlyMessage(error));
      setLoading(false);
    }
  }

  const passwordError = fieldErrors.password ?? authError;

  return (
    <AuthLayout
      title="Join EventHub"
      subtitle="Create your account to start exploring events."
    >
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
            autoComplete="new-password"
            leading={<Lock1 size={18} />}
            value={password}
            invalid={Boolean(passwordError)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-caption text-textmuted">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="font-bold text-primary transition-opacity duration-200 hover:opacity-80"
        >
          Log in
        </button>
      </p>
    </AuthLayout>
  );
}
