/**
 * Business constants — section 4 of the spec.
 * Platform fee is 2%. All simulation is clearly marked.
 */

export const PLATFORM_FEE_RATE = 0.02;

export const MEDIUMS = ['momo', 'card', 'cash', 'bank'] as const;
export type Medium = (typeof MEDIUMS)[number];

export const MOMO_NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AT Money'] as const;

export const CATEGORIES = ['wedding', 'funeral', 'corporate', 'social'] as const;

/** SIMULATED payout schedule — 1 day after an event ends, one batch per event. */
export const PAYOUT_OFFSET_DAYS = 1;

/** SIMULATED chat message delivery latency (ms). */
export const MESSAGE_DELAY_MS = 400;

/** SIMULATED push notification: written to the in-app `notifications` table. */
export const PUSH_SIMULATED = true;

/** SIMULATED MoMo/SMS — nothing leaves the device. */
export const PAYMENT_SIMULATED = true;
export const SMS_SIMULATED = true;

export function platformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
}

export function organizerPayout(amount: number): number {
  return Math.round((amount - platformFee(amount)) * 100) / 100;
}
