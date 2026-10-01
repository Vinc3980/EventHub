import { describe, expect, it } from 'vitest';
import { PLATFORM_FEE_RATE, organizerPayout, platformFee } from '../../lib/constants';

describe('platform fee', () => {
  it('keeps the 2% rate', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.02);
  });

  it('charges 2% of the ticket amount', () => {
    expect(platformFee(100)).toBe(2);
    expect(platformFee(80)).toBe(1.6);
    expect(platformFee(0)).toBe(0);
    expect(platformFee(1999.99)).toBe(40);
  });

  it('rounds to two decimals', () => {
    expect(platformFee(33.33)).toBe(0.67);
    expect(platformFee(10.05)).toBe(0.2);
    expect(platformFee(999.99)).toBe(20);
    for (const amount of [1, 7.77, 123.45, 876.54, 12345.67]) {
      const fee = platformFee(amount);
      expect(Number.isInteger(Math.round(fee * 100))).toBe(true);
      expect(fee).toBe(Math.round(amount * PLATFORM_FEE_RATE * 100) / 100);
    }
  });

  it('pays the organizer amount minus the fee', () => {
    expect(organizerPayout(100)).toBe(98);
    expect(organizerPayout(80)).toBe(78.4);
    expect(organizerPayout(0)).toBe(0);
  });

  it('always splits the amount exactly', () => {
    for (const amount of [0.01, 1, 33.33, 80, 100, 2500, 9999.99]) {
      expect(platformFee(amount) + organizerPayout(amount)).toBe(amount);
    }
  });
});
