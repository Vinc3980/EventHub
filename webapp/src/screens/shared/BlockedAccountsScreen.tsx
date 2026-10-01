import { useMemo } from 'react';
import { UserMinus } from 'iconsax-react';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { AuthService } from '../../services/authService';
import { User } from '../../models';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { Avatar, Button, EmptyState, Skeleton } from '../../components/ui';

export default function BlockedAccountsScreen() {
  const { uid, user } = useAuth();
  const authService = useMemo(() => new AuthService(), []);
  const { toast } = useToast();

  const blockedKey = (user?.blockedUids ?? []).join(',');

  const blocked = useLiveQuery<User[]>(
    async () => {
      const ids = blockedKey.length > 0 ? blockedKey.split(',') : [];
      const rows: User[] = [];
      for (const id of ids) {
        const row = await db.users.get(id);
        rows.push(
          row
            ? User.fromMap(id, row)
            : new User({ uid: id, name: 'Unknown', createdAt: new Date(0) }),
        );
      }
      return rows;
    },
    [blockedKey],
  );

  async function unblock(target: User) {
    if (!uid) return;
    await authService.unblockUser(uid, target.uid);
    toast(`Unblocked ${target.name || 'user'}.`);
  }

  if (!user || blocked === undefined) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading blocked accounts">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (blocked.length === 0) {
    return (
      <EmptyState icon={<UserMinus size={26} />} title="You haven't blocked anyone." />
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {blocked.map((account) => (
          <div key={account.uid} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={account.name} url={account.avatarUrl} size={40} />
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-textprimary">
              {account.name || 'Unknown'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void unblock(account)}>
              Unblock
            </Button>
          </div>
        ))}
      </div>

      <p className="px-1 text-caption text-textmuted">
        Blocked people can't interact with you until you unblock them again.
      </p>
    </div>
  );
}
