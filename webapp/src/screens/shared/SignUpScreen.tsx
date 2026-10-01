import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock1, Sms } from 'iconsax-react';
import { Button, Field, Input } from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { AuthService } from '../../services/authService';

interface FieldErrors {
  email: string | null;
  password: string | null;
}

function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundImage:
          'linear-gradient(135deg, var(--eh-primary) 0%, var(--eh-deep-violet) 100%)',
      }}
      aria-hidden="true"
    >
      EH
    </span>
  );
}

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

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
      navigate('/home');
    } catch (error) {
      setAuthError(AuthService.friendlyMessage(error));
      setLoading(false);
    }
  }

  const passwordError = fieldErrors.password ?? authError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[420px] animate-fadeup">
        <div className="flex flex-col items-center text-center">
          <BrandMark />
          <span className="mt-3 text-title tracking-tight text-textprimary">EventHub</span>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h1 className="text-title text-textprimary">Join EventHub</h1>
          <p className="mt-1.5 text-body text-textmuted">
            Create your account to start exploring events.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
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
        </div>

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
      </div>
    </div>
  );
}
