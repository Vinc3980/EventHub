import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { putUser } from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { AuthService } from '../authService';

describe('blocked accounts', () => {
  const service = new AuthService();

  beforeEach(async () => {
    await resetDatabase();
    await putUser({ uid: 'u-blocker', name: 'Blocker' });
    await putUser({ uid: 'u-blocked', name: 'Blocked' });
  });

  it('blockUser / hasBlocked / unblockUser round-trip and persist on the user row', async () => {
    expect(await service.hasBlocked('u-blocker', 'u-blocked')).toBe(false);

    const afterBlock = await service.blockUser('u-blocker', 'u-blocked');
    expect(afterBlock).toEqual(['u-blocked']);
    expect(await service.hasBlocked('u-blocker', 'u-blocked')).toBe(true);

    const row = await db.users.get('u-blocker');
    expect(row?.blockedUids).toEqual(['u-blocked']);

    // Blocking twice does not duplicate the entry.
    await service.blockUser('u-blocker', 'u-blocked');
    expect((await db.users.get('u-blocker'))?.blockedUids).toEqual(['u-blocked']);

    const afterUnblock = await service.unblockUser('u-blocker', 'u-blocked');
    expect(afterUnblock).toEqual([]);
    expect(await service.hasBlocked('u-blocker', 'u-blocked')).toBe(false);
    expect((await db.users.get('u-blocker'))?.blockedUids).toEqual([]);
  });

  it('keeps blocks scoped to the blocking user', async () => {
    await service.blockUser('u-blocker', 'u-blocked');
    expect(await service.hasBlocked('u-blocked', 'u-blocker')).toBe(false);
    expect((await db.users.get('u-blocked'))?.blockedUids).toEqual([]);
  });

  it('ignores unknown users and empty targets', async () => {
    expect(await service.blockUser('u-missing', 'u-blocked')).toEqual([]);
    expect(await service.blockUser('u-blocker', '')).toEqual([]);
    expect(await service.hasBlocked('u-missing', 'u-blocked')).toBe(false);
    expect(await service.unblockUser('u-missing', 'u-blocked')).toEqual([]);
    expect((await db.users.get('u-blocker'))?.blockedUids).toEqual([]);
  });

  it('unblocking something that was never blocked is a no-op', async () => {
    expect(await service.unblockUser('u-blocker', 'u-never')).toEqual([]);
    expect((await db.users.get('u-blocker'))?.blockedUids).toEqual([]);
  });
});
