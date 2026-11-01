/**
 * Hub tiles must show the same live counts as the lists they open (section 3.6).
 * These tests seed the database, mutate the owner's events, and assert the
 * rendered badges match the real numbers.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../app/AuthProvider';
import { db, setSessionUid } from '../db/db';
import { seedIfEmpty } from '../services/seedService';
import HostHub from '../screens/hubs/HostHub';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
});

function tile(label: string): HTMLElement {
  const link = screen.getByText(label).closest('a');
  if (!link) throw new Error(`No hub tile link found for “${label}”.`);
  return link;
}

describe('hub tiles show live counts', () => {
  it('matches the host event totals and draft count', async () => {
    await seedIfEmpty();
    await setSessionUid('org-1');

    const mine = (await db.events.toArray()).filter((row) => row.ownerId === 'org-1');
    expect(mine.length).toBeGreaterThan(2);
    const draftIds = mine.slice(0, 2).map((row) => String(row.id));
    for (const id of draftIds) await db.events.update(id, { status: 'draft' });

    render(
      <MemoryRouter>
        <AuthProvider>
          <HostHub />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Total events tile.
    await waitFor(
      () => {
        expect(within(tile('My events')).getByText(String(mine.length))).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    // Drafts tile counts only the two events we flipped.
    expect(within(tile('Drafts')).getByText('2')).toBeInTheDocument();
  }, 30_000);
});
