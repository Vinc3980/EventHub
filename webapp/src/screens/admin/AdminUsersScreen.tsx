import { useState } from 'react';
import { Profile2User, Trash } from 'iconsax-react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/live';
import { useToast } from '../../app/ToastProvider';
import {
  Avatar,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  SearchField,
  Skeleton,
  StatusTag,
} from '../../components/ui';
import { User, type Role } from '../../models';

type ActionKind = 'suspend' | 'reinstate' | 'verify' | 'unverify' | 'delete';

interface PendingAction {
  kind: ActionKind;
  user: User;
}

const ROLE_FILTERS = ['All', 'Admin', 'User'];

function roleTone(role: string): string {
  if (role === 'admin') return 'bg-dangerbg text-danger';
  return 'bg-neutralbg text-textmuted';
}

function shortDate(value: Date): string {
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dialogFor(action: PendingAction): {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
} {
  const name = action.user.name || 'this user';
  switch (action.kind) {
    case 'suspend':
      return {
        title: 'Suspend user?',
        body: `${name} will no longer be able to sign in to EventHub.`,
        confirmLabel: 'Suspend',
        danger: true,
      };
    case 'reinstate':
      return {
        title: 'Reinstate user?',
        body: `Restore ${name}'s access to EventHub.`,
        confirmLabel: 'Reinstate',
      };
    case 'verify':
      return {
        title: 'Verify organizer?',
        body: `Mark ${name} as a verified organizer on EventHub.`,
        confirmLabel: 'Verify',
      };
    case 'unverify':
      return {
        title: 'Remove verification?',
        body: `Remove the verified badge from ${name}.`,
        confirmLabel: 'Remove',
      };
    default:
      return {
        title: 'Delete user?',
        body: `This permanently removes ${name} from EventHub. This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      };
  }
}

export default function AdminUsersScreen() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useLiveQuery(async () => {
    const stored = await db.users.toArray();
    return stored
      .map((row) => User.fromMap(String(row.uid ?? ''), row))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter((user) => {
    if (roleFilter !== 'All' && !user.roles.includes(roleFilter.toLowerCase() as Role)) {
      return false;
    }
    if (query.length === 0) return true;
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
  });

  async function runAction() {
    if (!pending) return;
    const { kind, user } = pending;
    setBusy(true);
    try {
      const row = await db.users.get(user.uid);
      if (row) {
        if (kind === 'suspend') {
          await db.users.put({ ...row, suspended: true });
          toast.success('User suspended.');
        } else if (kind === 'reinstate') {
          await db.users.put({ ...row, suspended: false });
          toast.success('User reinstated.');
        } else if (kind === 'verify') {
          await db.users.put({ ...row, verified: true });
          toast.success('Organizer verified.');
        } else if (kind === 'unverify') {
          await db.users.put({ ...row, verified: false });
          toast.success('Verification removed.');
        } else {
          await db.users.delete(user.uid);
          toast.success('User deleted.');
        }
      }
    } catch (error) {
      toast.error(`Could not update user: ${String(error)}`);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  if (!rows) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading users">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const dialog = pending ? dialogFor(pending) : null;

  return (
    <div className="space-y-4 animate-fadeup">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search by name or email..."
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by role">
        {ROLE_FILTERS.map((role) => (
          <Chip
            key={role}
            selected={roleFilter === role}
            onClick={() => setRoleFilter(role)}
          >
            {role}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Profile2User size={26} />} title="No users found." />
      ) : (
        <div className="overflow-x-auto rounded-base border border-border bg-surface shadow-card">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              EventHub users with roles, moderation status and admin actions
            </caption>
            <thead>
              <tr className="border-b border-border bg-background-tinted">
                <th scope="col" className="px-4 py-3 text-section text-textmuted">
                  User
                </th>
                <th scope="col" className="px-4 py-3 text-section text-textmuted">
                  Roles
                </th>
                <th scope="col" className="px-4 py-3 text-section text-textmuted">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-section text-textmuted">
                  Blocked
                </th>
                <th scope="col" className="px-4 py-3 text-section text-textmuted">
                  Joined
                </th>
                <th scope="col" className="px-4 py-3 text-section text-textmuted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.uid}
                  className={`border-b border-border last:border-b-0 ${
                    user.suspended ? 'bg-dangerbg' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={user.name} url={user.avatarUrl} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate text-body font-bold text-textprimary">
                          {user.name}
                        </span>
                        <span className="block truncate text-caption text-textmuted">
                          {user.email}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1.5">
                      {user.roles.length === 0 ? (
                        <span className="text-caption text-textmuted">None</span>
                      ) : (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className={`rounded-sm px-1.5 py-0.5 text-caption font-semibold ${roleTone(
                              role,
                            )}`}
                          >
                            {role}
                          </span>
                        ))
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.suspended ? (
                      <StatusTag status="suspended" />
                    ) : user.verified ? (
                      <span className="text-caption font-semibold text-success">Verified</span>
                    ) : (
                      <span className="text-caption text-textmuted">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body text-textprimary">
                    {user.blockedUids.length}
                  </td>
                  <td className="px-4 py-3 text-caption text-textmuted">
                    {shortDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={user.suspended ? 'primary' : 'danger'}
                        onClick={() =>
                          setPending({ kind: user.suspended ? 'reinstate' : 'suspend', user })
                        }
                      >
                        {user.suspended ? 'Reinstate' : 'Suspend'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPending({ kind: user.verified ? 'unverify' : 'verify', user })
                        }
                      >
                        {user.verified ? 'Verified' : 'Verify'}
                      </Button>
                      <IconButton
                        label={`Delete ${user.name}`}
                        tone="danger"
                        onClick={() => setPending({ kind: 'delete', user })}
                      >
                        <Trash size={18} />
                      </IconButton>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pending != null && dialog != null}
        title={dialog?.title ?? ''}
        body={dialog?.body ?? ''}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        loading={busy}
        onConfirm={() => void runAction()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
