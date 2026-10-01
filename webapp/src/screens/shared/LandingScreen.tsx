import { useNavigate } from 'react-router-dom';
import { UserAdd } from 'iconsax-react';
import { Button } from '../../components/ui';

function BrandMark({ size = 48 }: { size?: number }) {
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

export default function LandingScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[420px] animate-fadeup">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={72} />
          <h1 className="mt-5 text-display tracking-tight text-textprimary">EventHub</h1>
        </div>

        <div className="mt-7 rounded-lg border border-border bg-surface p-6 shadow-card">
          <p className="whitespace-pre-line text-center text-body text-textmuted">
            {'Book, connect and celebrate together —\nweddings, funerals, corporate and social events.'}
          </p>

          <div className="mt-6 space-y-3">
            <Button
              fullWidth
              size="lg"
              icon={<UserAdd size={18} />}
              onClick={() => navigate('/signup')}
            >
              Get started
            </Button>
            <Button fullWidth size="lg" variant="outline" onClick={() => navigate('/login')}>
              Log in
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
