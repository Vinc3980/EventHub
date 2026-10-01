/**
 * id() — replicates the mobile LocalStore.newId() semantics:
 *   <collection-prefix> + '-' + 6 lowercase hex characters.
 * Deterministic-ish and readable; uniqueness comes from the collision check
 * performed by callers (`ServiceId` helpers below).
 */
const HEX = '0123456789abcdef';

export function randomHex(len: number): string {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => HEX[b % 16]).join('');
}

/** Mobile-style ids: evt-3f2a1b, usr-9c0d44, … */
export function id(prefix: string): string {
  return `${prefix}-${randomHex(6)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
