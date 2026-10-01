import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { effectiveRole } from '../app/AuthProvider';
import { db, setSessionUid } from '../db/db';
import { User } from '../models';
import { hashPassword } from '../lib/crypto';
import { AuthService } from '../services/authService';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
});

describe('merged roles', () => {
  it('seeds one `user` role for everyone and keeps admin separate', async () => {
    await seedIfEmpty();

    const users = await db.users.toArray();
    expect(users).toHaveLength(27);
    for (const row of users) {
      const roles = (row.roles as string[]) ?? [];
      expect(roles).toContain('user');
      expect(roles).not.toContain('organizer');
      expect(roles).not.toContain('attendee');
      if (String(row.uid) === 'admin-1') expect(roles).toContain('admin');
      else expect(roles).not.toContain('admin');
    }
  });

  it('effectiveRole only distinguishes admin from user', () => {
    expect(effectiveRole(null)).toBe('user');
    expect(
      effectiveRole(new User({ uid: 'u1', roles: ['user'], createdAt: new Date() })),
    ).toBe('user');
    expect(
      effectiveRole(new User({ uid: 'u2', roles: ['admin', 'user'], createdAt: new Date() })),
    ).toBe('admin');
    expect(
      effectiveRole(new User({ uid: 'u3', roles: ['admin'], createdAt: new Date() })),
    ).toBe('admin');
  });

  it('sign-up creates the profile row with the user role', async () => {
    const authService = new AuthService();
    const uid = await authService.signUpWithEmail({
      email: 'newbie@eventhub.app',
      password: 'secret123',
    });

    const row = await db.users.get(uid);
    expect(row).toBeDefined();
    expect((row?.roles as string[]) ?? []).toEqual(['user']);
    expect(row?.email).toBe('newbie@eventhub.app');
  });

  it('sign-in backfills a profile for accounts that predate the merge', async () => {
    await db.auth.put({
      uid: 'legacy-1',
      email: 'legacy@eventhub.app',
      passwordHash: await hashPassword('secret123'),
    });
    const authService = new AuthService();
    const uid = await authService.signInWithEmail({
      email: 'legacy@eventhub.app',
      password: 'secret123',
    });

    expect(uid).toBe('legacy-1');
    const row = await db.users.get('legacy-1');
    expect((row?.roles as string[]) ?? []).toEqual(['user']);
    expect(row?.name).toBe('legacy');
  });

  it('completeProfile(name) writes the user role without asking for one', async () => {
    const authService = new AuthService();
    await db.auth.put({ uid: 'legacy-2', email: 'two@eventhub.app', passwordHash: 'x$y' });
    await authService.completeProfile({ uid: 'legacy-2', name: 'Legacy Two' });

    const row = await db.users.get('legacy-2');
    expect((row?.roles as string[]) ?? []).toEqual(['user']);
    expect(row?.name).toBe('Legacy Two');
  });
});

describe('role merge in the UI', () => {
  it('drops the choose-role step: /choose-role is a 404', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/choose-role');
    render(<App />);

    expect(
      await screen.findByText('Page not found', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Also become an organizer/)).not.toBeInTheDocument();
  }, 30_000);

  it('shows a joined-date line for regular users and Admin for admins', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/home');
    const userView = render(<App />);

    expect(await screen.findByText(/Joined /, {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByText('Attendee')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();

    userView.unmount();
    await setSessionUid('admin-1');
    window.history.pushState({}, '', '/home');
    render(<App />);

    const adminLabels = await screen.findAllByText('Admin', {}, { timeout: 10_000 });
    expect(adminLabels.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Joined /)).not.toBeInTheDocument();
  }, 40_000);

  it('Settings replaces role chips with a member-since row and keeps payouts open', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/settings');
    render(<App />);

    expect(await screen.findByText('Member since', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Also become an organizer/)).not.toBeInTheDocument();
    expect(await screen.findByText('Payout settings', {}, { timeout: 10_000 })).toBeInTheDocument();
  }, 30_000);

  it('Profile offers Events, Tickets and Saved for every account', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/profile');
    render(<App />);

    const tabs = await screen.findByRole('tablist', { name: 'Profile sections' }, {
      timeout: 10_000,
    });
    expect(within(tabs).getByRole('tab', { name: 'Events' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: 'Tickets' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: 'Saved' })).toBeInTheDocument();

    await userEvent.click(within(tabs).getByRole('tab', { name: 'Tickets' }));
    expect(
      await screen.findByText(/No bookings yet|bookings/i, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  }, 30_000);
});
