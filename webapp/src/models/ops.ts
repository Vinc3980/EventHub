/**
 * Operations models — guest list, invited guests, waitlist, discount codes,
 * schedule items, promotions and payout accounts (mirrors of Dart models).
 */

import { parseDate } from './core';

// ---------------------------------------------------------------------------
// GuestListEntry — organizer-facing, one row per registrant (never persisted
// before payment confirmation; merge is idempotent by regId).
// ---------------------------------------------------------------------------

export class GuestListEntry {
  id: string;
  regId: string;
  eventId: string;
  fullName: string;
  invitedGuestCount: number;
  phone: string;
  organization: string;
  createdAt: Date;
  checkedIn: boolean;
  checkedInAt?: string;

  constructor(init: { id: string; regId: string; eventId: string; fullName: string; createdAt: Date }) {
    this.id = init.id;
    this.regId = init.regId;
    this.eventId = init.eventId;
    this.fullName = init.fullName;
    this.createdAt = init.createdAt;
    this.invitedGuestCount = 0;
    this.phone = '';
    this.organization = '';
    this.checkedIn = false;
  }

  static fromMap(id: string, map: Record<string, unknown>): GuestListEntry {
    const e = new GuestListEntry({
      id,
      regId: (map.regId as string) ?? '',
      eventId: (map.eventId as string) ?? '',
      fullName: (map.fullName as string) ?? '',
      createdAt: parseDate(map.createdAt) ?? new Date(0),
    });
    e.invitedGuestCount = Number(map.invitedGuestCount ?? 0);
    e.phone = (map.phone as string) ?? '';
    e.organization = (map.organization as string) ?? '';
    e.checkedIn = map.checkedIn === true;
    e.checkedInAt = (map.checkedInAt as string) ?? undefined;
    return e;
  }

  toMap(): Record<string, unknown> {
    return {
      regId: this.regId,
      eventId: this.eventId,
      fullName: this.fullName,
      invitedGuestCount: this.invitedGuestCount,
      phone: this.phone,
      organization: this.organization,
      createdAt: this.createdAt.toISOString(),
      checkedIn: this.checkedIn,
      checkedInAt: this.checkedInAt ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// InvitedGuest — explicit guest rows merged into the guest list (idempotent)
// ---------------------------------------------------------------------------

export class InvitedGuest {
  id: string;
  eventId: string;
  name: string;
  status: 'invited' | 'merged';

  constructor(init: { id: string; eventId: string; name: string }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.name = init.name;
    this.status = 'invited';
  }

  static fromMap(id: string, map: Record<string, unknown>): InvitedGuest {
    const g = new InvitedGuest({
      id,
      eventId: (map.eventId as string) ?? '',
      name: (map.name as string) ?? '',
    });
    g.status = ((map.status as string) ?? 'invited') as 'invited' | 'merged';
    return g;
  }

  toMap(): Record<string, unknown> {
    return { eventId: this.eventId, name: this.name, status: this.status };
  }
}

// ---------------------------------------------------------------------------
// WaitlistEntry
// ---------------------------------------------------------------------------

export type WaitlistStatus = 'waiting' | 'promoted' | 'expired' | 'cancelled';

export class WaitlistEntry {
  id: string;
  eventId: string;
  userId: string;
  ticketType: string;
  position: number;
  status: WaitlistStatus;
  createdAt: Date;
  expiresAt?: string;

  constructor(init: {
    id: string;
    eventId: string;
    userId: string;
    ticketType: string;
    position: number;
    createdAt: Date;
  }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.userId = init.userId;
    this.ticketType = init.ticketType;
    this.position = init.position;
    this.status = 'waiting';
    this.createdAt = init.createdAt;
  }

  static fromMap(id: string, map: Record<string, unknown>): WaitlistEntry {
    const w = new WaitlistEntry({
      id,
      eventId: (map.eventId as string) ?? '',
      userId: (map.userId as string) ?? '',
      ticketType: (map.ticketType as string) ?? '',
      position: Number(map.position ?? 1),
      createdAt: parseDate(map.createdAt) ?? new Date(0),
    });
    w.status = ((map.status as string) ?? 'waiting') as WaitlistStatus;
    w.expiresAt = (map.expiresAt as string) ?? undefined;
    return w;
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      ticketType: this.ticketType,
      position: this.position,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// DiscountCode
// ---------------------------------------------------------------------------

export class DiscountCode {
  id: string;
  eventId: string;
  code: string;
  percentOff: number;
  capacity: number;
  used: number;
  expiresAt?: string;
  active: boolean;

  constructor(init: { id: string; eventId: string; code: string; percentOff: number; capacity: number }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.code = init.code;
    this.percentOff = init.percentOff;
    this.capacity = init.capacity;
    this.used = 0;
    this.active = true;
  }

  static fromMap(id: string, map: Record<string, unknown>): DiscountCode {
    const d = new DiscountCode({
      id,
      eventId: (map.eventId as string) ?? '',
      code: (map.code as string) ?? '',
      percentOff: Number(map.percentOff ?? 0),
      capacity: Number(map.capacity ?? 0),
    });
    d.used = Number(map.used ?? 0);
    d.expiresAt = (map.expiresAt as string) ?? undefined;
    d.active = map.active !== false;
    return d;
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      code: this.code,
      percentOff: this.percentOff,
      capacity: this.capacity,
      used: this.used,
      expiresAt: this.expiresAt ?? null,
      active: this.active,
    };
  }
}

// ---------------------------------------------------------------------------
// EventScheduleItem — per-day itinerary (Funerals build straight on this)
// ---------------------------------------------------------------------------

export class EventScheduleItem {
  id: string;
  eventId: string;
  dayLabel: string;
  dayNumber: number;
  time: string;
  title: string;
  details: string;
  order: number;

  constructor(init: {
    id: string;
    eventId: string;
    dayLabel: string;
    dayNumber: number;
    time: string;
    title: string;
    order: number;
  }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.dayLabel = init.dayLabel;
    this.dayNumber = init.dayNumber;
    this.time = init.time;
    this.title = init.title;
    this.details = '';
    this.order = init.order;
  }

  static fromMap(id: string, map: Record<string, unknown>): EventScheduleItem {
    const s = new EventScheduleItem({
      id,
      eventId: (map.eventId as string) ?? '',
      dayLabel: (map.dayLabel as string) ?? '',
      dayNumber: Number(map.dayNumber ?? 1),
      time: (map.time as string) ?? '',
      title: (map.title as string) ?? '',
      order: Number(map.order ?? 0),
    });
    s.details = (map.details as string) ?? '';
    return s;
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      dayLabel: this.dayLabel,
      dayNumber: this.dayNumber,
      time: this.time,
      title: this.title,
      details: this.details,
      order: this.order,
    };
  }
}

// ---------------------------------------------------------------------------
// Promotion — organizer ad / boost campaign (MoMo payments simulated)
// ---------------------------------------------------------------------------

export class Promotion {
  id: string;
  eventId: string;
  ownerId: string;
  package: 'pin' | 'featured_24h' | 'featured_7d' | 'contact';
  amount: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startsAt: string;
  endsAt: string;

  constructor(init: {
    id: string;
    eventId: string;
    ownerId: string;
    package: Promotion['package'];
    amount: number;
    startsAt: string;
    endsAt: string;
  }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.ownerId = init.ownerId;
    this.package = init.package;
    this.amount = init.amount;
    this.status = 'pending';
    this.startsAt = init.startsAt;
    this.endsAt = init.endsAt;
  }

  static fromMap(id: string, map: Record<string, unknown>): Promotion {
    const p = new Promotion({
      id,
      eventId: (map.eventId as string) ?? '',
      ownerId: (map.ownerId as string) ?? '',
      package: ((map.package as string) ?? 'pin') as Promotion['package'],
      amount: Number(map.amount ?? 0),
      startsAt: (map.startsAt as string) ?? '',
      endsAt: (map.endsAt as string) ?? '',
    });
    p.status = ((map.status as string) ?? 'pending') as Promotion['status'];
    return p;
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      ownerId: this.ownerId,
      package: this.package,
      amount: this.amount,
      status: this.status,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
    };
  }
}

// ---------------------------------------------------------------------------
// PayoutAccount — MoMo cash-out account (simulated)
// ---------------------------------------------------------------------------

export class PayoutAccount {
  id: string;
  ownerId: string;
  momoNumber: string;
  momoNetwork: string;
  momoName: string;
  verified: boolean;

  constructor(init: {
    id: string;
    ownerId: string;
    momoNumber: string;
    momoNetwork: string;
    momoName: string;
  }) {
    this.id = init.id;
    this.ownerId = init.ownerId;
    this.momoNumber = init.momoNumber;
    this.momoNetwork = init.momoNetwork;
    this.momoName = init.momoName;
    this.verified = false;
  }

  static fromMap(id: string, map: Record<string, unknown>): PayoutAccount {
    const p = new PayoutAccount({
      id,
      ownerId: (map.ownerId as string) ?? '',
      momoNumber: (map.momoNumber as string) ?? '',
      momoNetwork: (map.momoNetwork as string) ?? '',
      momoName: (map.momoName as string) ?? '',
    });
    p.verified = map.verified === true;
    return p;
  }

  toMap(): Record<string, unknown> {
    return {
      ownerId: this.ownerId,
      momoNumber: this.momoNumber,
      momoNetwork: this.momoNetwork,
      momoName: this.momoName,
      verified: this.verified,
    };
  }
}
