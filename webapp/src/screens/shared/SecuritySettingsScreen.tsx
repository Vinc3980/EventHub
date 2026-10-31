/**
 * `/settings/security` — password, blocked accounts and account removal
 * (section 3.6). Split out of the old SettingsScreen.
 */
import { useMemo, useState } from 'react';
import { Key, Lock1, Logout, Message, Shield, Trash, UserMinus } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { AuthService, AuthException } from '../../services/authService';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Sheet,
  Skeleton,
} from '../../components/ui';
import { RowButton, RowContent, RowLink, ROW_BASE, SectionCard, SectionHeader } from './settingsKit';

export default function SecuritySettingsScreen() {
  const { uid, user, signOut } = useAuth();
  const authService = useMemo(() => new AuthService(), []);
  const { toast } = useToast();

  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<{
    current: string | null;
    next: string | null;
    confirm: string | null;
  }>({ current: null, next: null, confirm: null });

  async function savePassword() {
    if (!uid) return;
    const { current, next, confirm } = pwForm;
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
      <div className="space-y-4" aria-busy="true" aria-label="Loading security">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const blockedCount = user.blockedUids.length;

  return (
    <div className="space-y-6">
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
        onConfirm={() => {
          setSignOutOpen(false);
          void signOut();
        }}
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
              onChange={(event) => setPwForm((prev) => ({ ...prev, current: event.target.value }))}
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
              onChange={(event) => setPwForm((prev) => ({ ...prev, confirm: event.target.value }))}
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
