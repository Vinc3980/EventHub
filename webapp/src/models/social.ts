/**
 * Social + moderation models — mirrors of the Dart models in `lib/models/`
 * covering chat, posts, reviews, reports, follows and notifications.
 */

import { parseDate } from './core';

// ---------------------------------------------------------------------------
// Message / Chat
// ---------------------------------------------------------------------------

export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export class Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  status: MessageStatus;
  clientId?: string;

  constructor(
    init: Partial<Message> & { id: string; chatId: string; senderId: string; text: string },
  ) {
    this.id = init.id;
    this.chatId = init.chatId;
    this.senderId = init.senderId;
    this.text = init.text;
    this.timestamp = init.timestamp ?? new Date();
    this.status = init.status ?? 'sent';
    this.clientId = init.clientId;
  }

  static fromMap(id: string, map: Record<string, unknown>): Message {
    return new Message({
      id,
      chatId: (map.chatId as string) ?? '',
      senderId: (map.senderId as string) ?? '',
      text: (map.text as string) ?? '',
      timestamp: parseDate(map.timestamp) ?? new Date(0),
      status: ((map.status as string) ?? 'sent') as MessageStatus,
      clientId: (map.clientId as string) ?? undefined,
    });
  }

  toMap(): Record<string, unknown> {
    return {
      chatId: this.chatId,
      senderId: this.senderId,
      text: this.text,
      timestamp: this.timestamp.toISOString(),
      status: this.status,
      clientId: this.clientId ?? null,
    };
  }
}

export class Chat {
  id: string;
  eventId: string;
  organizerId: string;
  attendeeIds: string[];
  lastMessage: string;
  lastMessageAt: Date;
  /** attendee-side unread count, keyed by uid (local, since there is no backend) */
  unreadCounts: Record<string, number>;
  isPinned: boolean;
  isMuted: boolean;
  isBroadcast: boolean;

  constructor(init: Partial<Chat> & { id: string; eventId: string; organizerId: string }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.organizerId = init.organizerId;
    this.attendeeIds = init.attendeeIds ?? [];
    this.lastMessage = init.lastMessage ?? '';
    this.lastMessageAt = init.lastMessageAt ?? new Date();
    this.unreadCounts = init.unreadCounts ?? {};
    this.isPinned = init.isPinned ?? false;
    this.isMuted = init.isMuted ?? false;
    this.isBroadcast = init.isBroadcast ?? false;
  }

  static fromMap(id: string, map: Record<string, unknown>): Chat {
    return new Chat({
      id,
      eventId: (map.eventId as string) ?? '',
      organizerId: (map.organizerId as string) ?? '',
      attendeeIds: (map.attendeeIds as string[]) ?? [],
      lastMessage: (map.lastMessage as string) ?? '',
      lastMessageAt: parseDate(map.lastMessageAt) ?? new Date(0),
      unreadCounts: (map.unreadCounts as Record<string, number>) ?? {},
      isPinned: map.isPinned === true,
      isMuted: map.isMuted === true,
      isBroadcast: map.isBroadcast === true,
    });
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      organizerId: this.organizerId,
      attendeeIds: this.attendeeIds,
      lastMessage: this.lastMessage,
      lastMessageAt: this.lastMessageAt.toISOString(),
      unreadCounts: this.unreadCounts,
      isPinned: this.isPinned,
      isMuted: this.isMuted,
      isBroadcast: this.isBroadcast,
    };
  }
}

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

/** A single comment hanging off a feed post (rows are embedded, not a table). */
export interface PostComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string; // ISO
}

export class Post {
  id: string;
  authorId: string;
  eventId?: string;
  text: string;
  mediaUrl: string;
  isVideo: boolean;
  timestamp: Date;
  likeIds: string[];
  commentCount: number;
  comments: PostComment[];

  constructor(init: Partial<Post> & { id: string; authorId: string; text: string }) {
    this.id = init.id;
    this.authorId = init.authorId;
    this.eventId = init.eventId;
    this.text = init.text;
    this.mediaUrl = init.mediaUrl ?? '';
    this.isVideo = init.isVideo ?? false;
    this.timestamp = init.timestamp ?? new Date();
    this.likeIds = init.likeIds ?? [];
    this.comments = init.comments ?? [];
    // Older rows (and callers that only pass `comments`) keep the denormalised
    // counter in step with the embedded list.
    this.commentCount = init.commentCount ?? this.comments.length;
  }

  static fromMap(id: string, map: Record<string, unknown>): Post {
    const comments = Array.isArray(map.comments) ? (map.comments as PostComment[]) : [];
    return new Post({
      id,
      authorId: (map.authorId as string) ?? '',
      eventId: (map.eventId as string) ?? undefined,
      text: (map.text as string) ?? '',
      mediaUrl: (map.mediaUrl as string) ?? '',
      isVideo: map.isVideo === true,
      timestamp: parseDate(map.timestamp) ?? new Date(0),
      likeIds: (map.likeIds as string[]) ?? [],
      comments,
      // Rows written before embedded comments existed keep their stored count.
      commentCount: Array.isArray(map.comments)
        ? comments.length
        : Number(map.commentCount ?? 0),
    });
  }

  toMap(): Record<string, unknown> {
    return {
      authorId: this.authorId,
      eventId: this.eventId ?? null,
      text: this.text,
      mediaUrl: this.mediaUrl,
      isVideo: this.isVideo,
      timestamp: this.timestamp.toISOString(),
      likeIds: this.likeIds,
      commentCount: this.commentCount,
      comments: this.comments,
    };
  }
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export class Review {
  id: string;
  eventId: string;
  userId: string;
  rating: number;
  comment: string;
  timestamp: Date;

  constructor(init: {
    id: string;
    eventId: string;
    userId: string;
    rating: number;
    comment: string;
    timestamp: Date;
  }) {
    this.id = init.id;
    this.eventId = init.eventId;
    this.userId = init.userId;
    this.rating = init.rating;
    this.comment = init.comment;
    this.timestamp = init.timestamp;
  }

  static fromMap(id: string, map: Record<string, unknown>): Review {
    return new Review({
      id,
      eventId: (map.eventId as string) ?? '',
      userId: (map.userId as string) ?? '',
      rating: Number(map.rating ?? 0),
      comment: (map.comment as string) ?? '',
      timestamp: parseDate(map.timestamp) ?? new Date(0),
    });
  }

  toMap(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      userId: this.userId,
      rating: this.rating,
      comment: this.comment,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'scam'
  | 'inappropriate'
  | 'impersonation'
  | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export class Report {
  id: string;
  targetType: 'event' | 'user';
  targetId: string;
  reporterId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: Date;
  resolutionNote?: string;

  constructor(init: {
    id: string;
    targetType: 'event' | 'user';
    targetId: string;
    reporterId: string;
    reason: ReportReason;
    details: string;
    createdAt: Date;
  }) {
    this.id = init.id;
    this.targetType = init.targetType;
    this.targetId = init.targetId;
    this.reporterId = init.reporterId;
    this.reason = init.reason;
    this.details = init.details;
    this.createdAt = init.createdAt;
    this.status = 'open';
  }

  static fromMap(id: string, map: Record<string, unknown>): Report {
    const r = new Report({
      id,
      targetType: ((map.targetType as string) ?? 'event') as 'event' | 'user',
      targetId: (map.targetId as string) ?? '',
      reporterId: (map.reporterId as string) ?? '',
      reason: ((map.reason as string) ?? 'other') as ReportReason,
      details: (map.details as string) ?? '',
      createdAt: parseDate(map.createdAt) ?? new Date(0),
    });
    r.status = ((map.status as string) ?? 'open') as ReportStatus;
    r.resolutionNote = (map.resolutionNote as string) ?? undefined;
    return r;
  }

  toMap(): Record<string, unknown> {
    return {
      targetType: this.targetType,
      targetId: this.targetId,
      reporterId: this.reporterId,
      reason: this.reason,
      details: this.details,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      resolutionNote: this.resolutionNote ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// Follow
// ---------------------------------------------------------------------------

export class Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;

  constructor(init: { id: string; followerId: string; followingId: string; createdAt: Date }) {
    this.id = init.id;
    this.followerId = init.followerId;
    this.followingId = init.followingId;
    this.createdAt = init.createdAt;
  }

  static fromMap(id: string, map: Record<string, unknown>): Follow {
    return new Follow({
      id,
      followerId: (map.followerId as string) ?? '',
      followingId: (map.followingId as string) ?? '',
      createdAt: parseDate(map.createdAt) ?? new Date(0),
    });
  }

  toMap(): Record<string, unknown> {
    return {
      followerId: this.followerId,
      followingId: this.followingId,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'event_reminder'
  | 'new_follow'
  | 'order_update'
  | 'moderation'
  | 'message'
  | 'review';

export class Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  deepLink?: string;
  read: boolean;
  createdAt: Date;

  constructor(init: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    createdAt: Date;
    referenceId?: string;
    deepLink?: string;
  }) {
    this.id = init.id;
    this.userId = init.userId;
    this.type = init.type;
    this.title = init.title;
    this.body = init.body;
    this.referenceId = init.referenceId;
    this.deepLink = init.deepLink;
    this.read = false;
    this.createdAt = init.createdAt;
  }

  static fromMap(id: string, map: Record<string, unknown>): Notification {
    const n = new Notification({
      id,
      userId: (map.userId as string) ?? '',
      type: ((map.type as string) ?? 'order_update') as NotificationType,
      title: (map.title as string) ?? '',
      body: (map.body as string) ?? '',
      referenceId: (map.referenceId as string) ?? undefined,
      deepLink: (map.deepLink as string) ?? undefined,
      createdAt: parseDate(map.createdAt) ?? new Date(0),
    });
    n.read = map.read === true;
    return n;
  }

  toMap(): Record<string, unknown> {
    return {
      userId: this.userId,
      type: this.type,
      title: this.title,
      body: this.body,
      referenceId: this.referenceId ?? null,
      deepLink: this.deepLink ?? null,
      read: this.read,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
