import { useMemo, useState, type ReactNode } from 'react';
import { Call, Wallet } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { AuthService } from '../../services/authService';
import { MOMO_NETWORKS } from '../../lib/constants';
import { maskPhone } from '../../lib/format';
import { Button, Chip, Field, Input, Sheet } from '../../components/ui';

function formatMomo(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
        {icon}
      </span>
      <h2 className="min-w-0 truncate text-section font-bold text-textmuted">{title}</h2>
    </div>
  );
}

export default function PaymentMethodsScreen() {
  const { uid, user } = useAuth();
  const authService = useMemo(() => new AuthService(), []);
  const { toast } = useToast();

  const savedNumber = user?.savedMomoNumber ?? '';
  const savedNetwork = user?.savedMomoNetwork ?? '';

  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [network, setNetwork] = useState<string>(MOMO_NETWORKS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEditor() {
    setNumber(savedNumber ? formatMomo(savedNumber) : '');
    setNetwork(
      MOMO_NETWORKS.includes(savedNetwork as (typeof MOMO_NETWORKS)[number])
        ? savedNetwork
        : MOMO_NETWORKS[0],
    );
    setError(null);
    setOpen(true);
  }

  async function save() {
    const digits = number.replace(/\D/g, '');
    if (digits.length !== 10 || !digits.startsWith('0')) {
      setError('Enter a valid 10-digit MoMo number, e.g. 024 123 4567.');
      return;
    }
    if (!uid) return;
    setError(null);
    setSaving(true);
    await authService.setSavedMomo(uid, { number: digits, network });
    setSaving(false);
    setOpen(false);
    toast('Payment method saved.');
  }

  return (
    <div className="space-y-3">
      <SectionHeader icon={<Wallet size={16} />} title="MoMo wallet" />

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
            <Wallet size={17} />
          </span>

          {savedNumber.length > 0 ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-subtitle text-textprimary">
                {maskPhone(savedNumber)}
              </span>
              <span className="mt-0.5 block truncate text-caption text-textmuted">
                {savedNetwork}
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-body text-textmuted">
              Save your MoMo wallet
            </span>
          )}

        </div>
      </div>

      <Button fullWidth onClick={openEditor}>
        {savedNumber.length > 0 ? 'Edit MoMo number' : 'Add MoMo number'}
      </Button>

      <p className="px-1 text-caption text-textmuted">
        Saved for checkout once MoMo payments go live. This stage stores the number only —
        payment is still simulated locally.
      </p>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="MoMo wallet"
        labelledBy="momo-wallet-title"
        footer={
          <Button loading={saving} onClick={() => void save()}>
            Save
          </Button>
        }
      >
        <Field label="MoMo number" error={error}>
          <Input
            inputMode="numeric"
            autoComplete="tel"
            placeholder="024 123 4567"
            leading={<Call size={18} />}
            value={number}
            invalid={Boolean(error)}
            onChange={(event) => {
              setNumber(formatMomo(event.target.value));
              setError(null);
            }}
          />
        </Field>

        <p className="mt-4 text-caption font-bold text-textmuted">Network</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOMO_NETWORKS.map((option) => (
            <Chip key={option} selected={network === option} onClick={() => setNetwork(option)}>
              {option}
            </Chip>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
