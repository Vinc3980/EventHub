import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { verifyPassword } from '../../lib/crypto';
import { firstValue } from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { AuthException, AuthService } from '../authService';
import { seedIfEmpty } from '../seedService';

async function expectAuthError(promise: Promise<unknown>, code: string, message: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(AuthException);
  expect((error as AuthException).code).toBe(code);
  expect((error as AuthException).message).toBe(message);
}

describe('AuthService', () => {
  const service = new AuthService();

  beforeEach(async () => {
    await resetDatabase();
  });

  it('rejects a malformed email', async () => {
    await expectAuthError(
      service.signUpWithEmail({ email: 'not-an-email', password: 'longenough' }),
      'invalid-email',
      'Enter a valid email address.',
    );
    expect(await db.auth.count()).toBe(0);
  });

  it('rejects a short password', async () => {
    await expectAuthError(
      service.signUpWithEmail({ email: 'ama@example.test', password: '12345' }),
      'weak-password',
      'Password must be at least 6 characters.',
    );
    expect(await db.auth.count()).toBe(0);
  });

  it('rejects a duplicate email', async () => {
    const uid = await service.signUpWithEmail({ email: 'ama@example.test', password: 'secret1' });
    expect(uid).toMatch(/^usr-/);

    await expectAuthError(
      service.signUpWithEmail({ email: ' AMA@Example.Test ', password: 'secret1' }),
      'email-already-in-use',
      'An account already exists for this email.',
    );
    expect(await db.auth.count()).toBe(1);
  });

  it('rejects unknown emails and wrong passwords on sign-in', async () => {
    await service.signUpWithEmail({ email: 'ama@example.test', password: 'secret1' });
    await service.signOut();

    await expectAuthError(
      service.signInWithEmail({ email: 'nobody@example.test', password: 'secret1' }),
      'user-not-found',
      'No account found for this email.',
    );
    await expectAuthError(
      service.signInWithEmail({ email: 'ama@example.test', password: 'wrong-pass' }),
      'wrong-password',
      'Incorrect password.',
    );
    expect(await service.currentUid()).toBeNull();
  });

  it('stores a salted hash instead of the plain password', async () => {
    const uid = await service.signUpWithEmail({ email: 'hash@example.test', password: 'demo123' });
    const row = await db.auth.get(uid);

    expect(row).toBeDefined();
    expect(row?.passwordHash).not.toBe('demo123');
    expect(row?.passwordHash).not.toContain('demo123');
    expect(row?.passwordHash).toContain('$');

    expect(await verifyPassword('demo123', String(row?.passwordHash))).toBe(true);
    expect(await verifyPassword('demo124', String(row?.passwordHash))).toBe(false);

    const otherUid = await service.signUpWithEmail({
      email: 'hash2@example.test',
      password: 'demo123',
    });
    const other = await db.auth.get(otherUid);
    expect(other?.passwordHash).not.toBe(row?.passwordHash);
  });

  it('signOut clears the session', async () => {
    const uid = await service.signUpWithEmail({ email: 'out@example.test', password: 'secret1' });
    expect(await service.currentUid()).toBe(uid);
    expect(await firstValue(service.authStateChanges)).toBe(uid);

    await service.signOut();

    expect(await service.currentUid()).toBeNull();
    expect(await firstValue(service.authStateChanges)).toBeNull();
  });

  it('signs the seeded demo users in with demo123', async () => {
    await seedIfEmpty();

    expect(await service.signInWithEmail({ email: 'nana@eventhub.app', password: 'demo123' })).toBe('att-1');
    await service.signOut();
    expect(await service.signInWithEmail({ email: 'kwame@eventhub.app', password: 'demo123' })).toBe('org-1');
    await service.signOut();
    expect(await service.signInWithEmail({ email: 'admin@eventhub.app', password: 'demo123' })).toBe('admin-1');
    await service.signOut();

    await expectAuthError(
      service.signInWithEmail({ email: 'nana@eventhub.app', password: 'wrong' }),
      'wrong-password',
      'Incorrect password.',
    );
  });

  it('friendlyMessage maps AuthExceptions and hides the rest', () => {
    expect(AuthService.friendlyMessage(new AuthException('invalid-email', 'Enter a valid email address.'))).toBe(
      'Enter a valid email address.',
    );
    expect(AuthService.friendlyMessage(new Error('boom'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
