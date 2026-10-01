import { liveQuery, type Observable } from 'dexie';
import { MESSAGE_DELAY_MS } from '../lib/constants';
import { id, nowIso } from '../lib/ids';
import { db } from '../db/db';
import { Chat, Message } from '../models';

type Row = Record<string, unknown>;

const isString = (value: unknown): value is string => typeof value === 'string';

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];

const asRecord = (value: unknown): Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Row)
    : {};

const asCountMap = (value: unknown): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    const parsed = Number(raw);
    counts[key] = Number.isFinite(parsed) ? parsed : 0;
  }
  return counts;
};

const rowId = (row: Row): string => String(row.id ?? '');

const membersOf = (row: Row): string[] => {
  const members = new Set<string>(asStringList(row.memberIds));
  for (const member of asStringList(row.attendeeIds)) members.add(member);
  const organizerId = isString(row.organizerId) ? row.organizerId : '';
  if (organizerId !== '') members.add(organizerId);
  return [...members];
};

export class ChatService {
  async findChatForEvent(eventId: string): Promise<string | null> {
    const rows = await db.chats.toArray();
    for (const row of rows) {
      if (row.eventId === eventId) return rowId(row);
    }
    return null;
  }

  async getChat(chatId: string): Promise<Row | null> {
    const row = await db.chats.get(chatId);
    return row ?? null;
  }

  async ensureChatForEvent(opts: {
    eventId: string;
    userId: string;
    ownerId?: string | null;
  }): Promise<string> {
    const { eventId, userId } = opts;
    const ownerId = opts.ownerId ?? null;
    const existingId = await this.findChatForEvent(eventId);
    if (existingId !== null) {
      const chat = await this.getChat(existingId);
      if (chat !== null) {
        const members = new Set(membersOf(chat));
        members.add(userId);
        const organizerId = isString(chat.organizerId) ? chat.organizerId : '';
        const organizer = organizerId !== '' ? organizerId : userId;
        await db.chats.put({
          ...chat,
          memberIds: [...members],
          organizerId: organizer,
          attendeeIds: [...members].filter((member) => member !== organizer),
        });
        return existingId;
      }
    }
    const chatId = id('chat');
    const organizer = ownerId !== null && ownerId !== '' ? ownerId : userId;
    const members = new Set<string>();
    if (ownerId !== null && ownerId !== '') members.add(ownerId);
    members.add(userId);
    const chat = new Chat({
      id: chatId,
      eventId,
      organizerId: organizer,
      attendeeIds: [...members].filter((member) => member !== organizer),
    });
    await db.chats.put({
      ...chat.toMap(),
      id: chatId,
      memberIds: [...members],
      type: 'group',
      createdBy: ownerId ?? userId,
      readOnly: false,
      lastReadAt: {},
      mutedBy: [],
    });
    return chatId;
  }

  chatsForUser(userId: string): Observable<Chat[]> {
    return liveQuery(async () => {
      const rows = await db.chats.toArray();
      const chats = rows
        .filter((row) => {
          const members = asStringList(row.memberIds);
          if (members.length > 0) return members.includes(userId);
          const organizerId = isString(row.organizerId) ? row.organizerId : '';
          return (
            organizerId === userId || asStringList(row.attendeeIds).includes(userId)
          );
        })
        .map((row) => Chat.fromMap(rowId(row), row));
      const times = new Map<string, number>();
      for (const chat of chats) {
        times.set(chat.id, (await this.lastMessageTime(chat.id)).getTime());
      }
      chats.sort(
        (a, b) => (times.get(b.id) ?? 0) - (times.get(a.id) ?? 0),
      );
      return chats;
    });
  }

  private async lastMessageTime(chatId: string): Promise<Date> {
    const rows = await db.messages.toArray();
    let latest = new Date(0);
    for (const row of rows) {
      if (row.chatId !== chatId) continue;
      const message = Message.fromMap(rowId(row), row);
      if (message.timestamp.getTime() > latest.getTime()) latest = message.timestamp;
    }
    return latest;
  }

  async lastMessageForChat(chatId: string): Promise<Message | null> {
    const rows = await db.messages.toArray();
    let latest: Message | null = null;
    for (const row of rows) {
      if (row.chatId !== chatId) continue;
      const message = Message.fromMap(rowId(row), row);
      if (latest === null || message.timestamp.getTime() > latest.timestamp.getTime()) {
        latest = message;
      }
    }
    return latest;
  }

  async markRead(chatId: string, userId: string): Promise<void> {
    const chat = await this.getChat(chatId);
    if (chat === null) return;
    const lastReadAt: Record<string, unknown> = { ...asRecord(chat.lastReadAt) };
    lastReadAt[userId] = nowIso();
    const unreadCounts = asCountMap(chat.unreadCounts);
    unreadCounts[userId] = 0;
    await db.chats.put({ ...chat, lastReadAt, unreadCounts });
  }

  async markThreadRead(chatId: string, userId: string): Promise<void> {
    const rows = await db.messages.toArray();
    for (const row of rows) {
      if (row.chatId !== chatId || row.senderId === userId) continue;
      const readBy = asStringList(row.readBy);
      if (readBy.includes(userId)) continue;
      readBy.push(userId);
      await db.messages.put({ ...row, readBy });
    }
  }

  async toggleMute(chatId: string, userId: string): Promise<void> {
    const chat = await this.getChat(chatId);
    if (chat === null) return;
    const mutedBy = asStringList(chat.mutedBy);
    const index = mutedBy.indexOf(userId);
    if (index >= 0) {
      mutedBy.splice(index, 1);
    } else {
      mutedBy.push(userId);
    }
    await db.chats.put({ ...chat, mutedBy, isMuted: mutedBy.includes(userId) });
  }

  async isMuted(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.getChat(chatId);
    if (chat === null) return false;
    const mutedBy = asStringList(chat.mutedBy);
    if (mutedBy.includes(userId)) return true;
    return mutedBy.length === 0 && chat.isMuted === true;
  }

  async hasUnread(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.getChat(chatId);
    if (chat === null) return false;
    const lastReadAt = asRecord(chat.lastReadAt);
    const rawReadTime = lastReadAt[userId];
    const readTime = isString(rawReadTime) ? new Date(rawReadTime) : null;
    const rows = await db.messages.toArray();
    if (readTime === null || Number.isNaN(readTime.getTime())) {
      return rows.some((row) => row.chatId === chatId && row.senderId !== userId);
    }
    return rows.some((row) => {
      if (row.chatId !== chatId || row.senderId === userId) return false;
      const message = Message.fromMap(rowId(row), row);
      return message.timestamp.getTime() > readTime.getTime();
    });
  }

  async eventTitleForChat(chatId: string): Promise<string | null> {
    const chat = await this.getChat(chatId);
    if (chat === null) return null;
    if (!isString(chat.eventId)) return null;
    const event = await db.events.get(chat.eventId);
    if (!event) return null;
    return isString(event.title) ? event.title : null;
  }

  async eventCoverForChat(chatId: string): Promise<string> {
    const chat = await this.getChat(chatId);
    if (chat === null) return '';
    if (!isString(chat.eventId)) return '';
    const event = await db.events.get(chat.eventId);
    if (!event) return '';
    return isString(event.coverImageUrl) ? event.coverImageUrl : '';
  }

  async userName(uid: string): Promise<string> {
    const user = await db.users.get(uid);
    if (!user) return 'Unknown';
    return isString(user.name) ? user.name : 'Unknown';
  }

  async userAvatarUrl(uid: string): Promise<string> {
    const user = await db.users.get(uid);
    if (!user) return '';
    return isString(user.avatarUrl) ? user.avatarUrl : '';
  }

  async togglePin(messageId: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) return;
    await db.messages.put({
      ...message,
      pinned: !(message.pinned === true),
    });
  }

  async sendMessage(chatId: string, message: Message): Promise<void> {
    const messageId = id('msg');
    await db.messages.put({
      ...message.toMap(),
      id: messageId,
      chatId,
      status: 'sending',
    });
    // SIMULATED
    setTimeout(() => {
      void db.messages.update(messageId, { status: 'sent' });
    }, MESSAGE_DELAY_MS);
    const chat = await this.getChat(chatId);
    if (chat === null) return;
    const unreadCounts = asCountMap(chat.unreadCounts);
    for (const member of membersOf(chat)) {
      if (member !== message.senderId) {
        unreadCounts[member] = (unreadCounts[member] ?? 0) + 1;
      }
    }
    await db.chats.put({
      ...chat,
      lastMessage: message.text,
      lastMessageAt: message.timestamp.toISOString(),
      unreadCounts,
    });
  }

  messagesForChat(chatId: string): Observable<Message[]> {
    return liveQuery(async () => {
      const rows = await db.messages.toArray();
      const messages = rows
        .filter((row) => row.chatId === chatId)
        .map((row) => Message.fromMap(rowId(row), row));
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return messages;
    });
  }
}

export const chatService = new ChatService();
