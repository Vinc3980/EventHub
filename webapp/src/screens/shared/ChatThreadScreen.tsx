import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRotateLeft,
  ArrowRight2,
  Calendar,
  Check,
  CloseCircle,
  Copy,
  Flag,
  Lock,
  Send,
} from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { chatService } from '../../services/chatService';
import { db } from '../../db/db';
import { id } from '../../lib/ids';
import { Message } from '../../models';
import { CoverMedia } from '../../components/ui';
import {
  useChatHeader,
  useChatRow,
  useThreadMessages,
  useUserDirectory,
  type ThreadMessage,
} from '../../components/SocialData';

const MONTHS3 = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const GROUP_WINDOW_MS = 120000;
const SWIPE_ARM_PX = 40;
const SWIPE_MAX_PX = 56;
const LONG_PRESS_MS = 600;

type ReadStatus = 'sent' | 'delivered' | 'read';
type MenuAction = 'pin' | 'reply' | 'copy';

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateSeparatorLabel(value: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const short = `${value.getDate()} ${MONTHS3[value.getMonth()]}`;
  return value.getFullYear() === now.getFullYear() ? short : `${short} ${value.getFullYear()}`;
}

function clockLabel(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function statusFor(item: ThreadMessage, members: string[]): ReadStatus {
  const senderId = item.message.senderId;
  const others = members.filter((member) => member !== senderId);
  if (others.length === 0) return 'sent';
  const reads = others.filter((member) => item.readBy.includes(member)).length;
  if (reads === 0) return 'sent';
  return reads === others.length ? 'read' : 'delivered';
}

function Ticks({ status }: { status: ReadStatus }) {
  if (status === 'sent') {
    return <Check size={13} className="text-textmuted" />;
  }
  const color = status === 'read' ? 'text-primary' : 'text-textmuted';
  return (
    <span className={`inline-flex items-center ${color}`} aria-hidden="true">
      <Check size={13} />
      <Check size={13} className="-ml-1.5" />
    </span>
  );
}

function SenderAvatar({ avatarUrl, name }: { avatarUrl: string; name: string }) {
  const initial = name === '' ? '?' : name.charAt(0).toUpperCase();
  return (
    <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-skeleton">
      {avatarUrl.trim().length > 0 ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span className="text-[11px] font-bold text-textprimary">{initial}</span>
      )}
    </span>
  );
}

function MessageBubble({
  item,
  isMe,
  senderName,
  senderAvatarUrl,
  status,
  showSender,
  showTime,
  showAvatar,
  groupedPrev,
  onReply,
  onMenu,
}: {
  item: ThreadMessage;
  isMe: boolean;
  senderName: string;
  senderAvatarUrl: string;
  status: ReadStatus;
  showSender: boolean;
  showTime: boolean;
  showAvatar: boolean;
  groupedPrev: boolean;
  onReply: () => void;
  onMenu: () => void;
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef(0);
  const lastXRef = useRef(0);
  const pressXRef = useRef(0);
  const pressingRef = useRef(false);
  const longPressRef = useRef<number | null>(null);
  const { text, timestamp, pinned } = {
    text: item.message.text,
    timestamp: item.message.timestamp,
    pinned: item.pinned,
  };

  const clampDrag = (value: number): number => {
    if (isMe) return Math.max(-SWIPE_MAX_PX, Math.min(0, value));
    return Math.max(0, Math.min(SWIPE_MAX_PX, value));
  };

  const commitDrag = (next: number) => {
    dragRef.current = next;
    setDragOffset(next);
  };

  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    lastXRef.current = e.clientX;
    pressXRef.current = e.clientX;
    pressingRef.current = true;
    commitDrag(0);
    if (e.pointerType !== 'mouse') {
      longPressRef.current = window.setTimeout(() => {
        pressingRef.current = false;
        longPressRef.current = null;
        onMenu();
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pressingRef.current) return;
    if (Math.abs(e.clientX - pressXRef.current) > 8) clearLongPress();
    const delta = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    commitDrag(clampDrag(dragRef.current + delta));
  };

  const endDrag = () => {
    clearLongPress();
    if (!pressingRef.current) {
      commitDrag(0);
      return;
    }
    pressingRef.current = false;
    const armed = Math.abs(dragRef.current) >= SWIPE_ARM_PX;
    commitDrag(0);
    if (armed) onReply();
  };

  useEffect(() => clearLongPress, []);

  const progress = Math.min(Math.abs(dragOffset) / SWIPE_ARM_PX, 1);
  const radiusClass = isMe ? 'rounded-[16px] rounded-br-[4px]' : 'rounded-[16px] rounded-bl-[4px]';
  const paddingBottom = showTime ? 12 : groupedPrev ? 4 : 10;

  return (
    <div
      className="relative select-none"
      style={{ paddingBottom }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu();
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 flex items-center"
        style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}
        aria-hidden="true"
      >
        <ArrowRotateLeft size={20} className="text-primary" style={{ opacity: progress }} />
      </div>

      <div
        className="relative"
        style={{ transform: `translateX(${dragOffset}px)` }}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className={`flex items-start ${isMe ? 'justify-end' : ''}`}>
          {!isMe && (
            <>
              <span className="h-7 w-7 shrink-0">
                {showAvatar && (
                  <SenderAvatar avatarUrl={senderAvatarUrl} name={senderName} />
                )}
              </span>
              <span className="ml-2 w-2 shrink-0" />
            </>
          )}

          <div className={`min-w-0 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
            {showSender && (
              <div className="max-w-full truncate pb-[3px] text-[11px] font-bold text-primary">
                {senderName}
              </div>
            )}

            <div
              className={`max-w-[75%] border px-[14px] py-[10px] text-left ${radiusClass} ${
                isMe ? 'border-primary bg-primary text-white' : 'border-border bg-surface'
              }`}
            >
              {item.replyToMessageId !== undefined && (
                <div
                  className={`mb-1.5 w-full rounded-sm border-l-[3px] px-2 py-1.5 ${
                    isMe ? 'border-white/70 bg-white/[0.16]' : 'border-primary bg-neutralbg'
                  }`}
                >
                  <p
                    className={`line-clamp-2 text-[12px] leading-[1.3] ${
                      isMe ? 'text-white/70' : 'text-textmuted'
                    }`}
                  >
                    {item.replyToPreview ?? ''}
                  </p>
                </div>
              )}
              <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.35]">{text}</p>
              {pinned && (
                <span className="mt-1 block">
                  <Flag size={10} className="text-primary" />
                </span>
              )}
            </div>
          </div>
        </div>

        {(isMe || showTime) && (
          <div
            className={`mt-[3px] flex min-w-0 items-center gap-[3px] ${
              isMe ? 'justify-end pr-1' : 'justify-start pl-9'
            }`}
          >
            {isMe && <Ticks status={status} />}
            {showTime && (
              <span className="text-[10px] leading-none text-textmuted">
                {clockLabel(timestamp)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatThreadScreen() {
  const { chatId = '' } = useParams();
  const { uid } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null);
  const [menuItem, setMenuItem] = useState<ThreadMessage | null>(null);

  const { title, coverUrl } = useChatHeader(chatId);
  const { data: thread, error } = useThreadMessages(chatId);
  const chatRow = useChatRow(chatId);

  const eventId =
    typeof chatRow?.eventId === 'string' && chatRow.eventId !== '' ? chatRow.eventId : null;
  const readOnly = chatRow?.readOnly === true;
  const createdBy = typeof chatRow?.createdBy === 'string' ? chatRow.createdBy : '';
  const isOrganizer = uid !== null && uid !== undefined && uid === createdBy;
  const members = Array.isArray(chatRow?.memberIds)
    ? (chatRow.memberIds as string[])
    : [];

  const senderIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of thread ?? []) set.add(item.message.senderId);
    if (uid) set.add(uid);
    return [...set];
  }, [thread, uid]);
  const directory = useUserDirectory(senderIds);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = thread?.length ?? 0;

  useEffect(() => {
    if (!uid || chatId === '') return;
    void chatService.markRead(chatId, uid);
    void chatService.markThreadRead(chatId, uid);
  }, [chatId, uid]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messageCount, chatId]);

  async function send() {
    const text = draft.trim();
    if (text === '' || sending || !uid) return;
    const reply = replyTo;
    setSending(true);
    setReplyTo(null);
    setDraft('');

    const clientId = id('msg');
    const message = new Message({
      id: '',
      chatId,
      senderId: uid,
      text,
      timestamp: new Date(),
      status: 'sent',
      clientId,
    });
    await chatService.sendMessage(chatId, message);

    if (reply !== null) {
      const rows = await db.messages.toArray();
      const row = rows.find((candidate) => candidate.clientId === clientId);
      if (row !== undefined && typeof row.id === 'string') {
        await db.messages.update(row.id, {
          replyToMessageId: reply.message.id,
          replyToPreview: reply.message.text,
        });
      }
    }

    await chatService.markRead(chatId, uid);
    setSending(false);
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }

  async function runMenuAction(action: MenuAction) {
    const target = menuItem;
    setMenuItem(null);
    if (target === null) return;
    if (action === 'pin') {
      await chatService.togglePin(target.message.id);
      return;
    }
    if (action === 'reply') {
      setReplyTo(target);
      return;
    }
    void navigator.clipboard.writeText(target.message.text);
    toast.success('Message copied.');
  }

  const pinnedItems = (thread ?? []).filter((item) => item.pinned);
  const regularItems = (thread ?? []).filter((item) => !item.pinned);
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <div className="flex min-h-[calc(100vh-160px)] animate-fadeup flex-col gap-3">
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          disabled={eventId === null}
          onClick={() => eventId !== null && navigate(`/event/${eventId}`)}
          className="flex min-w-0 items-center gap-3 text-left disabled:cursor-default"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-skeleton">
            {coverUrl.trim().length > 0 ? (
              <CoverMedia url={coverUrl} className="h-full w-full object-cover" />
            ) : (
              <Calendar size={14} className="text-textmuted" />
            )}
          </span>
          <span className="min-w-0 truncate text-subtitle text-textprimary">{title}</span>
          {eventId !== null && <ArrowRight2 size={18} className="shrink-0 text-textmuted" />}
        </button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-[240px] max-h-[calc(100vh-340px)] flex-1 overflow-y-auto rounded-lg border border-border bg-primary-6 p-4"
      >
        {error ? (
          <p className="py-10 text-center text-body text-textmuted">Could not load messages.</p>
        ) : thread === undefined ? (
          <div className="flex h-full items-center justify-center" aria-busy="true" aria-label="Loading messages">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : regularItems.length === 0 && pinnedItems.length === 0 ? (
          <p className="py-10 text-center text-body text-textmuted">
            No messages yet.
            <br />
            Send the first message!
          </p>
        ) : (
          <div className="mx-auto max-w-[900px]">
            {pinnedItems.length > 0 && (
              <div className="mb-4 rounded-md border border-primary/20 bg-primary-6 p-3">
                <div className="flex items-center gap-1.5">
                  <Flag size={14} className="text-primary" />
                  <span className="text-[12px] font-bold text-primary">Pinned message</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {pinnedItems.map((item) => (
                    <p key={item.message.id} className="text-[13px] text-textprimary">
                      {item.message.text}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {regularItems.map((item, index) => {
              const prev = index > 0 ? regularItems[index - 1] : null;
              const next =
                index + 1 < regularItems.length ? regularItems[index + 1] : null;
              const msg = item.message;
              const dayChanged = prev !== null && !sameDay(prev.message.timestamp, msg.timestamp);
              const showDate = prev === null || dayChanged;
              const groupedPrev =
                prev !== null &&
                !dayChanged &&
                prev.message.senderId === msg.senderId &&
                msg.timestamp.getTime() - prev.message.timestamp.getTime() < GROUP_WINDOW_MS;
              const groupedNext =
                next !== null &&
                sameDay(msg.timestamp, next.message.timestamp) &&
                next.message.senderId === msg.senderId &&
                next.message.timestamp.getTime() - msg.timestamp.getTime() < GROUP_WINDOW_MS;
              const isMe = msg.senderId === uid;
              const senderName = directory[msg.senderId]?.name ?? 'Unknown';
              const senderAvatarUrl = directory[msg.senderId]?.avatarUrl ?? '';
              const showSender = !isMe && !groupedPrev;
              const status = isMe ? statusFor(item, members) : 'sent';

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-pill border border-border bg-surface px-3 py-[5px] text-[11px] font-semibold text-textmuted">
                        {dateSeparatorLabel(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    item={item}
                    isMe={isMe}
                    senderName={senderName}
                    senderAvatarUrl={senderAvatarUrl}
                    status={status}
                    showSender={showSender}
                    showTime={!groupedNext}
                    showAvatar={!groupedPrev}
                    groupedPrev={groupedPrev}
                    onReply={() => setReplyTo(item)}
                    onMenu={() => setMenuItem(item)}
                  />
                </div>
              );
            })}
            <div className="h-2" />
          </div>
        )}
      </div>

      {readOnly ? (
        <div className="flex items-center justify-center gap-2 rounded-base bg-neutralbg px-4 py-4">
          <Lock size={16} className="shrink-0 text-textmuted" />
          <p className="max-w-full text-center text-[13px] text-textmuted">
            This event has ended — chat is now read-only
          </p>
        </div>
      ) : (
        <div className="rounded-base border border-border bg-surface p-2.5">
          {replyTo !== null && (
            <div className="mb-2 rounded-sm border-l-[3px] border-primary bg-primary-6 px-2 py-2">
                <div className="flex items-start gap-2">
                  <ArrowRotateLeft size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-primary">Replying to</p>
                    <p className="truncate text-[12px] text-textmuted">
                      {replyTo.message.text === '' ? 'Message' : replyTo.message.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel reply"
                    onClick={() => setReplyTo(null)}
                    className="shrink-0 rounded-full p-2 text-textmuted transition-colors duration-200 hover:text-textprimary"
                  >
                    <CloseCircle size={16} />
                  </button>
                </div>
            </div>
          )}

          <div
            className={`flex items-center gap-2 rounded-pill border bg-surface px-3.5 ${
              focused ? 'border-primary outline outline-1 outline-primary' : 'border-border'
            }`}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type a message..."
              aria-label="Message"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-body text-textprimary outline-none placeholder:text-textmuted"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!canSend}
              aria-label="Send message"
              title="Send message"
              className={`my-1 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                canSend || sending ? 'bg-primary' : 'bg-border'
              }`}
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Send size={17} className={draft.trim() !== '' ? 'text-white' : 'text-textmuted'} />
              )}
            </button>
          </div>
        </div>
      )}

      {menuItem !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Message actions"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMenuItem(null)}
            className="absolute inset-0 bg-black/45"
            tabIndex={-1}
          />
          <div className="relative w-full rounded-t-lg bg-surface px-4 pb-6 pt-3 shadow-dark animate-fadeup tablet:max-w-[560px] tablet:rounded-base">
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
            <p className="mb-2 max-h-16 overflow-hidden break-words px-1 text-body text-textmuted">
              {menuItem.message.text}
            </p>
            <div className="divide-y divide-border overflow-hidden rounded-base border border-border">
              {isOrganizer && (
                <button
                  type="button"
                  onClick={() => void runMenuAction('pin')}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
                >
                  <Flag size={20} className="text-primary" />
                  {menuItem.pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void runMenuAction('reply')}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
              >
                <ArrowRotateLeft size={20} className="text-primary" />
                Reply
              </button>
              <button
                type="button"
                onClick={() => void runMenuAction('copy')}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-primary-6"
              >
                <Copy size={20} className="text-primary" />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
