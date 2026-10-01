import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { db, setSessionUid } from '../db/db';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

/** `att-14` is seeded with zero follows — the recommendation state. */
async function seedNewUserSession(): Promise<void> {
  await seedIfEmpty();
  await setSessionUid('att-14');
}

async function visit(route: string): Promise<void> {
  window.history.pushState({}, '', route);
  render(<App />);
  await waitFor(
    () => {
      expect(screen.queryByText('Reload page')).not.toBeInTheDocument();
    },
    { timeout: 5000 },
  );
}

describe('people-to-follow recommendations', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('Home recommends people to follow when the user follows nobody', async () => {
    await seedNewUserSession();
    await visit('/home');

    await userEvent.click(await screen.findByRole('tab', { name: 'Following' }, { timeout: 10_000 }));

    expect(await screen.findByText('People to follow', {}, { timeout: 10_000 })).toBeInTheDocument();
    const followButtons = await screen.findAllByRole('button', { name: 'Follow' }, { timeout: 10_000 });
    expect(followButtons.length).toBeGreaterThan(0);

    const followsBefore = await db.follows.count();
    await userEvent.click(followButtons[0]);
    await waitFor(async () => {
      expect(await db.follows.count()).toBe(followsBefore + 1);
    });
  }, 30_000);

  it('Explore offers the Who to follow filter with followable people', async () => {
    await seedNewUserSession();
    await visit('/explore');

    await userEvent.click(await screen.findByRole('button', { name: 'Who to follow' }, { timeout: 10_000 }));

    expect(await screen.findByText('People to follow', {}, { timeout: 10_000 })).toBeInTheDocument();
    const followButtons = await screen.findAllByRole('button', { name: 'Follow' }, { timeout: 10_000 });
    expect(followButtons.length).toBeGreaterThan(0);

    // Event tiles are hidden while the people filter is active.
    expect(screen.queryByRole('link', { name: /Accra Music Festival/ })).not.toBeInTheDocument();
  }, 30_000);

  it('event filters come back when Who to follow is toggled off', async () => {
    await seedNewUserSession();
    await visit('/explore');

    const chip = await screen.findByRole('button', { name: 'Who to follow' }, { timeout: 10_000 });
    await userEvent.click(chip);
    expect(await screen.findByText('People to follow', {}, { timeout: 10_000 })).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'All' }, { timeout: 10_000 }));
    await waitFor(() => {
      expect(screen.queryByText('People to follow')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('All events', {}, { timeout: 10_000 })).toBeInTheDocument();
  }, 30_000);
});
