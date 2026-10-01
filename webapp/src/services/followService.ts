import { liveQuery, type Observable } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { Follow, Notification, User, type NotificationType } from '../models';

type Row = Record<string, unknown>;

const isString = (value: unknown): value is string => typeof value === 'string';

const rowId = (row: Row): string => String(row.id ?? '');

export class FollowService {
  async isFollowing(followerId: string, targetUserId: string): Promise<boolean> {
    const rows = await db.follows.toArray();
    return rows.some(
      (row) => row.followerId === followerId && row.followingId === targetUserId,
    );
  }

  isFollowingStream(followerId: string, targetUserId: string): Observable<boolean> {
    return liveQuery(async () => {
      const rows = await db.follows.toArray();
      return rows.some(
        (row) => row.followerId === followerId && row.followingId === targetUserId,
      );
    });
  }

  async toggleFollow(followerId: string, targetUserId: string): Promise<boolean> {
    if (followerId === targetUserId) return false;

    const rows = await db.follows.toArray();
    const existing = rows.find(
      (row) => row.followerId === followerId && row.followingId === targetUserId,
    );

    if (existing) {
      await db.follows.delete(rowId(existing));
      await this.decrementCount(targetUserId, 'followers');
      await this.decrementCount(followerId, 'following');
      return false;
    }

    const followId = `${followerId}_${targetUserId}`;
    const follow = new Follow({
      id: followId,
      followerId,
      followingId: targetUserId,
      createdAt: new Date(),
    });
    await db.follows.put({ ...follow.toMap(), id: followId });
    await this.incrementCount(targetUserId, 'followers');
    await this.incrementCount(followerId, 'following');

    const followerProfile = await db.users.get(followerId);
    const followerName =
      followerProfile && isString(followerProfile.name)
        ? followerProfile.name
        : 'Someone';
    await this.saveNotification({
      uid: targetUserId,
      title: 'New follower',
      body: `${followerName} started following you.`,
      type: 'new_follower',
      targetId: followerId,
    });

    return true;
  }

  followingIds(userId: string): Observable<string[]> {
    return liveQuery(async () => {
      const rows = await db.follows.toArray();
      return rows
        .filter((row) => row.followerId === userId)
        .map((row) => row.followingId)
        .filter(isString);
    });
  }

  followerIds(userId: string): Observable<string[]> {
    return liveQuery(async () => {
      const rows = await db.follows.toArray();
      return rows
        .filter((row) => row.followingId === userId)
        .map((row) => row.followerId)
        .filter(isString);
    });
  }

  followingProfiles(userId: string): Observable<User[]> {
    return liveQuery(async () => {
      const rows = await db.follows.toArray();
      const ids = rows
        .filter((row) => row.followerId === userId)
        .map((row) => row.followingId)
        .filter(isString);
      return this.hydrateUsers(ids);
    });
  }

  followerProfiles(userId: string): Observable<User[]> {
    return liveQuery(async () => {
      const rows = await db.follows.toArray();
      const ids = rows
        .filter((row) => row.followingId === userId)
        .map((row) => row.followerId)
        .filter(isString);
      return this.hydrateUsers(ids);
    });
  }

  /**
   * Ranked people-to-follow recommendations: event owners and active posters
   * first, boosted by mutual follows and follower counts. Excludes the current
   * user, people they already follow, and suspended/blocked profiles.
   */
  suggestions(currentUserId: string, limit = 6): Observable<User[]> {
    return liveQuery(() => this.suggestionRows(currentUserId, limit));
  }

  private async suggestionRows(currentUserId: string, limit: number): Promise<User[]> {
    const followRows = await db.follows.toArray();
    const following = new Set(
      followRows
        .filter((row) => row.followerId === currentUserId)
        .map((row) => row.followingId)
        .filter(isString),
    );

    const mutualCount = new Map<string, number>();
    for (const row of followRows) {
      if (!isString(row.followerId) || !following.has(row.followerId)) continue;
      if (!isString(row.followingId)) continue;
      mutualCount.set(row.followingId, (mutualCount.get(row.followingId) ?? 0) + 1);
    }

    const postCounts = new Map<string, number>();
    const posts = await db.posts.toArray();
    for (const post of posts) {
      const authorId = String(post.authorId ?? '');
      if (authorId === '') continue;
      postCounts.set(authorId, (postCounts.get(authorId) ?? 0) + 1);
    }

    // Organizer-ness is owning events now that attendee and organizer share
    // one role, so the "runs events" boost reads the events table instead.
    const eventCounts = new Map<string, number>();
    const events = await db.events.toArray();
    for (const event of events) {
      const ownerId = String(event.ownerId ?? '');
      if (ownerId === '') continue;
      eventCounts.set(ownerId, (eventCounts.get(ownerId) ?? 0) + 1);
    }

    const rows = await db.users.toArray();
    const scored: Array<{ user: User; score: number }> = [];
    for (const row of rows) {
      const uid = isString(row.uid) ? row.uid : '';
      if (uid === '' || uid === currentUserId || following.has(uid)) continue;
      if (row.suspended === true) continue;
      if (Array.isArray(row.blockedUids) && (row.blockedUids as unknown[]).includes(currentUserId)) {
        continue;
      }
      const score =
        Math.min(eventCounts.get(uid) ?? 0, 5) * 6 +
        Math.min(postCounts.get(uid) ?? 0, 10) * 4 +
        Math.min(mutualCount.get(uid) ?? 0, 5) * 8 +
        Math.min(Number(row.followers ?? 0), 100) / 5;
      scored.push({ user: User.fromMap(uid, row), score });
    }

    scored.sort(
      (a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name),
    );
    return scored.slice(0, Math.max(0, limit)).map((entry) => entry.user);
  }

  private async hydrateUsers(userIds: string[]): Promise<User[]> {
    const users: User[] = [];
    for (const uid of userIds) {
      const row = await db.users.get(uid);
      users.push(
        row
          ? User.fromMap(uid, row)
          : new User({ uid, name: 'User', createdAt: new Date(0) }),
      );
    }
    return users;
  }

  private async incrementCount(uid: string, field: 'followers' | 'following'): Promise<void> {
    const existing = await db.users.get(uid);
    if (!existing) return;
    const current = Number(existing[field] ?? 0);
    await db.users.put({ ...existing, uid, [field]: current + 1 });
  }

  private async decrementCount(uid: string, field: 'followers' | 'following'): Promise<void> {
    const existing = await db.users.get(uid);
    if (!existing) return;
    const current = Number(existing[field] ?? 0);
    await db.users.put({
      ...existing,
      uid,
      [field]: Math.min(999999, Math.max(0, current - 1)),
    });
  }

  private async saveNotification(params: {
    uid: string;
    title: string;
    body: string;
    type: string;
    targetId: string;
  }): Promise<void> {
    const notificationId = id('ntf');
    const notification = new Notification({
      id: notificationId,
      userId: params.uid,
      type: params.type as NotificationType,
      title: params.title,
      body: params.body,
      referenceId: params.targetId,
      createdAt: new Date(),
    });
    await db.notifications.put({ ...notification.toMap(), id: notificationId });
  }
}

export const followService = new FollowService();
