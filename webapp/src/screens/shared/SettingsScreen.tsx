import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight3,
  Call,
  Camera,
  Card,
  Key,
  Lock1,
  Logout,
  Message,
  NotificationBing,
  Shield,
  Sms,
  TickCircle,
  Trash,
  User,
  UserMinus,
  Wallet,
  Wallet2,
} from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { formatDateLong } from '../../lib/format';
import { AuthService, AuthException } from '../../services/authService';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Sheet,
  Skeleton,
  Textarea,
  Toggle,
} from '../../components/ui';

type NotifKey =
  | 'reminders'
  | 'messageNotifsEnabled'
  | 'followerNotifsEnabled'
  | 'promoNotifsEnabled';

const NOTIFICATIONS: { key: NotifKey; label: string; description: string }[] = [
  {
    key: 'reminders',
    label: 'Event reminders',
    description: "Get notified 24 hours before an event you're attending.",
  },
  {
    key: 'messageNotifsEnabled',
    label: 'New messages',
    description: 'When someone sends you a chat message.',
  },
  {
    key: 'followerNotifsEnabled',
    label: 'New followers',
    description: 'When someone follows your profile.',
  },
  {
    key: 'promoNotifsEnabled',
    label: 'Promotions & offers',
    description: 'Boosted events, discounts, and platform news.',
  },
];

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

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {children}
    </div>
  );
}

function RowContent({
  icon,
  title,
  subtitle,
  trailing,
  muted,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  muted?: boolean;
}) {
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-body font-semibold ${
            muted ? 'text-textmuted' : 'text-textprimary'
          }`}
        >
          {title}
        </span>
        {subtitle !== undefined && (
          <span className="mt-0.5 block truncate text-caption text-textmuted">{subtitle}</span>
        )}
      </span>
      {trailing}
    </>
  );
}

const ROW_BASE = 'flex w-full items-center gap-3 px-4 py-3 text-left';
const ROW_CLASS = `${ROW_BASE} transition-colors duration-200 hover:bg-primary-6`;

function RowLink({ to, icon, title, subtitle }: { to: string; icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <Link to={to} className={ROW_CLASS}>
      <RowContent
        icon={icon}
        title={title}
        subtitle={subtitle}
        trailing={<ArrowRight3 size={16} className="shrink-0 text-textmuted" />}
      />
    </Link>
  );
}

function RowButton({
  onClick,
  icon,
  title,
  subtitle,
  trailing,
}: {
  onClick: () => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      <RowContent
        icon={icon}
        title={title}
        subtitle={subtitle}
        trailing={
          trailing ?? <ArrowRight3 size={16} className="shrink-0 text-textmuted" />
        }
      />
    </button>
  );
}

export default function SettingsScreen() {
  const { uid, user, signOut } = useAuth();
  const authService = useMemo(() => new AuthService(), []);
  const { toast } = useToast();
  const navigate = useNavigate();

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<{
    current: string | null;
    next: string | null;
    confirm: string | null;
  }>({ current: null, next: null, confirm: null });

  async function saveProfile() {
    if (!uid) return;
    setSavingProfile(true);
    await authService.updateProfile({
      uid,
      name: (nameRef.current?.value ?? '').trim(),
      phone: (phoneRef.current?.value ?? '').trim(),
      bio: (bioRef.current?.value ?? '').trim(),
    });
    setSavingProfile(false);
    toast('Profile updated.');
  }

  function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !uid) return;
    const reader = new FileReader();
    reader.onload = () => {
      void authService.updateProfile({ uid, avatarUrl: String(reader.result ?? '') });
    };
    reader.readAsDataURL(file);
  }

  async function confirmSignOut() {
    setSignOutOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  async function setNotification(key: NotifKey, value: boolean) {
    if (!uid) return;
    if (key === 'reminders') {
      await authService.setRemindersEnabled(uid, value);
    } else {
      await authService.setNotificationPref(uid, key, value);
    }
  }

  function notificationValue(key: NotifKey): boolean {
    if (!user) return false;
    if (key === 'reminders') return user.remindersEnabled;
    if (key === 'messageNotifsEnabled') return user.messageNotifsEnabled;
    if (key === 'followerNotifsEnabled') return user.followerNotifsEnabled;
    return user.promoNotifsEnabled;
  }

  async function savePassword() {
    if (!uid) return;
    const current = pwForm.current;
    const next = pwForm.next;
    const confirm = pwForm.confirm;

    const currentError = current.length === 0 ? 'Enter your current password.' : null;
    const nextError =
      next.length === 0
        ? 'Enter a new password.'
        : next.length < 6
          ? 'Use at least 6 characters.'
          : null;
    const confirmError = confirm !== next ? "Passwords don't match." : null;

    if (currentError || nextError || confirmError) {
      setPwErrors({ current: currentError, next: nextError, confirm: confirmError });
      return;
    }

    setPwSaving(true);
    try {
      await authService.changePassword({
        uid,
        currentPassword: current,
        newPassword: next,
      });
    } catch (error) {
      setPwSaving(false);
      if (error instanceof AuthException) {
        setPwErrors({
          current: error.code === 'wrong-password' ? error.message : null,
          next: error.code === 'wrong-password' ? null : error.message,
          confirm: null,
        });
      } else {
        setPwErrors({
          current: 'Something went wrong. Try again.',
          next: null,
          confirm: null,
        });
      }
      return;
    }

    setPwSaving(false);
    setPwOpen(false);
    setPwForm({ current: '', next: '', confirm: '' });
    setPwErrors({ current: null, next: null, confirm: null });
    toast('Password updated.');
  }

  if (!user || !uid) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading settings">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const blockedCount = user.blockedUids.length;
  const momoSubtitle =
    user.savedMomoNumber.length > 0
      ? `${user.savedMomoNumber} · ${user.savedMomoNetwork}`
      : 'Save your MoMo wallet';

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader icon={<User size={16} />} title="Account" />
        <SectionCard>
          <div className="flex flex-col items-center px-4 pb-3 pt-5">
            <Avatar name={user.name || 'Guest'} url={user.avatarUrl} size={72} ring />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="mt-2.5 inline-flex items-center gap-1.5 text-caption font-bold text-primary transition-opacity duration-200 hover:opacity-80"
            >
              <Camera size={16} />
              Change photo
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickPhoto}
              aria-label="Change photo"
            />
          </div>

          <div className="divide-y divide-border border-t border-border">
            <div className="px-4 py-3">
              <Field label="Name">
                <Input ref={nameRef} defaultValue={user.name} autoComplete="name" leading={<User size={18} />} />
              </Field>
            </div>
            <div className="px-4 py-3">
              <Field label="Phone number">
                <Input
                  ref={phoneRef}
                  defaultValue={user.phone}
                  type="tel"
                  autoComplete="tel"
                  leading={<Call size={18} />}
                />
              </Field>
            </div>
            <div className="px-4 py-3">
              <Field label="Bio">
                <Textarea ref={bioRef} defaultValue={user.bio} rows={3} maxLength={200} />
              </Field>
            </div>
            <div className="px-4 py-3">
              <Field label="Email" hint="Contact support to change your email.">
                <Input
                  value={user.email}
                  readOnly
                  disabled
                  placeholder="No email on file"
                  leading={<Sms size={18} />}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-body text-textmuted">Member since</span>
              <span className="text-body font-semibold text-textprimary">
                {formatDateLong(user.createdAt)}
              </span>
            </div>
          </div>
        </SectionCard>

        <div className="mt-3.5">
          <Button fullWidth loading={savingProfile} icon={<TickCircle size={18} />} onClick={() => void saveProfile()}>
            Save changes
          </Button>
        </div>
      </section>

      <section>
        <SectionHeader icon={<NotificationBing size={16} />} title="Notifications" />
        <SectionCard>
          <div className="divide-y divide-border">
            {NOTIFICATIONS.map((row) => (
              <div key={row.key} className="px-4">
                <Toggle
                  label={row.label}
                  description={row.description}
                  checked={notificationValue(row.key)}
                  onChange={(value) => void setNotification(row.key, value)}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionHeader icon={<Card size={16} />} title="Payments" />
        <SectionCard>
          <div className="divide-y divide-border">
            <RowLink
              to="/organizer/payouts"
              icon={<Wallet2 size={17} />}
              title="Payout settings"
              subtitle="Bank and MoMo payout details"
            />
            <RowLink
              to="/settings/payment-methods"
              icon={<Wallet size={17} />}
              title="Payment methods"
              subtitle={momoSubtitle}
            />
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionHeader icon={<Shield size={16} />} title="Security & privacy" />
        <SectionCard>
          <div className="divide-y divide-border">
            <RowButton
              onClick={() => setPwOpen(true)}
              icon={<Key size={17} />}
              title="Change password"
              subtitle="Update your sign-in password"
            />
            <RowLink
              to="/settings/blocked"
              icon={<UserMinus size={17} />}
              title="Blocked accounts"
              subtitle={blockedCount === 0 ? 'None' : `${blockedCount} blocked`}
            />
            <div className={ROW_BASE}>
              <RowContent
                icon={<Message size={17} />}
                title="Who can message me"
                subtitle="Everyone"
                muted
                trailing={
                  <span className="shrink-0 rounded-pill bg-neutralbg px-2.5 py-1 text-[10px] font-bold tracking-wide text-textmuted">
                    Soon
                  </span>
                }
              />
            </div>
          </div>
        </SectionCard>
      </section>

      <div className="space-y-1 pb-2">
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex w-full items-center gap-3 rounded-base px-2 py-3.5 text-left transition-colors duration-200 hover:bg-dangerbg"
        >
          <Logout size={20} className="shrink-0 text-danger" />
          <span className="min-w-0 truncate text-button text-danger">Sign out</span>
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex w-full items-center gap-3 rounded-base px-2 py-3.5 text-left transition-colors duration-200 hover:bg-dangerbg"
        >
          <Trash size={20} className="shrink-0 text-danger" />
          <span className="min-w-0 truncate text-button text-danger">Delete account</span>
        </button>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out"
        body="You will need to sign in again with your email and password to access your account."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        danger
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => void confirmSignOut()}
      />

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account"
        variant="center"
        labelledBy="delete-account-title"
        footer={<Button onClick={() => setDeleteOpen(false)}>OK</Button>}
      >
        <p className="text-body text-textmuted">
          Account deletion is not yet implemented. This feature will be available in a future
          update.
        </p>
      </Sheet>

      <Sheet
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        labelledBy="change-password-title"
      >
        <p className="text-caption text-textmuted">
          Confirm your current password, then choose a new one.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="Current password" error={pwErrors.current}>
            <Input
              type="password"
              autoComplete="current-password"
              leading={<Key size={18} />}
              value={pwForm.current}
              invalid={Boolean(pwErrors.current)}
              onChange={(event) =>
                setPwForm((prev) => ({ ...prev, current: event.target.value }))
              }
            />
          </Field>
          <Field label="New password" error={pwErrors.next}>
            <Input
              type="password"
              autoComplete="new-password"
              leading={<Lock1 size={18} />}
              value={pwForm.next}
              invalid={Boolean(pwErrors.next)}
              onChange={(event) => setPwForm((prev) => ({ ...prev, next: event.target.value }))}
            />
          </Field>
          <Field label="Confirm new password" error={pwErrors.confirm}>
            <Input
              type="password"
              autoComplete="new-password"
              leading={<Lock1 size={18} />}
              value={pwForm.confirm}
              invalid={Boolean(pwErrors.confirm)}
              onChange={(event) =>
                setPwForm((prev) => ({ ...prev, confirm: event.target.value }))
              }
            />
          </Field>
        </div>

        <Button fullWidth className="mt-5" loading={pwSaving} onClick={() => void savePassword()}>
          Update password
        </Button>
      </Sheet>
    </div>
  );
}
