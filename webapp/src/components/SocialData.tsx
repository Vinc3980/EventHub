import { useEffect, useMemo, useState } from 'react';
import type { Observable } from 'dexie';
import { db } from '../db/db';
import { useLive, useLiveQuery } from '../db/live';
import { chatService } from '../services/chatService';
import { followService } from '../services/followService';
import { notificationService } from '../services/notificationService';
import { reviewService } from '../services/reviewService';
import { EventService } from '../services/eventService';
import { RegistrationService } from '../services/registrationService';
import {
  type Booking,
  type Chat,
  Event,
  Message,
  type Notification,
  type Review,
  User,
} from '../models';

const eventService = new EventService();
const registrationService = new RegistrationService();

export interface StreamState<T> {
  data: T | undefined;
  error: boolean;
}

/**
 * Dexie `liveQuery()` resolves its source with `Promise.resolve()`, so an
 * observable-returning service method passed straight into `useLiveQuery`
 * would emit the observable itself. This binds those streams properly.
 */
export function useSocialStream<T>(source: Observable<T> | null, initial?: T): StreamState<T> {
  const [state, setState] = useState<StreamState<T>>({
    data: initial,
    error: false,
  });

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    const sub = source.subscribe({
      next: (value) => {
        if (active) setState({ data: value as T, error: false });
      },
      error: () => {
        if (active) setState((prev) => ({ data: prev.data, error: true }));
      },
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [source]);

  return state;
}

export function useOwnedEvents(ownerId: string | null | undefined): StreamState<Event[]> {
  const source = useMemo(
    () => (ownerId ? eventService.eventsByOwner(ownerId) : null),
    [ownerId],
  );
  return useSocialStream<Event[]>(source);
}

export function useBookings(userId: string | null | undefined): StreamState<Booking[]> {
  const source = useMemo(
    () => (userId ? registrationService.bookingsForUser(userId) : null),
    [userId],
  );
  return useSocialStream<Booking[]>(source);
}

export function useUniqueBookingEventIds(bookings: Booking[] | undefined): string[] {
  return useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const booking of bookings ?? []) {
      if (booking.eventId === '' || seen.has(booking.eventId)) continue;
      seen.add(booking.eventId);
      ids.push(booking.eventId);
    }
    return ids;
  }, [bookings]);
}

export function useEventsByIds(ids: string[]): StreamState<Event[]> {
  const key = ids.join(',');
  const result = useLive<Event[]>(
    async () => {
      const events: Event[] = [];
      const wanted = key === '' ? [] : key.split(',');
      for (const eventId of wanted) {
        const row = await db.events.get(eventId);
        if (row) events.push(Event.fromMap(eventId, row));
      }
      return events;
    },
    [key],
  );
  return { data: result.data, error: result.error !== undefined };
}

export function useUserRow(targetUid: string | null | undefined): User | null | undefined {
  return useLiveQuery<User | null>(
    async () => {
      if (!targetUid) return null;
      const row = await db.users.get(targetUid);
      return row ? User.fromMap(targetUid, row) : null;
    },
    [targetUid],
  );
}

export function useFollowProfiles(
  targetUid: string | null | undefined,
  mode: 'followers' | 'following',
): StreamState<User[]> {
  const source = useMemo(() => {
    if (!targetUid) return null;
    return mode === 'followers'
      ? followService.followerProfiles(targetUid)
      : followService.followingProfiles(targetUid);
  }, [targetUid, mode]);
  return useSocialStream<User[]>(source);
}

export function useIsFollowing(
  followerId: string | null | undefined,
  targetUserId: string | null | undefined,
): boolean {
  const source = useMemo(() => {
    if (!followerId || !targetUserId) return null;
    return followService.isFollowingStream(followerId, targetUserId);
  }, [followerId, targetUserId]);
  return useSocialStream<boolean>(source, false).data ?? false;
}

export function useNotifications(uid: string | null | undefined): StreamState<Notification[]> {
  const source = useMemo(() => (uid ? notificationService.notificationsForUser(uid) : null), [uid]);
  return useSocialStream<Notification[]>(source);
}

export function useOrganizerReviews(
  organizerId: string | null | undefined,
): StreamState<Review[]> {
  const source = useMemo(
    () => (organizerId ? reviewService.reviewsForOrganizer(organizerId) : null),
    [organizerId],
  );
  return useSocialStream<Review[]>(source);
}

export function useChats(uid: string | null | undefined): StreamState<Chat[]> {
  const source = useMemo(() => (uid ? chatService.chatsForUser(uid) : null), [uid]);
  return useSocialStream<Chat[]>(source);
}

export interface ChatMeta {
  title: string;
  coverUrl: string;
  lastMessage: Message | null;
  senderName: string;
  unread: boolean;
  muted: boolean;
  readByAll: boolean;
}

export function useChatMeta(
  chats: Chat[] | undefined,
  uid: string | null | undefined,
): Record<string, ChatMeta> {
  const result = useLive<Record<string, ChatMeta>>(
    async () => {
      const out: Record<string, ChatMeta> = {};
      if (!uid) return out;
      const messageRows = await db.messages.toArray();
      const messageById = new Map<string, Record<string, unknown>>();
      for (const row of messageRows) messageById.set(String(row.id ?? ''), row);
      for (const chat of chats ?? []) {
        const [title, coverUrl, lastMessage, unread, muted, chatRow] = await Promise.all([
          chatService.eventTitleForChat(chat.id),
          chatService.eventCoverForChat(chat.id),
          chatService.lastMessageForChat(chat.id),
          chatService.hasUnread(chat.id, uid),
          chatService.isMuted(chat.id, uid),
          db.chats.get(chat.id),
        ]);
        const members = Array.isArray(chatRow?.memberIds)
          ? (chatRow.memberIds as string[])
          : [];
        const recipients = members.filter((member) => member !== uid);
        const rawLast = lastMessage ? messageById.get(lastMessage.id) : undefined;
        const readBy = Array.isArray(rawLast?.readBy) ? (rawLast.readBy as string[]) : [];
        const readByAll =
          lastMessage !== null &&
          lastMessage.senderId === uid &&
          recipients.length > 0 &&
          recipients.every((member) => readBy.includes(member));
        out[chat.id] = {
          title: title ?? 'Event chat',
          coverUrl,
          lastMessage,
          senderName: lastMessage
            ? await chatService.userName(lastMessage.senderId)
            : '',
          unread,
          muted,
          readByAll,
        };
      }
      return out;
    },
    [chats, uid],
  );
  return result.data ?? {};
}

export interface ThreadMessage {
  message: Message;
  pinned: boolean;
  readBy: string[];
  replyToMessageId?: string;
  replyToPreview?: string;
}

export function useThreadMessages(
  chatId: string | null | undefined,
): StreamState<ThreadMessage[]> {
  const result = useLive<ThreadMessage[]>(
    async () => {
      if (!chatId) return [];
      const rows = await db.messages.toArray();
      const items = rows
        .filter((row) => row.chatId === chatId)
        .map((row) => ({
          message: Message.fromMap(String(row.id ?? ''), row),
          pinned: row.pinned === true,
          readBy: Array.isArray(row.readBy) ? (row.readBy as string[]) : [],
          replyToMessageId:
            typeof row.replyToMessageId === 'string' ? row.replyToMessageId : undefined,
          replyToPreview: typeof row.replyToPreview === 'string' ? row.replyToPreview : undefined,
        }));
      items.sort((a, b) => a.message.timestamp.getTime() - b.message.timestamp.getTime());
      return items;
    },
    [chatId],
  );
  return { data: result.data, error: result.error !== undefined };
}

export interface UserBrief {
  name: string;
  avatarUrl: string;
}

export function useUserDirectory(uids: string[]): Record<string, UserBrief> {
  const key = uids.join(',');
  const result = useLive<Record<string, UserBrief>>(
    async () => {
      const out: Record<string, UserBrief> = {};
      for (const userId of key === '' ? [] : key.split(',')) {
        const row = await db.users.get(userId);
        const name = row && typeof row.name === 'string' && row.name !== '' ? row.name : 'Unknown';
        const avatarUrl =
          row && typeof row.avatarUrl === 'string' ? row.avatarUrl : '';
        out[userId] = { name, avatarUrl };
      }
      return out;
    },
    [key],
  );
  return result.data ?? {};
}

export function useChatRow(
  chatId: string | null | undefined,
): Record<string, unknown> | null | undefined {
  return useLiveQuery(async () => (chatId ? chatService.getChat(chatId) : null), [chatId]);
}

export function useChatHeader(chatId: string | null | undefined): {
  title: string;
  coverUrl: string;
} {
  const title = useLive(
    async () => (await chatService.eventTitleForChat(chatId ?? '')) ?? 'Event chat',
    [chatId],
  );
  const coverUrl = useLive(
    async () => chatService.eventCoverForChat(chatId ?? ''),
    [chatId],
  );
  return {
    title: title.data ?? 'Event chat',
    coverUrl: coverUrl.data ?? '',
  };
}
