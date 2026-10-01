import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Add, Camera, Calendar1, CloseCircle, Flash, Import, Map1, Play, Timer } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { db } from '../../db/db';
import { assetUrl } from '../../lib/asset';
import { CATEGORIES } from '../../lib/constants';
import {
  MAX_COVER_IMAGE_BYTES,
  MAX_COVER_VIDEO_BYTES,
  MediaSizeError,
  mediaKindOf,
  readFileAsDataUrl,
} from '../../lib/media';
import { Event, EventScheduleItem, EventTicket, type EventCategory, type EventStatus } from '../../models';
import { EventService, eventScheduleService } from '../../services';
import {
  Button,
  ConfirmDialog,
  CoverMedia,
  Field,
  Input,
  Select,
  Sheet,
  Skeleton,
  TextActionButton,
  Textarea,
} from '../../components/ui';
import { useServiceLive } from '../../components/OrgKit';

const eventService = new EventService();

const DAY_MS = 24 * 60 * 60 * 1000;

const COVERS = ['wedding', 'funeral', 'corporate', 'social', 'banner', 'fallback'];

/** Cap for the extra photos/videos attached to the event listing itself. */
const MAX_GALLERY_ITEMS = 12;

const PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'Accra', lat: 5.6037, lng: -0.187 },
  { name: 'Kumasi', lat: 6.6885, lng: -1.6244 },
  { name: 'Tamale', lat: 9.4034, lng: -0.8393 },
  { name: 'Takoradi', lat: 4.898, lng: -1.76 },
  { name: 'Cape Coast', lat: 5.1063, lng: -1.2466 },
  { name: 'Tema', lat: 5.6696, lng: -0.0166 },
  { name: 'Sunyani', lat: 7.3333, lng: -2.3333 },
  { name: 'Ho', lat: 6.6111, lng: 0.4714 },
];

interface TierRow {
  key: string;
  name: string;
  price: string;
  capacity: string;
  earlyPrice: string;
  earlyUntil: string;
}

interface AgendaRow {
  key: string;
  title: string;
  time: string;
  location: string;
}

function emptyTier(key: string): TierRow {
  return { key, name: '', price: '', capacity: '', earlyPrice: '', earlyUntil: '' };
}

function emptyAgenda(key: string): AgendaRow {
  return { key, title: '', time: '', location: '' };
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function dateLabel(value: Date): string {
  return `${value.getDate()}/${value.getMonth() + 1}/${value.getFullYear()}`;
}

function rowKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export default function CreateEventScreen() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const { uid } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [initial, setInitial] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(!isEditing);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [venue, setVenue] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [cover, setCover] = useState('');
  const [gallery, setGallery] = useState<Array<{ url: string; isVideo: boolean }>>([]);
  const [tiers, setTiers] = useState<TierRow[]>([emptyTier(rowKey('tier'))]);
  const [agenda, setAgenda] = useState<AgendaRow[]>([]);
  const [errors, setErrors] = useState<{ title: string | null; category: string | null; venue: string | null }>({
    title: null,
    category: null,
    venue: null,
  });
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [placeDraft, setPlaceDraft] = useState<{ lat: number; lng: number } | null>(null);

  const schedule = useServiceLive(
    eventScheduleService.scheduleForEvent(id ?? ''),
    [id],
    [db.eventSchedules],
  );
  const scheduleLoaded = useRef(false);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    void eventService.getEvent(id).then((ev) => {
      if (!alive || !ev) return;
      setInitial(ev);
      setTitle(ev.title);
      setDescription(ev.description);
      setDate(
        `${ev.date.getFullYear()}-${String(ev.date.getMonth() + 1).padStart(2, '0')}-${String(
          ev.date.getDate(),
        ).padStart(2, '0')}`,
      );
      setCategory(ev.category);
      setVenue(ev.venue);
      setLat(ev.lat);
      setLng(ev.lng);
      setCover(ev.coverImageUrl);
      setGallery(
        ev.mediaUrls
          .filter((url) => url !== ev.coverImageUrl && url !== '')
          .slice(0, MAX_GALLERY_ITEMS)
          .map((url) => ({ url, isVideo: Event.isVideo(url) })),
      );
      if (ev.ticketTypes.length > 0) {
        setTiers(
          ev.ticketTypes.map((t) => ({
            key: rowKey('tier'),
            name: t.name,
            price: t.price > 0 ? t.price.toFixed(2) : '',
            capacity: t.capacity > 0 ? String(t.capacity) : '',
            earlyPrice:
              t.earlyBirdPrice != null && t.earlyBirdPrice > 0
                ? t.earlyBirdPrice.toFixed(2)
                : '',
            earlyUntil: t.earlyBirdUntil ? t.earlyBirdUntil.slice(0, 10) : '',
          })),
        );
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const items = schedule.data;
    if (scheduleLoaded.current || !id || !items || items.length === 0) return;
    scheduleLoaded.current = true;
    setAgenda(
      items.map((item) => ({
        key: rowKey('agenda'),
        title: item.title,
        time: item.time,
        location: item.details,
      })),
    );
  }, [schedule, id]);

  const dirty =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    venue.trim().length > 0 ||
    category.length > 0 ||
    date.length > 0 ||
    cover.length > 0 ||
    agenda.some((row) => row.title.trim().length > 0);

  function updateTier(index: number, patch: Partial<TierRow>): void {
    setTiers((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateAgenda(index: number, patch: Partial<AgendaRow>): void {
    setAgenda((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function ticketsFromTiers(): EventTicket[] {
    const out: EventTicket[] = [];
    for (const row of tiers) {
      const hasContent =
        row.name.trim().length > 0 || row.price.trim().length > 0 || row.capacity.trim().length > 0;
      if (!hasContent) continue;
      const price = Number(row.price) || 0;
      const early = Number(row.earlyPrice) || 0;
      out.push(
        new EventTicket({
          name: row.name.trim().length > 0 ? row.name.trim() : 'General',
          price,
          capacity: Number(row.capacity) || 0,
          earlyBirdPrice: early > 0 && early < price ? early : undefined,
          earlyBirdUntil:
            early > 0 && early < price && row.earlyUntil ? new Date(`${row.earlyUntil}T00:00:00`).toISOString() : undefined,
        }),
      );
    }
    return out;
  }

  function buildEvent(status: EventStatus): Event {
    const when = date ? new Date(`${date}T12:00:00`) : new Date(Date.now() + 7 * DAY_MS);
    return new Event({
      id: id ?? '',
      ownerId: initial?.ownerId ?? uid ?? '',
      title: title.trim(),
      category: (category.length > 0 ? category : 'social') as EventCategory,
      date: when,
      venue: venue.trim(),
      lat,
      lng,
      description: description.trim(),
      ticketTypes: ticketsFromTiers(),
      status,
      coverImageUrl: cover,
      mediaUrls: [...new Set(gallery.map((item) => item.url))].filter((url) => url !== cover),
      thankYouMessage: initial?.thankYouMessage ?? '',
      featured: initial?.featured ?? false,
      featuredUntil: initial?.featuredUntil,
      collaboratorIds: initial?.collaboratorIds ?? [],
    });
  }

  async function saveAgenda(eventId: string): Promise<void> {
    if (agenda.length === 0) return;
    for (const old of schedule.data ?? []) {
      await eventScheduleService.deleteScheduleItem(old.id);
    }
    for (let i = 0; i < agenda.length; i++) {
      const row = agenda[i];
      if (row.title.trim().length === 0) continue;
      const item = new EventScheduleItem({
        id: '',
        eventId,
        dayLabel: 'Day 1',
        dayNumber: 1,
        time: row.time,
        title: row.title.trim(),
        order: i,
      });
      item.details = row.location.trim();
      await eventScheduleService.addScheduleItem(item);
    }
    scheduleLoaded.current = true;
  }

  function validate(): boolean {
    const next = {
      title: title.trim().length === 0 ? 'Enter a title.' : null,
      category: category.length === 0 ? 'Category.' : null,
      venue: venue.trim().length === 0 ? 'Enter a venue.' : null,
    };
    setErrors(next);
    if (next.title || next.category || next.venue) return false;
    if (date.length === 0) {
      toast('Choose a category and date.');
      return false;
    }
    const hasTier = tiers.some(
      (row) =>
        row.name.trim().length > 0 || row.price.trim().length > 0 || row.capacity.trim().length > 0,
    );
    if (!hasTier) {
      toast('Add at least one ticket tier.');
      return false;
    }
    return true;
  }

  async function saveDraft(): Promise<void> {
    if (title.trim().length === 0) {
      toast('Enter a title to save draft.');
      setErrors((prev) => ({ ...prev, title: 'Enter a title.' }));
      return;
    }
    setSavingDraft(true);
    try {
      const eventId = await eventService.saveDraft(buildEvent('draft'));
      await saveAgenda(eventId);
      toast('Draft saved.');
      navigate('/organizer/events');
    } catch (err) {
      toast(`Could not save draft: ${String(err)}`, 'error');
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit(): Promise<void> {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEditing && id) {
        if (initial?.status === 'draft') {
          await eventService.updateEvent(buildEvent('pending_review'));
          await saveAgenda(id);
          toast('Submitted for review.');
        } else {
          await eventService.updateEvent(buildEvent(initial?.status ?? 'published'));
          await saveAgenda(id);
          toast('Event updated.');
        }
        navigate(`/organizer/events/${id}`);
      } else {
        const eventId = await eventService.createEvent(buildEvent('pending_review'));
        await eventService.submitForReview(eventId);
        await saveAgenda(eventId);
        navigate(`/organizer/events/${eventId}/guests`);
      }
    } catch (err) {
      toast(`Could not save: ${String(err)}`, 'error');
      setSaving(false);
    }
  }

  async function pickCover(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const kind = mediaKindOf(file);
    if (!kind) {
      toast('Choose an image or a video file.', 'error');
      return;
    }
    try {
      const url = await readFileAsDataUrl(
        file,
        kind === 'video' ? MAX_COVER_VIDEO_BYTES : MAX_COVER_IMAGE_BYTES,
      );
      setCover(url);
      setCoverOpen(false);
    } catch (err) {
      if (err instanceof MediaSizeError) {
        toast(
          kind === 'video'
            ? 'That video is too large — keep it under 20 MB.'
            : 'That image is too large — keep it under 3 MB.',
          'error',
        );
        return;
      }
      toast('Could not read that file.', 'error');
    }
  }

  async function pickGallery(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const added: Array<{ url: string; isVideo: boolean }> = [];
    for (const file of files) {
      const kind = mediaKindOf(file);
      if (!kind) {
        toast('Choose an image or a video file.', 'error');
        continue;
      }
      try {
        const url = await readFileAsDataUrl(
          file,
          kind === 'video' ? MAX_COVER_VIDEO_BYTES : MAX_COVER_IMAGE_BYTES,
        );
        added.push({ url, isVideo: kind === 'video' });
      } catch (err) {
        if (err instanceof MediaSizeError) {
          toast(
            kind === 'video'
              ? 'That video is too large — keep it under 20 MB.'
              : 'That image is too large — keep it under 3 MB.',
            'error',
          );
        } else {
          toast('Could not read that file.', 'error');
        }
      }
    }
    if (added.length === 0) return;

    const room = Math.max(MAX_GALLERY_ITEMS - gallery.length, 0);
    const seen = new Set(gallery.map((item) => item.url));
    const taken: Array<{ url: string; isVideo: boolean }> = [];
    let fresh = 0;
    for (const item of added) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      fresh += 1;
      if (taken.length < room) taken.push(item);
    }
    if (fresh > room) toast(`You can add up to ${MAX_GALLERY_ITEMS} items.`, 'error');
    if (taken.length > 0) setGallery((rows) => [...rows, ...taken]);
  }

  function requestClose(): void {
    if (dirty) setDiscardOpen(true);
    else navigate('/organizer/events');
  }

  if (!loaded) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading event">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const previewEvent = buildEvent('draft');

  return (
    <div className="space-y-6 animate-fadeup">
      <div className="flex items-center justify-between gap-3">
        <TextActionButton onClick={requestClose}>Cancel</TextActionButton>
        <TextActionButton onClick={() => setPreviewOpen(true)}>Preview</TextActionButton>
      </div>

      <section>
        <button
          type="button"
          onClick={() => setCoverOpen(true)}
          className="relative flex h-[200px] w-full items-center justify-center overflow-hidden rounded-base border border-border bg-neutralbg transition-colors duration-200 hover:border-primary"
        >
          {cover ? (
            <CoverMedia url={cover} className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-textmuted">
              <Camera size={30} />
              <span className="text-body">Tap to add cover image</span>
            </span>
          )}
        </button>
      </section>

      <section>
        <h2 className="text-subtitle text-textprimary">Photos &amp; video</h2>
        <p className="mt-1 text-caption text-textmuted">
          Add a few more photos or a short video so people know what to expect.
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
          {gallery.map((item, index) => (
            <div key={item.url} className="relative">
              {item.isVideo ? (
                <>
                  <video
                    src={item.url}
                    aria-label={`Video ${index + 1} preview`}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-[104px] w-[104px] rounded-xl border border-border bg-neutralbg object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
                      <Play size={16} variant="Bold" />
                    </span>
                  </span>
                </>
              ) : (
                <img
                  src={item.url}
                  alt=""
                  className="h-[104px] w-[104px] rounded-xl border border-border object-cover"
                />
              )}
              <button
                type="button"
                aria-label={item.isVideo ? `Remove video ${index + 1}` : `Remove photo ${index + 1}`}
                title={item.isVideo ? 'Remove video' : 'Remove photo'}
                onClick={() => setGallery((rows) => rows.filter((_, i) => i !== index))}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-textmuted shadow-card transition-colors duration-200 hover:text-danger"
              >
                <CloseCircle size={18} />
              </button>
            </div>
          ))}

          {gallery.length < MAX_GALLERY_ITEMS ? (
            <button
              type="button"
              aria-label="Add media"
              onClick={() => galleryFileRef.current?.click()}
              className="flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-textmuted transition-colors duration-200 hover:border-primary hover:text-primary"
            >
              <Add size={20} />
              <span className="text-caption font-semibold">Add</span>
            </button>
          ) : (
            <span className="flex h-[104px] items-center text-caption text-textmuted">
              {MAX_GALLERY_ITEMS}/{MAX_GALLERY_ITEMS} added
            </span>
          )}
        </div>

        <input
          ref={galleryFileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => void pickGallery(event)}
        />
      </section>

      <section className="space-y-4">
        <Field label="Event title" required error={errors.title}>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
            }}
            invalid={Boolean(errors.title)}
            placeholder="Give your event a name"
            autoComplete="off"
          />
        </Field>

        <Field label="Description" hint="What is this event about?">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </Field>

        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <Field label="Date" hint={date ? undefined : 'Pick a date'}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} leading={<Calendar1 size={18} />} />
          </Field>
          <Field label="Category" required error={errors.category}>
            <Select
              value={category}
              invalid={Boolean(errors.category)}
              onChange={(e) => {
                setCategory(e.target.value);
                if (errors.category) setErrors((prev) => ({ ...prev, category: null }));
              }}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {capitalize(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Venue & location" required error={errors.venue}>
          <Input
            value={venue}
            onChange={(e) => {
              setVenue(e.target.value);
              if (errors.venue) setErrors((prev) => ({ ...prev, venue: null }));
            }}
            invalid={Boolean(errors.venue)}
            placeholder="Where is it happening?"
          />
        </Field>

        <div className="flex items-center gap-2 rounded-base border border-border bg-surface pr-3 transition-colors duration-200 hover:border-primary">
          <button
            type="button"
            onClick={() => {
              setPlaceDraft({ lat, lng });
              setPlaceOpen(true);
            }}
            className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left"
          >
            <Map1 size={18} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-section font-bold text-textprimary">Pin on map</span>
              <span className="mt-0.5 block truncate text-caption text-textmuted">
                {lat === 0 ? 'Tap to set location on map' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
              </span>
            </span>
          </button>
          {lat !== 0 && (
            <button
              type="button"
              aria-label="Clear location"
              onClick={() => {
                setLat(0);
                setLng(0);
              }}
              className="shrink-0 text-textmuted transition-colors duration-200 hover:text-danger"
            >
              <CloseCircle size={16} />
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-subtitle text-textprimary">Ticket Tiers</h2>
          <button
            type="button"
            onClick={() => setTiers((rows) => [...rows, emptyTier(rowKey('tier'))])}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-button text-primary transition-opacity duration-200 hover:opacity-80"
          >
            <Add size={16} />
            Add another tier
          </button>
        </div>

        <div className="space-y-3">
          {tiers.map((row, index) => (
            <div key={row.key} className="rounded-base border border-border bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-section text-textmuted">{`Tier ${index + 1}`}</span>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove tier ${index + 1}`}
                    onClick={() => setTiers((rows) => rows.filter((_, i) => i !== index))}
                    className="text-textmuted transition-colors duration-200 hover:text-danger"
                  >
                    <CloseCircle size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Ticket name">
                  <Input
                    value={row.name}
                    onChange={(e) => updateTier(index, { name: e.target.value })}
                    placeholder="e.g. General, VIP"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (GHS)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateTier(index, { price: e.target.value })}
                      leading={<span className="text-caption text-textmuted">GHS</span>}
                    />
                  </Field>
                  <Field label="Capacity" hint="Max">
                    <Input
                      type="number"
                      min={0}
                      value={row.capacity}
                      onChange={(e) => updateTier(index, { capacity: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="rounded-md border border-warningbg bg-warningbg p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-caption font-bold text-warning">
                      <Flash size={14} />
                      Early-bird price
                    </span>
                    {(row.earlyPrice.length > 0 || row.earlyUntil.length > 0) && (
                      <button
                        type="button"
                        onClick={() => updateTier(index, { earlyPrice: '', earlyUntil: '' })}
                        className="text-caption font-semibold text-warning transition-opacity duration-200 hover:opacity-80"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Early price">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.earlyPrice}
                        onChange={(e) => updateTier(index, { earlyPrice: e.target.value })}
                        leading={<span className="text-caption text-textmuted">GHS</span>}
                      />
                    </Field>
                    <Field label="Until" hint={row.earlyUntil ? undefined : 'Pick date'}>
                      <Input
                        type="date"
                        value={row.earlyUntil}
                        onChange={(e) => updateTier(index, { earlyUntil: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-subtitle text-textprimary">Agenda / Schedule</h2>
          <button
            type="button"
            onClick={() => setAgenda((rows) => [...rows, emptyAgenda(rowKey('agenda'))])}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-button text-primary transition-opacity duration-200 hover:opacity-80"
          >
            <Add size={16} />
            Add item
          </button>
        </div>

        {agenda.length === 0 ? (
          <p className="text-caption text-textmuted">
            Add schedule items (e.g. 09:00 Opening Ceremony). Visible in attendee Schedule tab.
          </p>
        ) : (
          <div className="space-y-3">
            {agenda.map((row, index) => (
              <div key={row.key} className="rounded-base border border-border bg-surface p-3.5 shadow-card">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label="Title">
                      <Input
                        value={row.title}
                        onChange={(e) => updateAgenda(index, { title: e.target.value })}
                        placeholder="Opening Ceremony"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove agenda item ${index + 1}`}
                    onClick={() => setAgenda((rows) => rows.filter((_, i) => i !== index))}
                    className="mt-6 shrink-0 text-textmuted transition-colors duration-200 hover:text-danger"
                  >
                    <CloseCircle size={18} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Time" hint={row.time ? undefined : 'Pick start time'}>
                    <Input
                      type="time"
                      value={row.time}
                      onChange={(e) => updateAgenda(index, { time: e.target.value })}
                      leading={<Timer size={18} />}
                    />
                  </Field>
                  <Field label="Location">
                    <Input
                      value={row.location}
                      onChange={(e) => updateAgenda(index, { location: e.target.value })}
                      placeholder="Main hall"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 pb-4">
        <Button
          fullWidth
          size="lg"
          loading={saving}
          disabled={savingDraft}
          onClick={() => void submit()}
        >
          {isEditing && initial?.status !== 'draft' ? 'Save changes' : 'Submit for review'}
        </Button>
        {(!isEditing || initial?.status === 'draft') && (
          <Button
            fullWidth
            size="lg"
            variant="outline"
            loading={savingDraft}
            disabled={saving}
            onClick={() => void saveDraft()}
          >
            Save as draft
          </Button>
        )}
      </section>

      <Sheet open={coverOpen} onClose={() => setCoverOpen(false)} title="Choose cover image">
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3">
          <button
            type="button"
            onClick={() => coverFileRef.current?.click()}
            className="col-span-2 flex h-20 items-center justify-center gap-2 rounded-md border border-dashed border-border text-textmuted transition-colors duration-200 hover:border-primary hover:text-primary tablet:col-span-3"
          >
            <Import size={22} />
            <span className="text-body font-bold">Upload from your device</span>
          </button>
          {COVERS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setCover(assetUrl(`/seed/${name}.svg`));
                setCoverOpen(false);
              }}
              className={`overflow-hidden rounded-md border transition-colors duration-200 ${
                cover === assetUrl(`/seed/${name}.svg`) ? 'border-primary' : 'border-border hover:border-primary'
              }`}
            >
              <img
                src={assetUrl(`/seed/${name}.svg`)}
                alt={capitalize(name)}
                className="aspect-video w-full object-cover"
              />
              <span className="block px-2 py-1.5 text-caption text-textmuted">{capitalize(name)}</span>
            </button>
          ))}
        </div>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => void pickCover(event)}
        />
      </Sheet>

      <Sheet
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        title="Pick venue location"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlaceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (placeDraft) {
                  setLat(placeDraft.lat);
                  setLng(placeDraft.lng);
                }
                setPlaceOpen(false);
              }}
            >
              Done
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {PLACES.map((place) => {
            const selected =
              placeDraft != null &&
              Math.abs(placeDraft.lat - place.lat) < 0.0001 &&
              Math.abs(placeDraft.lng - place.lng) < 0.0001;
            return (
              <button
                key={place.name}
                type="button"
                onClick={() => setPlaceDraft({ lat: place.lat, lng: place.lng })}
                className={`flex w-full items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors duration-200 ${
                  selected ? 'border-primary bg-primary-6' : 'border-border hover:border-primary'
                }`}
              >
                <Map1 size={16} className={selected ? 'text-primary' : 'text-textmuted'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-textprimary">{place.name}</span>
                  <span className="block truncate text-caption text-textmuted">
                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview">
        <div className="space-y-3">
          {previewEvent.coverImageUrl && (
            <CoverMedia
              url={previewEvent.coverImageUrl}
              className="h-[140px] w-full rounded-md object-cover"
            />
          )}
          <h3 className="text-subtitle text-textprimary">{previewEvent.title || 'Untitled event'}</h3>
          <p className="text-body text-textmuted">
            {previewEvent.description.length > 0 ? previewEvent.description : '(No description)'}
          </p>
          <p className="text-body text-textmuted">
            {previewEvent.venue} • {dateLabel(previewEvent.date)}
          </p>
          {previewEvent.ticketTypes.length > 0 && (
            <div className="border-t border-border pt-3">
              {previewEvent.ticketTypes.map((ticket) => (
                <p key={ticket.name} className="text-body text-textprimary">
                  {ticket.name}: GHS {ticket.effectivePrice.toFixed(2)}
                  {ticket.hasEarlyBird ? ' (Early-bird)' : ''}
                </p>
              ))}
            </div>
          )}
          {agenda.some((row) => row.title.trim().length > 0) && (
            <div className="border-t border-border pt-3">
              <p className="text-body font-bold text-textprimary">Agenda</p>
              {agenda
                .filter((row) => row.title.trim().length > 0)
                .map((row) => (
                  <p key={row.key} className="text-body text-textmuted">
                    {`• ${row.title.trim()}`}
                  </p>
                ))}
            </div>
          )}
        </div>
        <div className="mt-5">
          <Button fullWidth variant="outline" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={discardOpen}
        title="Discard?"
        body="Unsaved details will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          navigate('/organizer/events');
        }}
      />
    </div>
  );
}
