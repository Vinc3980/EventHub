import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link2, Send2, TickCircle } from 'iconsax-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { COLORS } from '../../theme/tokens';
import { EventService, followService, invitationService, notificationService } from '../../services';
import { Button, ErrorState, Field, Skeleton, Textarea } from '../../components/ui';
import { OrgHeading, OrgRows, useServiceLive } from '../../components/OrgKit';

const eventService = new EventService();

function ChannelOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3.5 rounded-base border px-4 py-3.5 text-left transition-colors duration-200 ${
        checked ? 'border-textprimary bg-primary-6' : 'border-border bg-surface hover:border-primary'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
          checked ? 'border-textprimary bg-textprimary' : 'border-border'
        }`}
      >
        {checked && <TickCircle size={16} className="text-white" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-body font-medium text-textprimary">{label}</span>
    </button>
  );
}

export default function SendInvitationsScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const { uid } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [retry, setRetry] = useState(0);
  const [inApp, setInApp] = useState(true);
  const [sms, setSms] = useState(true);
  const [link, setLink] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTouched, setMessageTouched] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);

  const rsvpLink = invitationService.generateRsvpLink(eventId);

  const { data: event, error: eventError } = useLive(async () => {
    await db.events.toArray();
    return eventService.getEvent(eventId);
  }, [eventId, retry]);

  const { data: followers, loading: followersLoading } = useServiceLive(
    followService.followerProfiles(uid ?? ''),
    [uid, retry],
    [db.follows, db.users],
  );
  const list = followers ?? [];
  const recipients = picked ?? list.map((follower) => follower.uid);
  const defaultMessage = event ? `You're invited to ${event.title}.` : '';
  const messageValue = messageTouched ? message : defaultMessage;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(rsvpLink);
      toast('Copied.', 'success');
    } catch {
      toast('Could not copy link.', 'error');
    }
  }

  function toggleRecipient(recipientId: string) {
    const next = recipients.includes(recipientId)
      ? recipients.filter((value) => value !== recipientId)
      : [...recipients, recipientId];
    setPicked(next);
  }

  async function send() {
    if (!inApp && !sms && !link) {
      toast('Select at least one channel.', 'error');
      return;
    }
    setSending(true);
    try {
      if (inApp) {
        await invitationService.notifyFollowers(eventId);
        const body = messageValue.trim();
        if (body !== '') {
          for (const recipientId of recipients) {
            await notificationService.saveLocal({
              uid: recipientId,
              title: event?.title ?? 'Event',
              body,
              type: 'event_reminder',
              targetId: eventId,
            });
          }
        }
      }
      if (sms) {
        await invitationService.sendBulkSmsInvites({ eventId, phoneNumbers: [] });
      }
      toast('Invitations sent', 'success');
      navigate('/organizer');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`Invitation failed: ${detail}`, 'error');
      setSending(false);
    }
  }

  if (eventError) {
    return <ErrorState title="Could not load event." onRetry={() => setRetry((n) => n + 1)} />;
  }

  return (
    <div className="space-y-5 animate-fadeup">
      <h1 className="text-display text-textprimary">Send invitations</h1>

      <div className="space-y-2.5" role="group" aria-label="Invitation channels">
        <ChannelOption label="In-app feed & push" checked={inApp} onChange={setInApp} />
        <ChannelOption label="Bulk SMS to guest list" checked={sms} onChange={setSms} />
        <ChannelOption label="Shareable link / QR poster" checked={link} onChange={setLink} />
      </div>

      {link && (
        <section className="flex flex-col items-center gap-3 rounded-base border border-border bg-surface p-4 shadow-card">
          <div className="rounded-base bg-white p-3">
            <QRCodeSVG value={rsvpLink} size={140} bgColor={COLORS.white} fgColor={COLORS.textPrimary} />
          </div>
          <p className="break-all text-center text-caption text-textmuted">{rsvpLink}</p>
          <Button variant="outline" size="sm" icon={<Link2 size={16} />} onClick={() => void copyLink()}>
            Copy link
          </Button>
        </section>
      )}

      {inApp && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-subtitle text-textprimary">Recipients</h2>
            <button
              type="button"
              onClick={() => setPicked(recipients.length === list.length ? [] : list.map((f) => f.uid))}
              className="shrink-0 text-button text-primary transition-opacity duration-200 hover:opacity-80"
            >
              {recipients.length === list.length ? 'Clear' : 'Select all'}
            </button>
          </div>
          {followersLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading recipients">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : list.length === 0 ? (
            <p className="rounded-base border border-border bg-surface px-4 py-3 text-body text-textmuted">
              No followers yet. Invitations go out as soon as people follow you.
            </p>
          ) : (
            <OrgRows>
              {list.map((follower) => {
                const checked = recipients.includes(follower.uid);
                return (
                  <label
                    key={follower.uid}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-primary-6"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRecipient(follower.uid)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-textprimary">{follower.name}</span>
                    </span>
                  </label>
                );
              })}
            </OrgRows>
          )}
        </section>
      )}

      {inApp && (
        <section className="rounded-base border border-border bg-surface p-4 shadow-card">
          <OrgHeading title="Message" />
          <Field label="Invitation note" hint="Delivered in-app to the recipients you selected.">
            <Textarea
              value={messageValue}
              onChange={(event_) => {
                setMessageTouched(true);
                setMessage(event_.target.value);
              }}
              placeholder="Write a short invitation..."
              aria-label="Invitation note"
              className="min-h-[96px]"
            />
          </Field>
        </section>
      )}

      <Button fullWidth icon={<Send2 size={16} />} onClick={() => void send()} loading={sending} disabled={sending}>
        Send invitations
      </Button>
    </div>
  );
}
