import { useParams, useNavigate } from 'react-router-dom';
import { Profile2User } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { Avatar, EmptyState, Skeleton } from '../../components/ui';
import { SocialFollowPill } from '../../components/SocialProfile';
import { useFollowProfiles } from '../../components/SocialData';

export default function FollowListScreen({ mode }: { mode: 'followers' | 'following' }) {
  const { uid: target } = useParams<{ uid: string }>();
  const { uid: me } = useAuth();
  const navigate = useNavigate();
  const { data: users, error } = useFollowProfiles(target, mode);

  if (error) {
    return <EmptyState title="Could not load list." />;
  }

  if (users === undefined) {
    return (
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card" aria-busy="true" aria-label="Loading list">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3 px-4 py-3">
            <Skeleton radius="rounded-full" className="h-10 w-10" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Profile2User size={26} />}
        title={mode === 'followers' ? 'No followers yet' : 'Not following anyone'}
        body={
          mode === 'followers'
            ? "When people follow you, they'll appear here."
            : "When you follow people, they'll appear here."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {users.map((person, index) => {
        const isSelf = person.uid === me;
        const subtitle = person.bio.trim().length > 0 ? person.bio : person.email;
        return (
          <div
            key={person.uid}
            className={`flex animate-fadeup items-center gap-3 px-4 py-3 ${
              index > 0 ? 'border-t border-border' : ''
            }`}
            style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
          >
            <button
              type="button"
              disabled={isSelf || person.uid === ''}
              onClick={() => navigate(`/u/${person.uid}`)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
            >
              <Avatar name={person.name || 'User'} url={person.avatarUrl} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-textprimary">
                  {person.name || 'User'}
                </span>
                <span className="block truncate text-caption text-textmuted">{subtitle}</span>
              </span>
            </button>
            {!isSelf && (
              <SocialFollowPill targetUserId={person.uid} currentUserId={me ?? ''} />
            )}
          </div>
        );
      })}
    </div>
  );
}
