import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { resetDatabase } from '../../test/setup';
import { firstValue } from '../../test/helpers';
import { followService } from '../followService';
import { seedIfEmpty } from '../seedService';

describe('followService.suggestions', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('recommends people the user is not following, ranked and limited', async () => {
    await seedIfEmpty();

    const suggestions = await firstValue(followService.suggestions('att-14', 6));

    expect(suggestions).toHaveLength(6);
    expect(suggestions.some((user) => user.uid === 'att-14')).toBe(false);
    // Event owners are boosted (there is no organizer role anymore) — most of
    // the top list should be people who run events.
    const ownerIds = new Set((await db.events.toArray()).map((event) => String(event.ownerId)));
    expect(suggestions.filter((user) => ownerIds.has(user.uid)).length).toBeGreaterThanOrEqual(4);

    const again = await firstValue(followService.suggestions('att-14', 6));
    expect(again.map((user) => user.uid)).toEqual(suggestions.map((user) => user.uid));
  });

  it('excludes people the current user already follows', async () => {
    await seedIfEmpty();

    const before = await firstValue(followService.suggestions('att-14', 12));
    const target = before[0];

    await followService.toggleFollow('att-14', target.uid);

    const after = await firstValue(followService.suggestions('att-14', 12));
    expect(after.some((user) => user.uid === target.uid)).toBe(false);
    expect(await firstValue(followService.followingIds('att-14'))).toContain(target.uid);
  });

  it('never recommends suspended profiles', async () => {
    await seedIfEmpty();

    const candidates = await firstValue(followService.suggestions('att-14', 20));
    const suspended = candidates.find((user) => user.suspended);
    expect(suspended).toBeUndefined();

    const [first] = candidates;
    await db.users.put({ ...(await db.users.get(first.uid))!, uid: first.uid, suspended: true });

    const after = await firstValue(followService.suggestions('att-14', 20));
    expect(after.some((user) => user.uid === first.uid)).toBe(false);
  });

  it('toggleFollow maintains counters and notifies the target', async () => {
    await seedIfEmpty();

    const targetBefore = await db.users.get('org-1');
    const actorBefore = await db.users.get('att-14');
    const targetFollowersBefore = Number(targetBefore?.followers ?? 0);
    const actorFollowingBefore = Number(actorBefore?.following ?? 0);

    const started = await followService.toggleFollow('att-14', 'org-1');
    expect(started).toBe(true);

    const targetAfter = await db.users.get('org-1');
    const actorAfter = await db.users.get('att-14');
    expect(Number(targetAfter?.followers ?? 0)).toBe(targetFollowersBefore + 1);
    expect(Number(actorAfter?.following ?? 0)).toBe(actorFollowingBefore + 1);

    const notes = await db.notifications.where('userId').equals('org-1').toArray();
    expect(notes.some((note) => note.type === 'new_follower')).toBe(true);

    const stopped = await followService.toggleFollow('att-14', 'org-1');
    expect(stopped).toBe(false);
    expect(await firstValue(followService.followingIds('att-14'))).not.toContain('org-1');
  });
});
