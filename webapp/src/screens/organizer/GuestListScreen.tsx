import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Add, CloseCircle, DocumentDownload, Profile2User, Send2 } from 'iconsax-react';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { useLive } from '../../db/live';
import { GuestListEntry } from '../../models';
import { guestListService } from '../../services';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  SearchField,
  Skeleton,
} from '../../components/ui';
import { OrgHeading, useServiceLive } from '../../components/OrgKit';

export default function GuestListScreen() {
  const { id } = useParams<{ id: string }>();
  const eventId = id ?? '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [retry, setRetry] = useState(0);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmSkip, setConfirmSkip] = useState(false);

  const { data: entries, loading, error } = useServiceLive(
    guestListService.guestListForEvent(eventId),
    [eventId, retry],
    [db.guestList],
  );
  const list = entries ?? [];

  const { data: invited } = useLive(async () => {
    const rows = await db.invitedGuests.toArray();
    return rows
      .filter((row) => String(row['eventId']) === eventId)
      .map((row) => ({
        id: String(row['id'] ?? ''),
        name: String(row['name'] ?? ''),
        status: String(row['status'] ?? 'invited'),
      }));
  }, [eventId, retry]);

  const trimmedQuery = query.trim().toLowerCase();
  const visible = trimmedQuery === ''
    ? list
    : list.filter((entry) =>
        [entry.fullName, entry.organization, entry.phone].some((value) =>
          value.toLowerCase().includes(trimmedQuery),
        ),
      );
  const visibleInvited = trimmedQuery === ''
    ? (invited ?? [])
    : (invited ?? []).filter((row) => row.name.toLowerCase().includes(trimmedQuery));

  async function addContact() {
    const trimmedName = name.trim();
    if (trimmedName === '') {
      toast('Enter a name.', 'error');
      return;
    }
    const guests = Number.parseInt(guestCount.trim(), 10);
    setAdding(true);
    try {
      const entry = new GuestListEntry({ id: '', regId: '', eventId, fullName: trimmedName, createdAt: new Date() });
      entry.organization = organization.trim();
      entry.phone = phone.trim();
      entry.invitedGuestCount = Number.isFinite(guests) && guests > 0 ? guests : 0;
      await guestListService.addContact(entry);
      setName('');
      setOrganization('');
      setPhone('');
      setGuestCount('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not add contact: ${message}`, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function removeContact(entry: GuestListEntry) {
    try {
      await guestListService.removeContact(entry.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Could not remove contact: ${message}`, 'error');
    }
  }

  function continueToInvites() {
    if (list.length > 0) {
      navigate(`/organizer/events/${eventId}/invite`);
      return;
    }
    setConfirmSkip(true);
  }

  if (error) {
    return <ErrorState title="Could not load guests." onRetry={() => setRetry((n) => n + 1)} />;
  }

  return (
    <div className="space-y-5 animate-fadeup">
      <div className="space-y-4">
        <p className="text-caption text-textmuted">Upload a CSV or add contacts one by one.</p>
        <Button
          variant="outline"
          fullWidth
          icon={<DocumentDownload size={16} />}
          onClick={() => toast('CSV upload is coming soon.', 'info')}
        >
          Upload CSV
        </Button>
      </div>

      <section className="rounded-base border border-border bg-surface p-4 shadow-card">
        <OrgHeading title="Add a contact" />
        <div className="space-y-3">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              aria-label="Name"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Organization">
              <Input
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                placeholder="Company, church or table"
                aria-label="Organization"
              />
            </Field>
            <Field label="Phone number">
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="024 000 0000"
                inputMode="tel"
                aria-label="Phone number"
              />
            </Field>
          </div>
          <Field label="Invited guests" hint="Plus-ones coming with this contact">
            <Input
              value={guestCount}
              onChange={(event) => setGuestCount(event.target.value)}
              inputMode="numeric"
              type="number"
              aria-label="Invited guests"
            />
          </Field>
          <Button
            fullWidth
            variant="secondary"
            icon={<Add size={16} />}
            onClick={() => void addContact()}
            loading={adding}
          >
            Add contact
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-subtitle text-textprimary">Contacts</h2>
          <span className="shrink-0 text-caption text-textmuted">
            {list.length} contact{list.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search guests..." />
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading contacts">
            <Skeleton className="h-[72px] w-full" />
            <Skeleton className="h-[72px] w-full" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Profile2User size={26} />}
            title="No guests added yet."
            body="Contacts you add appear here and can be invited in one step."
          />
        ) : (
          <div className="space-y-2">
            {visible.map((entry) => {
              const detail = [entry.organization, entry.phone].filter((part) => part !== '').join(' · ');
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-base border border-border bg-surface px-4 py-3 shadow-card"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutralbg text-body font-bold text-textprimary">
                    {entry.fullName === '' ? '?' : entry.fullName[0].toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-textprimary">{entry.fullName}</span>
                    {detail !== '' && (
                      <span className="mt-0.5 block truncate text-caption text-textmuted">{detail}</span>
                    )}
                  </span>
                  {entry.invitedGuestCount > 0 && (
                    <span className="shrink-0 rounded-md bg-primary-10 px-2 py-1 text-caption font-bold text-primary">
                      +{entry.invitedGuestCount}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${entry.fullName}`}
                    onClick={() => void removeContact(entry)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-textmuted transition-colors duration-200 hover:bg-dangerbg hover:text-danger"
                  >
                    <CloseCircle size={18} />
                  </button>
                </div>
              );
            })}

            {visibleInvited.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-base border border-dashed border-border bg-surface px-4 py-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-10 text-primary">
                  <Send2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-textprimary">{row.name}</span>
                  <span className="mt-0.5 block truncate text-caption text-textmuted">Invited with a booking</span>
                </span>
                <span className="shrink-0 rounded-md bg-neutralbg px-2 py-1 text-caption font-semibold text-textmuted">
                  {row.status === 'merged' ? 'Merged' : 'Invited'}
                </span>
              </div>
            ))}

            {visible.length === 0 && visibleInvited.length === 0 && (
              <p className="py-3 text-center text-body text-textmuted">No attendees match your filter.</p>
            )}
          </div>
        )}
      </section>

      <Button fullWidth onClick={continueToInvites}>
        Next: send invites
      </Button>

      <ConfirmDialog
        open={confirmSkip}
        title="Continue without adding guests?"
        body="You have not added any guests yet. You can still send invitations with a shareable link."
        confirmLabel="Continue"
        cancelLabel="Add guests"
        onCancel={() => setConfirmSkip(false)}
        onConfirm={() => {
          setConfirmSkip(false);
          navigate(`/organizer/events/${eventId}/invite`);
        }}
      />
    </div>
  );
}
