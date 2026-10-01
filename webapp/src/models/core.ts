/**
 * Core models — field-for-field mirrors of the Flutter Dart models in
 * `lib/models/`. Rows are stored in Dexie as plain objects (`toMap()`), and
 * hydrated back into these classes (`fromMap`) so the getters behave exactly
 * like the Dart getters (isFree, effectivePrice, isCurrentlyFeatured, …).
 */

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toIso(value: Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value.getTime()).toISOString();
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/** Merged membership: everyone is a `user`, admins are `admin`. */
export type Role = 'user' | 'admin';

export class User {
  uid: string;
  name: string;
  phone: string;
  email: string;
  roles: Role[];
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  followers: number;
  following: number;
  createdAt: Date;
  savedEventIds: string[];
  remindersEnabled: boolean;
  messageNotifsEnabled: boolean;
  followerNotifsEnabled: boolean;
  promoNotifsEnabled: boolean;
  blockedUids: string[];
  savedMomoNumber: string;
  savedMomoNetwork: string;
  /** organizer verification / moderation (admin actions) */
  verified: boolean;
  suspended: boolean;

  constructor(init: Partial<User> & { uid: string; createdAt: Date }) {
    this.uid = init.uid;
    this.name = init.name ?? '';
    this.phone = init.phone ?? '';
    this.email = init.email ?? '';
    this.roles = init.roles ?? [];
    this.bio = init.bio ?? '';
    this.avatarUrl = init.avatarUrl ?? '';
    this.bannerUrl = init.bannerUrl ?? '';
    this.followers = init.followers ?? 0;
    this.following = init.following ?? 0;
    this.createdAt = init.createdAt;
    this.savedEventIds = init.savedEventIds ?? [];
    this.remindersEnabled = init.remindersEnabled ?? true;
    this.messageNotifsEnabled = init.messageNotifsEnabled ?? true;
    this.followerNotifsEnabled = init.followerNotifsEnabled ?? true;
    this.promoNotifsEnabled = init.promoNotifsEnabled ?? false;
    this.blockedUids = init.blockedUids ?? [];
    this.savedMomoNumber = init.savedMomoNumber ?? '';
    this.savedMomoNetwork = init.savedMomoNetwork ?? '';
    this.verified = init.verified ?? false;
    this.suspended = init.suspended ?? false;
  }

  get isAdmin(): boolean {
    return this.roles.includes('admin');
  }

  static fromMap(id: string, map: Record<string, unknown>): User {
    return new User({
      uid: (map.uid as string) ?? id,
      name: (map.name as string) ?? '',
      phone: (map.phone as string) ?? '',
      email: (map.email as string) ?? '',
      roles: ((map.roles as string[]) ?? []) as Role[],
      bio: (map.bio as string) ?? '',
      avatarUrl: (map.avatarUrl as string) ?? '',
      bannerUrl: (map.bannerUrl as string) ?? '',
      followers: Number(map.followers ?? 0),
      following: Number(map.following ?? 0),
      createdAt: parseDate(map.createdAt) ?? new Date(0),
      savedEventIds: (map.savedEventIds as string[]) ?? [],
      remindersEnabled: map.remindersEnabled !== false,
      messageNotifsEnabled: map.messageNotifsEnabled !== false,
      followerNotifsEnabled: map.followerNotifsEnabled !== false,
      promoNotifsEnabled: map.promoNotifsEnabled === true,
      blockedUids: (map.blockedUids as string[]) ?? [],
      savedMomoNumber: (map.savedMomoNumber as string) ?? '',
      savedMomoNetwork: (map.savedMomoNetwork as string) ?? '',
      verified: map.verified === true,
      suspended: map.suspended === true,
    });
  }

  toMap(): Record<string, unknown> {
    return {
      uid: this.uid,
      name: this.name,
      phone: this.phone,
      email: this.email,
      roles: this.roles,
      bio: this.bio,
      avatarUrl: this.avatarUrl,
      bannerUrl: this.bannerUrl,
      followers: this.followers,
      following: this.following,
      createdAt: this.createdAt.toISOString(),
      savedEventIds: this.savedEventIds,
      remindersEnabled: this.remindersEnabled,
      messageNotifsEnabled: this.messageNotifsEnabled,
      followerNotifsEnabled: this.followerNotifsEnabled,
      promoNotifsEnabled: this.promoNotifsEnabled,
      blockedUids: this.blockedUids,
      savedMomoNumber: this.savedMomoNumber,
      savedMomoNetwork: this.savedMomoNetwork,
      verified: this.verified,
      suspended: this.suspended,
    };
  }
}

// ---------------------------------------------------------------------------
// Event / EventTicket
// ---------------------------------------------------------------------------

export type EventCategory = 'wedding' | 'funeral' | 'corporate' | 'social';
export type EventStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export class EventTicket {
  name: string;
  price: number;
  capacity: number;
  earlyBirdPrice?: number;
  earlyBirdUntil?: string;

  constructor(init: {
    name: string;
    price: number;
    capacity: number;
    earlyBirdPrice?: number;
    earlyBirdUntil?: string;
  }) {
    this.name = init.name;
    this.price = init.price;
    this.capacity = init.capacity;
    this.earlyBirdPrice = init.earlyBirdPrice;
    this.earlyBirdUntil = init.earlyBirdUntil;
  }

  /** Early-bird applies only while the price is a real discount and the end date is in the future. */
  get hasEarlyBird(): boolean {
    if (this.earlyBirdPrice == null || this.earlyBirdUntil == null) return false;
    if (this.earlyBirdPrice <= 0 || this.earlyBirdPrice >= this.price) return false;
    const until = parseDate(this.earlyBirdUntil);
    if (!until) return false;
    return Date.now() < until.getTime();
  }

  /** All pricing/charging must use effectivePrice. */
  get effectivePrice(): number {
    return this.hasEarlyBird ? (this.earlyBirdPrice as number) : this.price;
  }

  static fromMap(map: Record<string, unknown>): EventTicket {
    return new EventTicket({
      name: (map.name as string) ?? '',
      price: Number(map.price ?? 0),
      capacity: Number(map.capacity ?? 0),
      earlyBirdPrice:
        map.earlyBirdPrice == null ? undefined : Number(map.earlyBirdPrice),
      earlyBirdUntil: (map.earlyBirdUntil as string) ?? undefined,
    });
  }

  toMap(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      name: this.name,
      price: this.price,
      capacity: this.capacity,
    };
    if (this.earlyBirdPrice != null) out.earlyBirdPrice = this.earlyBirdPrice;
    if (this.earlyBirdUntil != null) out.earlyBirdUntil = this.earlyBirdUntil;
    return out;
  }
}

export class Event {
  id: string;
  ownerId: string;
  title: string;
  category: EventCategory;
  date: Date;
  venue: string;
  lat: number;
  lng: number;
  description: string;
  ticketTypes: EventTicket[];
  status: EventStatus;
  coverImageUrl: string;
  mediaUrls: string[];
  thankYouMessage: string;
  featured: boolean;
  featuredUntil?: string;
  collaboratorIds: string[];

  constructor(init: Partial<Event> & { id: string; ownerId: string; title: string; date: Date }) {
    this.id = init.id;
    this.ownerId = init.ownerId;
    this.title = init.title;
    this.category = init.category ?? 'social';
    this.date = init.date;
    this.venue = init.venue ?? '';
    this.lat = init.lat ?? 0;
    this.lng = init.lng ?? 0;
    this.description = init.description ?? '';
    this.ticketTypes = init.ticketTypes ?? [];
    this.status = init.status ?? 'pending_review';
    this.coverImageUrl = init.coverImageUrl ?? '';
    this.mediaUrls = init.mediaUrls ?? [];
    this.thankYouMessage = init.thankYouMessage ?? '';
    this.featured = init.featured ?? false;
    this.featuredUntil = init.featuredUntil;
    this.collaboratorIds = init.collaboratorIds ?? [];
  }

  get allMediaUrls(): string[] {
    const urls: string[] = [];
    if (this.coverImageUrl) urls.push(this.coverImageUrl);
    for (const u of this.mediaUrls) if (u && !urls.includes(u)) urls.push(u);
    return urls;
  }

  get isVideoUrl(): boolean {
    return Event.isVideo(this.coverImageUrl);
  }

  static isVideo(url: string): boolean {
    const l = url.trim().toLowerCase();
    if (l.startsWith('data:')) return l.startsWith('data:video/');
    return l.endsWith('.mp4') || l.endsWith('.mov') || l.endsWith('.webm');
  }

  /** An event with no paid ticket types is free. */
  get isFree(): boolean {
    return this.ticketTypes.every((t) => t.price === 0);
  }

  get isCurrentlyFeatured(): boolean {
    if (!this.featured) return false;
    const until = this.featuredUntil ? parseDate(this.featuredUntil) : null;
    if (!until) return false;
    return until.getTime() > Date.now();
  }

  get cheapestPrice(): number {
    if (this.ticketTypes.length === 0) return 0;
    return this.ticketTypes.reduce(
      (min, t) => Math.min(min, t.effectivePrice),
      Number.POSITIVE_INFINITY,
    );
  }

  get cheapestOriginalPrice(): number {
    if (this.ticketTypes.length === 0) return 0;
    return this.ticketTypes.reduce(
      (min, t) => Math.min(min, t.price),
      Number.POSITIVE_INFINITY,
    );
  }

  get isTerminal(): boolean {
    return this.status === 'cancelled' || this.status === 'completed';
  }

  static fromMap(id: string, map: Record<string, unknown>): Event {
    return new Event({
      id,
      ownerId: (map.ownerId as string) ?? '',
      title: (map.title as string) ?? '',
      category: ((map.category as string) ?? 'social') as EventCategory,
      date: parseDate(map.date) ?? new Date(0),
      venue: (map.venue as string) ?? '',
      lat: Number(map.lat ?? 0),
      lng: Number(map.lng ?? 0),
      description: (map.description as string) ?? '',
      ticketTypes: ((map.ticketTypes as Record<string, unknown>[]) ?? []).map(
        EventTicket.fromMap,
      ),
      status: ((map.status as string) ?? 'pending_review') as EventStatus,
      coverImageUrl: (map.coverImageUrl as string) ?? '',
      mediaUrls: (map.mediaUrls as string[]) ?? [],
      thankYouMessage: (map.thankYouMessage as string) ?? '',
      featured: map.featured === true,
      featuredUntil: (map.featuredUntil as string) ?? undefined,
      collaboratorIds: (map.collaboratorIds as string[]) ?? [],
    });
  }

  toMap(): Record<string, unknown> {
    return {
      ownerId: this.ownerId,
      title: this.title,
      category: this.category,
      date: this.date.toISOString(),
      venue: this.venue,
      lat: this.lat,
      lng: this.lng,
      description: this.description,
      ticketTypes: this.ticketTypes.map((t) => t.toMap()),
      status: this.status,
      coverImageUrl: this.coverImageUrl,
      mediaUrls: this.mediaUrls,
      thankYouMessage: this.thankYouMessage,
      featured: this.featured,
      featuredUntil: this.featuredUntil ?? null,
      collaboratorIds: this.collaboratorIds,
    };
  }
}

// ---------------------------------------------------------------------------
// Registration / Booking / Payment / Refund
// ---------------------------------------------------------------------------

export class Registration {
  id: string;
  eventId: string;
  userId: string;
  fullName: string;
  phone: string;
  invitedGuestCount: number;
  gender: string;
  dietary: string;
  attendeeType: string;
  organization: string;
  jobTitle: string;
  emergencyContact: string;
  emergencyPhone: string;
  ticketType: string;

  constructor(
    init: Partial<Registration> & { id: string; eventId: string; userId: string; fullName: string },
  ) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.userId = init.userId;
    this.fullName = init.fullName;
    this.phone = init.phone ?? '';
    this.invitedGuestCount = init.invitedGuestCount ?? 0;
    this.gender = init.gender ?? '';
    this.dietary = init.dietary ?? '';
    this.attendeeType = init.attendeeType ?? '';
    this.organization = init.organization ?? '';
    this.jobTitle = init.jobTitle ?? '';
    this.emergencyContact = init.emergencyContact ?? '';
    this.emergencyPhone = init.emergencyPhone ?? '';
    this.ticketType = init.ticketType ?? '';
  }

  static fromMap(id: string, map: Record<string, unknown>): Registration {
    return new Registration({
      id,
      eventId: (map.eventId as string) ?? '',
      userId: (map.userId as string) ?? '',
      fullName: (map.fullName as string) ?? '',
      phone: (map.phone as string) ?? '',
      invitedGuestCount: Number(map.invitedGuestCount ?? 0),
      gender: (map.gender as string) ?? '',
      dietary: (map.dietary as string) ?? '',
      attendeeType: (map.attendeeType as string) ?? '',
      organization: (map.organization as string) ?? '',
      jobTitle: (map.jobTitle as string) ?? '',
      emergencyContact: (map.emergencyContact as string) ?? '',
      emergencyPhone: (map.emergencyPhone as string) ?? '',
      ticketType: (map.ticketType as string) ?? '',
    });
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      fullName: this.fullName,
      phone: this.phone,
      invitedGuestCount: this.invitedGuestCount,
      gender: this.gender,
      dietary: this.dietary,
      attendeeType: this.attendeeType,
      organization: this.organization,
      jobTitle: this.jobTitle,
      emergencyContact: this.emergencyContact,
      emergencyPhone: this.emergencyPhone,
      ticketType: this.ticketType,
    };
  }
}

export type BookingStatus = 'pending' | 'confirmed' | 'payment_failed' | 'cancelled';

export class Booking {
  id: string;
  regId: string;
  eventId: string;
  userId: string;
  status: BookingStatus;
  qrCode: string;
  seatNumber: string;
  checkedIn: boolean;
  checkedInAt?: Date;

  constructor(
    init: Partial<Booking> & { id: string; regId: string; eventId: string; userId: string },
  ) {
    this.id = init.id;
    this.regId = init.regId;
    this.eventId = init.eventId;
    this.userId = init.userId;
    this.status = init.status ?? 'pending';
    this.qrCode = init.qrCode ?? '';
    this.seatNumber = init.seatNumber ?? '';
    this.checkedIn = init.checkedIn ?? false;
    this.checkedInAt = init.checkedInAt;
  }

  static fromMap(id: string, map: Record<string, unknown>): Booking {
    return new Booking({
      id,
      regId: (map.regId as string) ?? '',
      eventId: (map.eventId as string) ?? '',
      userId: (map.userId as string) ?? '',
      status: ((map.status as string) ?? 'pending') as BookingStatus,
      qrCode: (map.qrCode as string) ?? '',
      seatNumber: (map.seatNumber as string) ?? '',
      checkedIn: map.checkedIn === true,
      checkedInAt: parseDate(map.checkedInAt) ?? undefined,
    });
  }

  toMap(): Record<string, unknown> {
    return {
      regId: this.regId,
      eventId: this.eventId,
      userId: this.userId,
      status: this.status,
      qrCode: this.qrCode,
      seatNumber: this.seatNumber,
      checkedIn: this.checkedIn,
      ...(this.checkedInAt ? { checkedInAt: this.checkedInAt.toISOString() } : {}),
    };
  }
}

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

export class Payment {
  id: string;
  bookingId: string;
  amount: number;
  momoRef: string;
  platformFee: number;
  organizerPayout: number;
  status: PaymentStatus;

  constructor(
    init: Partial<Payment> & { id: string; bookingId: string; amount: number },
  ) {
    this.id = init.id;
    this.bookingId = init.bookingId;
    this.amount = init.amount;
    this.momoRef = init.momoRef ?? '';
    this.platformFee = init.platformFee ?? 0;
    this.organizerPayout = init.organizerPayout ?? 0;
    this.status = init.status ?? 'pending';
  }

  static fromMap(id: string, map: Record<string, unknown>): Payment {
    return new Payment({
      id,
      bookingId: (map.bookingId as string) ?? '',
      amount: Number(map.amount ?? 0),
      momoRef: (map.momoRef as string) ?? '',
      platformFee: Number(map.platformFee ?? 0),
      organizerPayout: Number(map.organizerPayout ?? 0),
      status: ((map.status as string) ?? 'pending') as PaymentStatus,
    });
  }

  toMap(): Record<string, unknown> {
    return {
      bookingId: this.bookingId,
      amount: this.amount,
      momoRef: this.momoRef,
      platformFee: this.platformFee,
      organizerPayout: this.organizerPayout,
      status: this.status,
    };
  }
}

export type RefundStatus = 'requested' | 'approved' | 'denied' | 'completed';

export class Refund {
  id: string;
  bookingId: string;
  paymentId: string;
  amount: number;
  status: RefundStatus;
  requestedAt: string;
  resolvedAt?: string;
  denialReason?: string;

  constructor(init: {
    id: string;
    bookingId: string;
    paymentId: string;
    amount: number;
    status: RefundStatus;
    requestedAt: string;
    resolvedAt?: string;
    denialReason?: string;
  }) {
    this.id = init.id;
    this.bookingId = init.bookingId;
    this.paymentId = init.paymentId;
    this.amount = init.amount;
    this.status = init.status;
    this.requestedAt = init.requestedAt;
    this.resolvedAt = init.resolvedAt;
    this.denialReason = init.denialReason;
  }

  static fromMap(id: string, map: Record<string, unknown>): Refund {
    return new Refund({
      id,
      bookingId: (map.bookingId as string) ?? '',
      paymentId: (map.paymentId as string) ?? '',
      amount: Number(map.amount ?? 0),
      status: ((map.status as string) ?? 'requested') as RefundStatus,
      requestedAt: (map.requestedAt as string) ?? '',
      resolvedAt: (map.resolvedAt as string) ?? undefined,
      denialReason: (map.denialReason as string) ?? undefined,
    });
  }

  toMap(): Record<string, unknown> {
    return {
      bookingId: this.bookingId,
      paymentId: this.paymentId,
      amount: this.amount,
      status: this.status,
      requestedAt: this.requestedAt,
      resolvedAt: this.resolvedAt ?? null,
      denialReason: this.denialReason ?? null,
    };
  }
}
