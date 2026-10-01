import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Add,
  Briefcase,
  Building,
  Calendar1,
  Call,
  Cup,
  Heart,
  Minus,
  People,
  Personalcard,
  Profile2User,
  TagUser,
  TicketDiscount,
  TickCircle,
  User,
} from 'iconsax-react';
import {
  Button,
  Chip,
  ErrorState,
  Field,
  Input,
  Skeleton,
} from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import {
  DiscountService,
  EventService,
  InvalidCodeException,
  RegistrationService,
  SoldOutException,
} from '../../services';
import {
  Event,
  Registration,
  type DiscountCode,
  type EventCategory,
  type EventTicket,
} from '../../models';
import { formatCurrency, formatDateLong } from '../../lib/format';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const RELATIONSHIP_CONFIG: Record<EventCategory, { label: string; options: string[] }> = {
  wedding: {
    label: 'Relationship to the couple',
    options: ['Family', 'Friend', 'Colleague', 'Wedding party', 'Vendor', 'Other'],
  },
  funeral: {
    label: 'Relationship to the family',
    options: ['Family', 'Friend', 'Colleague', 'Church / group', 'Sympathiser', 'Other'],
  },
  corporate: {
    label: 'Delegate type',
    options: ['Delegate', 'Speaker', 'Sponsor', 'Press', 'Vendor', 'Other'],
  },
  social: {
    label: 'Attendee type',
    options: ['Family', 'Friend', 'Colleague', 'VIP', 'Vendor', 'Other'],
  },
};

interface FieldErrors {
  fullName: string | null;
  phone: string | null;
  attendeeType: string | null;
  organization: string | null;
}

const EMPTY_ERRORS: FieldErrors = {
  fullName: null,
  phone: null,
  attendeeType: null,
  organization: null,
};

function countDigits(value: string): number {
  return value.replace(/[\s-]/g, '').replace(/\D/g, '').length;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-section uppercase tracking-wide text-textmuted">
      <span className="text-primary [&>svg]:block">{icon}</span>
      {title}
    </h2>
  );
}

function ChoiceRow({
  label,
  icon,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  icon: React.ReactNode;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-2 text-caption font-semibold text-textmuted">
        <span className="[&>svg]:block">{icon}</span>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option} selected={value === option} onClick={() => onChange(option)}>
            {value === option && <TickCircle size={14} className="shrink-0" />}
            {option}
          </Chip>
        ))}
      </div>
      {error && <p className="mt-1.5 text-caption text-danger">{error}</p>}
    </div>
  );
}

export default function RegistrationScreen() {
  const { eventId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { uid } = useAuth();
  const { error: showError, toast } = useToast();

  const preselectedTier =
    typeof (location.state as { tier?: string } | null)?.tier === 'string'
      ? ((location.state as { tier?: string }).tier as string)
      : '';

  const {
    data: event,
    loading,
    error,
  } = useLive<Event | null>(() => eventService.getEvent(eventId), [eventId]);

  const [tierName, setTierName] = useState(preselectedTier);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dietary, setDietary] = useState('');
  const [attendeeType, setAttendeeType] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [organization, setOrganization] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS);

  const category: EventCategory = event?.category ?? 'social';
  const relationship = RELATIONSHIP_CONFIG[category];

  useEffect(() => {
    setAttendeeType('');
  }, [category]);

  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const eventService = new EventService();
  const registrationService = useMemo(() => new RegistrationService(), []);
  const discountService = useMemo(() => new DiscountService(), []);

  const ticket: EventTicket | null = useMemo(() => {
    if (!event || event.ticketTypes.length === 0) return null;
    const chosen = event.ticketTypes.find((tier) => tier.name === tierName);
    return chosen ?? event.ticketTypes[0];
  }, [event, tierName]);

  const originalPrice = ticket?.effectivePrice ?? 0;
  const discountedPrice =
    appliedDiscount && originalPrice > 0
      ? Math.floor(originalPrice * (1 - appliedDiscount.percentOff / 100))
      : originalPrice;
  const isFree = originalPrice <= 0;
  const ctaLabel = isFree
    ? 'Confirm registration'
    : `Continue to payment · ${formatCurrency(discountedPrice)}`;

  async function validateDiscount() {
    const code = discountCode.trim();
    if (code.length === 0) return;
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      const discount = await discountService.validateCode(eventId, code);
      setAppliedDiscount(discount);
      setDiscountError(null);
    } catch (err) {
      setAppliedDiscount(null);
      setDiscountError(
        err instanceof InvalidCodeException ? err.message : 'Could not validate discount code.',
      );
    } finally {
      setDiscountLoading(false);
    }
  }

  function removeDiscount() {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError(null);
  }

  function validate(): boolean {
    const next: FieldErrors = {
      fullName: fullName.trim().length === 0 ? 'Add your full name' : null,
      phone: countDigits(phone) >= 9 ? null : 'Add a valid phone number',
      attendeeType: attendeeType.length === 0 ? 'Choose one.' : null,
      organization:
        category === 'corporate' && organization.trim().length === 0
          ? 'Add your company name'
          : null,
    };
    setErrors(next);
    const invalid = Object.values(next).some((value) => value != null);
    if (invalid) toast('Please fill all required fields.', 'error');
    return !invalid;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !uid || !ticket) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const registration = new Registration({
        id: '',
        eventId,
        userId: uid,
        fullName: fullName.trim(),
        phone: phone.trim(),
        invitedGuestCount: guestCount,
        gender,
        dietary: dietary.trim(),
        attendeeType,
        organization: organization.trim(),
        jobTitle: jobTitle.trim(),
        emergencyContact: emergencyContact.trim(),
        emergencyPhone: emergencyPhone.trim(),
        ticketType: ticket.name,
      });

      const regId = await registrationService.submitRegistration(registration);

      if (ticket.effectivePrice > 0) {
        const { bookingId } = await registrationService.requestMomoPayment({
          regId,
          eventId,
          userId: uid,
          amount: discountedPrice,
        });
        navigate(`/event/${eventId}/pay/${bookingId}`, {
          replace: true,
          state: { originalAmount: ticket.effectivePrice, discountCodeId: appliedDiscount?.id },
        });
        return;
      }

      const booking = await registrationService.confirmFreeBooking({
        regId,
        eventId,
        userId: uid,
        discountCodeId: appliedDiscount?.id,
      });
      navigate(`/booking/${booking.id}`, { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof SoldOutException) {
        showError(err.message);
      } else {
        showError(`Registration failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading registration">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load event." onRetry={() => undefined} />;
  }

  return (
    <form className="animate-fadeup pb-4" onSubmit={submit} noValidate>
      {event && (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <h1 className="truncate text-subtitle text-textprimary">{event.title}</h1>
          <p className="mt-1 truncate text-caption text-textmuted">
            {formatDateLong(event.date)} · {event.venue}
          </p>
        </div>
      )}

      <div className="mt-4">
        <SectionTitle icon={<TicketDiscount size={16} />} title="Select ticket" />
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {(event?.ticketTypes ?? []).map((tier) => {
            const selected = ticket?.name === tier.name;
            return (
              <button
                key={tier.name}
                type="button"
                onClick={() => setTierName(tier.name)}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3.5 text-left transition-colors duration-200 last:border-b-0 ${
                  selected ? 'bg-primary-6' : 'hover:bg-neutralbg'
                }`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-bold text-textprimary">
                      {tier.name}
                    </span>
                    {tier.hasEarlyBird && (
                      <span className="rounded-pill bg-warningbg px-2 py-0.5 text-[11px] font-bold text-warning">
                        Early-bird
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-caption text-textmuted">
                    {tier.effectivePrice > 0 ? formatCurrency(tier.effectivePrice) : 'Free'}
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-primary' : 'border-border'
                  }`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
              </button>
            );
          })}
          {(event?.ticketTypes ?? []).length === 0 && (
            <p className="px-4 py-4 text-body text-textmuted">Free</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle icon={<User size={16} />} title="Your details" />
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <Field label="Full name" required error={errors.fullName}>
            <Input
              leading={<User size={18} />}
              placeholder="Full name"
              autoComplete="name"
              value={fullName}
              invalid={errors.fullName != null}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label="Phone number" required error={errors.phone}>
            <Input
              leading={<Call size={18} />}
              placeholder="024 000 0000"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              invalid={errors.phone != null}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle icon={<Heart size={16} />} title="About you" />
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <ChoiceRow
            label="Gender"
            icon={<Personalcard size={16} />}
            options={GENDERS}
            value={gender}
            onChange={setGender}
          />
          <Field label="Dietary requirements / allergies" hint="Optional — shared with the organizer (catering).">
            <Input
              leading={<Cup size={18} />}
              placeholder="e.g. no nuts, vegetarian"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle icon={<Calendar1 size={16} />} title="Your visit" />
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-body text-textmuted">
              Guests you&apos;re bringing
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-pill bg-neutralbg p-1">
              <button
                type="button"
                aria-label="Remove guest"
                disabled={guestCount === 0}
                onClick={() => setGuestCount((count) => Math.max(0, count - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors duration-200 disabled:text-neutral"
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center text-body font-bold text-textprimary">
                {guestCount}
              </span>
              <button
                type="button"
                aria-label="Add guest"
                onClick={() => setGuestCount((count) => count + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-[filter] duration-200 hover:brightness-95"
              >
                <Add size={16} />
              </button>
            </span>
          </div>
          <ChoiceRow
            label={relationship.label}
            icon={<TagUser size={16} />}
            options={relationship.options}
            value={attendeeType}
            onChange={setAttendeeType}
            error={errors.attendeeType}
          />
        </div>
      </div>

      {category === 'corporate' && (
        <div className="mt-6">
          <SectionTitle icon={<Building size={16} />} title="Your company" />
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <Field label="Company name" required error={errors.organization}>
              <Input
                leading={<Building size={18} />}
                placeholder="Company name"
                value={organization}
                invalid={errors.organization != null}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </Field>
            <Field label="Job title">
              <Input
                leading={<Briefcase size={18} />}
                placeholder="Job title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      {category === 'funeral' && (
        <div className="mt-6">
          <SectionTitle icon={<People size={16} />} title="Your group" />
          <div className="rounded-lg border border-border bg-surface p-4">
            <Field label="Group or church" hint="Optional — e.g. church group, family union.">
              <Input
                leading={<People size={18} />}
                placeholder="Group or church"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      {category === 'social' && (
        <div className="mt-6">
          <SectionTitle icon={<People size={16} />} title="Your table" />
          <div className="rounded-lg border border-border bg-surface p-4">
            <Field label="Table or group name" hint="Optional — for table seating.">
              <Input
                leading={<People size={18} />}
                placeholder="Table or group name"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="mt-6">
        <SectionTitle icon={<Profile2User size={16} />} title="Emergency contact" />
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <Field label="Contact name" hint="Optional — only used on the event day.">
            <Input
              leading={<User size={18} />}
              placeholder="Contact name"
              autoComplete="name"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
            />
          </Field>
          <Field label="Contact number" hint="Optional — only used on the event day.">
            <Input
              leading={<Call size={18} />}
              placeholder="024 000 0000"
              inputMode="tel"
              autoComplete="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {!isFree && (
        <div className="mt-6">
          <SectionTitle icon={<TicketDiscount size={16} />} title="Have a discount code?" />
          <div className="rounded-lg border border-border bg-surface p-4">
            {appliedDiscount ? (
              <div className="flex items-center justify-between gap-3 rounded-md bg-successbg px-3 py-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-body font-semibold text-textprimary">
                  <TickCircle size={16} className="shrink-0 text-success" />
                  <span className="truncate">
                    {appliedDiscount.code}
                    {appliedDiscount.percentOff > 0 ? ` · -${appliedDiscount.percentOff}%` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={removeDiscount}
                  className="shrink-0 text-caption font-bold text-primary transition-opacity duration-200 hover:opacity-80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Discount code"
                    aria-label="Discount code"
                    className="h-11"
                    value={discountCode}
                    invalid={discountError != null}
                    onChange={(e) => setDiscountCode(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={discountLoading}
                    onClick={() => void validateDiscount()}
                  >
                    Apply
                  </Button>
                </div>
                {discountError && (
                  <p className="mt-1.5 text-caption text-danger">{discountError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!isFree && ticket && (
        <div className="mt-6">
          <SectionTitle icon={<TicketDiscount size={16} />} title="Summary" />
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate text-body text-textmuted">{ticket.name}</span>
              <span className="shrink-0 text-body font-semibold text-textprimary">
                {formatCurrency(originalPrice)}
              </span>
            </div>
            {appliedDiscount && originalPrice - discountedPrice > 0 && (
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-body text-textmuted">Discount</span>
                <span className="shrink-0 text-body font-semibold text-success">
                  - {formatCurrency(originalPrice - discountedPrice)}
                </span>
              </div>
            )}
            <div className="mt-1 border-t border-border pt-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-subtitle font-extrabold text-textprimary">
                  Total
                </span>
                <span className="shrink-0 text-subtitle font-extrabold text-textprimary">
                  {formatCurrency(discountedPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-[68px] z-30 -mx-4 mt-6 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur tablet:bottom-0">
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {ctaLabel}
        </Button>
      </div>
    </form>
  );
}
