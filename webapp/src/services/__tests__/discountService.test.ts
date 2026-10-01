import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { DiscountCode } from '../../models';
import { resetDatabase } from '../../test/setup';
import { DiscountService, InvalidCodeException } from '../discountService';

const EVENT_ID = 'evt-disc';

function makeCode(overrides: Partial<DiscountCode> = {}): DiscountCode {
  const code = new DiscountCode({
    id: '',
    eventId: EVENT_ID,
    code: 'SAVE10',
    percentOff: 10,
    capacity: 5,
  });
  Object.assign(code, overrides);
  return code;
}

async function expectInvalid(fn: () => Promise<unknown>, message: string): Promise<void> {
  await expect(fn()).rejects.toBeInstanceOf(InvalidCodeException);
  await expect(fn()).rejects.toThrow(message);
}

describe('DiscountService', () => {
  const service = new DiscountService();

  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates a code and validates it (case- and whitespace-insensitive)', async () => {
    const codeId = await service.createCode(makeCode({ percentOff: 25 }));
    expect(codeId).toMatch(/^dsc-/);

    const stored = await db.discountCodes.get(codeId);
    expect(stored?.code).toBe('SAVE10');
    expect(stored?.percentOff).toBe(25);

    const validated = await service.validateCode(EVENT_ID, '  save10 ');
    expect(validated.id).toBe(codeId);
    expect(validated.percentOff).toBe(25);
    expect(validated.active).toBe(true);
  });

  it('rejects a code belonging to another event', async () => {
    await service.createCode(makeCode());
    await expectInvalid(
      () => service.validateCode('evt-other', 'SAVE10'),
      'Invalid discount code.',
    );
  });

  it('rejects an unknown code', async () => {
    await service.createCode(makeCode());
    await expectInvalid(
      () => service.validateCode(EVENT_ID, 'NOPE'),
      'Invalid discount code.',
    );
  });

  it('rejects an inactive code', async () => {
    await service.createCode(makeCode({ active: false }));
    await expectInvalid(
      () => service.validateCode(EVENT_ID, 'SAVE10'),
      'This discount code is no longer active.',
    );
  });

  it('rejects an expired code', async () => {
    await service.createCode(
      makeCode({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
    );
    await expectInvalid(
      () => service.validateCode(EVENT_ID, 'SAVE10'),
      'This discount code has expired.',
    );
  });

  it('accepts a code that has not expired yet', async () => {
    await service.createCode(
      makeCode({ expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    );
    await expect(service.validateCode(EVENT_ID, 'SAVE10')).resolves.toBeDefined();
  });

  it('rejects a fully redeemed code', async () => {
    await service.createCode(makeCode({ capacity: 2, used: 2 }));
    await expectInvalid(
      () => service.validateCode(EVENT_ID, 'SAVE10'),
      'This discount code has been fully redeemed.',
    );
  });

  it('redeemCode increments usage until the code is exhausted', async () => {
    const codeId = await service.createCode(makeCode({ capacity: 2 }));

    await service.redeemCode(codeId);
    expect((await db.discountCodes.get(codeId))?.used).toBe(1);
    await expect(service.validateCode(EVENT_ID, 'SAVE10')).resolves.toBeDefined();

    await service.redeemCode(codeId);
    expect((await db.discountCodes.get(codeId))?.used).toBe(2);
    await expectInvalid(
      () => service.validateCode(EVENT_ID, 'SAVE10'),
      'This discount code has been fully redeemed.',
    );
  });

  it('redeemCode ignores unknown ids', async () => {
    await expect(service.redeemCode('dsc-missing')).resolves.toBeUndefined();
    expect(await db.discountCodes.count()).toBe(0);
  });
});
