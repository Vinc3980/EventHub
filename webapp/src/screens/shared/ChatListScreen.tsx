import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Check,
  Message,
  MessageTick,
  Routing,
  SearchNormal,
  VolumeHigh,
  VolumeSlash,
} from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { chatService } from '../../services/chatService';
import { CoverMedia, EmptyState, SearchField, Skeleton } from '../../components/ui';
import { useChatMeta, useChats, type ChatMeta } from '../../components/SocialData';
import { type Chat } from '../../models';

type ChatFilter = 'all' | 'unread';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
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

function listTimeLabel(value: Date): string {
  const now = new Date();
  const diff = now.getTime() - value.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  ) {
    return `${Math.floor(minutes / 60)}h`;
  }
  if (Math.floor(diff / 86400000) < 7) return WEEKDAYS[value.getDay()];
  const short = `${value.getDate()} ${MONTHS[value.getMonth()]}`;
  return value.getFullYear() === now.getFullYear() ? short : `${short} ${value.getFullYear()}`;
}

function previewFor(meta: ChatMeta | undefined, uid: string): string {
  const last = meta?.lastMessage;
  if (!last) return 'No messages yet';
  const body = last.text === '' ? 'Photo' : last.text;
  if (last.senderId === uid) return `You: ${body}`;
  return `${meta?.senderName ?? ''}: ${body}`;
}

function ChatAvatar({ coverUrl }: { coverUrl: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-skeleton">
      {coverUrl.trim().length > 0 ? (
        <CoverMedia url={coverUrl} className="h-full w-full object-cover" />
      ) : (
        <Calendar size={22} className="text-textmuted" />
      )}
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center rounded-pill px-4 text-[13px] font-semibold transition-colors duration-200 ${
        active ? 'bg-primary text-white' : 'border border-border bg-surface text-textprimary'
      }`}
    >
      {label}
    </button>
  );
}

export default function ChatListScreen() {
  const { uid } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [query, setQuery] = useState('');

  const { data: chats, error } = useChats(uid);
  const meta = useChatMeta(chats, uid);

  const unreadChats = (chats ?? []).filter((chat) => meta[chat.id]?.unread);
  const base = filter === 'unread' ? unreadChats : chats ?? [];
  const needle = query.trim().toLowerCase();
  const shown =
    needle.length === 0
      ? base
      : base.filter((chat) => (meta[chat.id]?.title ?? 'Event chat').toLowerCase().includes(needle));

  function openChat(chat: Chat) {
    if (!uid) return;
    void chatService.markRead(chat.id, uid);
    navigate(`/chats/${chat.id}`);
  }

  function toggleMute(chat: Chat) {
    if (!uid) return;
    void chatService.toggleMute(chat.id, uid);
  }

  if (error) {
    return <EmptyState title="Could not load chats." />;
  }

  if (chats === undefined) {
    return (
      <div className="flex justify-center py-10" aria-busy="true" aria-label="Loading chats">
        <Skeleton className="h-[72px] w-[240px]" radius="rounded-lg" />
      </div>
    );
  }

  const metaReady = chats.length === 0 || Object.keys(meta).length > 0;

  return (
    <div className="animate-fadeup">
      <div className="flex items-center gap-2">
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip
          label={unreadChats.length > 0 ? `Unread (${unreadChats.length})` : 'Unread'}
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
        />
      </div>

      <div className="mt-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search chats" />
      </div>

      <div className="mt-3">
        {!metaReady ? (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card" aria-busy="true" aria-label="Loading chats">
            {[0, 1, 2].map((n) => (
              <div key={n} className="flex items-center gap-3 px-4 py-3">
                <Skeleton radius="rounded-full" className="h-12 w-12" />
                <span className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </span>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          needle.length > 0 ? (
            <EmptyState
              icon={<SearchNormal size={26} />}
              title="No chats match"
              body={`Nothing found for "${query.trim()}".`}
            />
          ) : filter === 'unread' ? (
            <EmptyState icon={<MessageTick size={26} />} title="You're all caught up" />
          ) : (
            <EmptyState
              icon={<Message size={26} />}
              title="No chats yet"
              body="Your event chats will show up here once you RSVP to something."
              action={
                <button
                  type="button"
                  onClick={() => navigate('/explore')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-base bg-primary px-5 text-button text-white transition-[filter] duration-200 hover:brightness-95"
                >
                  <Routing size={18} />
                  Explore events
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            {shown.map((chat, index) => {
              const entry = meta[chat.id];
              const unread = entry?.unread === true;
              const last = entry?.lastMessage;
              const ownMessage = last !== null && last !== undefined && last.senderId === uid;
              const timeLabel = last ? listTimeLabel(last.timestamp) : '';
              return (
                <div key={chat.id}>
                  {index > 0 && <div className="ml-[92px] h-px bg-border" />}
                  <div
                    className="flex animate-fadeup items-center pr-3"
                    style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(chat)}
                      className="flex min-w-0 flex-1 items-center py-2.5 pl-4 text-left"
                    >
                      <span className="w-4 shrink-0">
                        {unread && (
                          <span
                            className="block h-2 w-2 rounded-full bg-accent"
                            aria-label="Unread"
                          />
                        )}
                      </span>
                      <ChatAvatar coverUrl={entry?.coverUrl ?? ''} />
                      <span className="ml-3 min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-body text-textprimary ${
                              unread ? 'font-bold' : 'font-semibold'
                            }`}
                          >
                            {entry?.title ?? 'Event chat'}
                          </span>
                          {timeLabel && (
                            <span className="shrink-0 text-caption text-textmuted">{timeLabel}</span>
                          )}
                          {ownMessage && (
                            <span
                              className={`shrink-0 ${entry?.readByAll ? 'text-primary' : 'text-textmuted'}`}
                              aria-hidden="true"
                            >
                              <Check size={13} />
                            </span>
                          )}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-caption text-textmuted ${
                            unread ? 'font-bold' : 'font-normal'
                          }`}
                        >
                          {previewFor(entry, uid ?? '')}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMute(chat)}
                      aria-label={entry?.muted ? 'Unmute' : 'Mute'}
                      title={entry?.muted ? 'Unmute' : 'Mute'}
                      className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                        entry?.muted ? 'text-primary' : 'text-textmuted hover:bg-primary-6'
                      }`}
                    >
                      {entry?.muted ? <VolumeSlash size={18} /> : <VolumeHigh size={18} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
