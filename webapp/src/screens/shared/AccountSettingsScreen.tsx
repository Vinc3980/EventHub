/**
 * `/settings/account` — profile details (section 3.6). Split out of the old
 * SettingsScreen; keeps the "Member since" row.
 */
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight3, Call, Camera, Sms, TickCircle, User, UserMinus } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { formatDateLong } from '../../lib/format';
import { AuthService } from '../../services/authService';
import { Avatar, Button, Field, Input, Skeleton, Textarea } from '../../components/ui';
import { RowContent, ROW_BASE, SectionCard, SectionHeader } from './settingsKit';

export default function AccountSettingsScreen() {
  const { uid, user } = useAuth();
  const authService = useMemo(() => new AuthService(), []);
  const { toast } = useToast();

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (!uid) return;
    setSaving(true);
    await authService.updateProfile({
      uid,
      name: (nameRef.current?.value ?? '').trim(),
      phone: (phoneRef.current?.value ?? '').trim(),
      bio: (bioRef.current?.value ?? '').trim(),
    });
    setSaving(false);
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

  if (!user || !uid) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading account">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader icon={<User size={16} />} title="Profile" />
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
          <Button
            fullWidth
            loading={saving}
            icon={<TickCircle size={18} />}
            onClick={() => void saveProfile()}
          >
            Save changes
          </Button>
        </div>
      </section>

      <section>
        <SectionHeader icon={<UserMinus size={16} />} title="More" />
        <SectionCard>
          <Link to="/settings/blocked" className={`${ROW_BASE} transition-colors duration-200 hover:bg-primary-6`}>
            <RowContent
              icon={<UserMinus size={17} />}
              title="Blocked accounts"
              subtitle={`${user.blockedUids.length} blocked`}
              trailing={<ArrowRight3 size={16} className="shrink-0 text-textmuted" />}
            />
          </Link>
        </SectionCard>
      </section>
    </div>
  );
}
