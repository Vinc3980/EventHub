import { liveQuery, type Observable, type Table } from 'dexie';
import { db, getSessionUid, setSessionUid } from '../db/db';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { id, nowIso } from '../lib/ids';

async function readDoc(
  table: Table<Record<string, unknown>, string>,
  key: string,
): Promise<Record<string, unknown> | null> {
  const row = await table.get(key);
  return row ? { ...row } : null;
}

export class AuthService {
  get authStateChanges(): Observable<string | null> {
    return liveQuery(() => getSessionUid());
  }

  async currentUid(): Promise<string | null> {
    return getSessionUid();
  }

  async signUpWithEmail({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      throw new AuthException('invalid-email', 'Enter a valid email address.');
    }
    if (password.length < 6) {
      throw new AuthException(
        'weak-password',
        'Password must be at least 6 characters.',
      );
    }
    const rows = await db.auth.toArray();
    const exists = rows.some((row) => (row.email ?? '').toLowerCase() === cleanEmail);
    if (exists) {
      throw new AuthException(
        'email-already-in-use',
        'An account already exists for this email.',
      );
    }
    const uid = id('usr');
    const passwordHash = await hashPassword(password);
    await db.auth.put({ uid, email: cleanEmail, passwordHash });
    await this.ensureUserRow(uid, cleanEmail);
    await setSessionUid(uid);
    return uid;
  }

  async signInWithEmail({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    const rows = await db.auth.toArray();
    const entry = rows.find((row) => (row.email ?? '').toLowerCase() === cleanEmail);
    if (!entry) {
      throw new AuthException('user-not-found', 'No account found for this email.');
    }
    const matches = await verifyPassword(password, entry.passwordHash);
    if (!matches) {
      throw new AuthException('wrong-password', 'Incorrect password.');
    }
    await this.ensureUserRow(entry.uid, entry.email);
    await setSessionUid(entry.uid);
    return entry.uid;
  }

  async signOut(): Promise<void> {
    await setSessionUid(null);
  }

  /**
   * Accounts always have a profile row: created at sign-up, and backfilled on
   * sign-in for accounts that predate the attendee/organizer role merge.
   */
  private async ensureUserRow(uid: string, email: string): Promise<void> {
    const existing = await db.users.get(uid);
    if (existing) return;
    await db.users.put(AuthService.blankUserRow(uid, email));
  }

  private static blankUserRow(uid: string, email: string): Record<string, unknown> {
    const local = email.split('@')[0] ?? 'Guest';
    return {
      uid,
      name: local,
      phone: '',
      email,
      roles: ['user'],
      bio: '',
      avatarUrl: '',
      bannerUrl: '',
      followers: 0,
      following: 0,
      savedEventIds: [],
      remindersEnabled: true,
      messageNotifsEnabled: true,
      followerNotifsEnabled: true,
      promoNotifsEnabled: false,
      blockedUids: [],
      savedMomoNumber: '',
      savedMomoNetwork: '',
      createdAt: nowIso(),
    };
  }

  async completeProfile({
    uid,
    name,
    roles = ['user'],
  }: {
    uid: string;
    name: string;
    roles?: string[];
  }): Promise<void> {
    const existing = await db.users.get(uid);
    if (existing) {
      const existingRoles = (existing.roles as string[]) ?? [];
      const mergedRoles = Array.from(new Set([...existingRoles, ...roles]));
      await db.users.put({ ...existing, name, roles: mergedRoles });
      return;
    }
    const authRow = await db.auth.get(uid);
    await db.users.put({
      ...AuthService.blankUserRow(uid, authRow?.email ?? ''),
      name,
      roles: Array.from(new Set(['user', ...roles])),
    });
  }

  async fetchUserProfile(uid: string): Promise<Record<string, unknown> | null> {
    return readDoc(db.users, uid);
  }

  async toggleSaveEvent(uid: string, eventId: string): Promise<string[]> {
    const existing = await db.users.get(uid);
    if (!existing) return [];
    const saved = [...((existing.savedEventIds as string[]) ?? [])];
    const index = saved.indexOf(eventId);
    if (index >= 0) {
      saved.splice(index, 1);
    } else {
      saved.push(eventId);
    }
    await db.users.put({ ...existing, savedEventIds: saved });
    return saved;
  }

  async updateProfile({
    uid,
    name,
    phone,
    bio,
    avatarUrl,
  }: {
    uid: string;
    name?: string;
    phone?: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<void> {
    const existing = await db.users.get(uid);
    if (!existing) return;
    const data: Record<string, unknown> = { ...existing };
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (bio !== undefined) data.bio = bio;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    await db.users.put(data);
  }

  async setRemindersEnabled(uid: string, enabled: boolean): Promise<void> {
    const existing = await db.users.get(uid);
    if (!existing) return;
    await db.users.put({ ...existing, remindersEnabled: enabled });
  }

  static readonly notificationPrefKeys: ReadonlySet<string> = new Set([
    'messageNotifsEnabled',
    'followerNotifsEnabled',
    'promoNotifsEnabled',
  ]);

  async setNotificationPref(uid: string, key: string, value: boolean): Promise<void> {
    if (!AuthService.notificationPrefKeys.has(key)) return;
    const existing = await db.users.get(uid);
    if (!existing) return;
    await db.users.put({ ...existing, [key]: value });
  }

  async blockUser(uid: string, targetUid: string): Promise<string[]> {
    const existing = await db.users.get(uid);
    if (!existing || targetUid.length === 0) return [];
    const blocked = [...((existing.blockedUids as string[]) ?? [])];
    if (!blocked.includes(targetUid)) blocked.push(targetUid);
    await db.users.put({ ...existing, blockedUids: blocked });
    return blocked;
  }

  async unblockUser(uid: string, targetUid: string): Promise<string[]> {
    const existing = await db.users.get(uid);
    if (!existing) return [];
    const blocked = [...((existing.blockedUids as string[]) ?? [])];
    const index = blocked.indexOf(targetUid);
    if (index >= 0) blocked.splice(index, 1);
    await db.users.put({ ...existing, blockedUids: blocked });
    return blocked;
  }

  async hasBlocked(uid: string, targetUid: string): Promise<boolean> {
    const existing = await db.users.get(uid);
    if (!existing) return false;
    const blocked = [...((existing.blockedUids as string[]) ?? [])];
    return blocked.includes(targetUid);
  }

  async setSavedMomo(
    uid: string,
    options: { number: string; network: string },
  ): Promise<void> {
    const existing = await db.users.get(uid);
    if (!existing) return;
    await db.users.put({
      ...existing,
      savedMomoNumber: options.number,
      savedMomoNetwork: options.network,
    });
  }

  async changePassword({
    uid,
    currentPassword,
    newPassword,
  }: {
    uid: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const entry = await db.auth.get(uid);
    if (!entry) {
      throw new AuthException(
        'user-not-found',
        'No account found for this user.',
      );
    }
    const matches = await verifyPassword(currentPassword, entry.passwordHash);
    if (!matches) {
      throw new AuthException('wrong-password', 'Current password is incorrect.');
    }
    if (newPassword.length < 6) {
      throw new AuthException(
        'weak-password',
        'Password must be at least 6 characters.',
      );
    }
    await db.auth.put({ ...entry, passwordHash: await hashPassword(newPassword) });
  }

  static friendlyMessage(error: unknown): string {
    if (error instanceof AuthException) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }
}

export class AuthException extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthException';
    this.code = code;
  }

  toString(): string {
    return this.message;
  }
}
