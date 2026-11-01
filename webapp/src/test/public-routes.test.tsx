/**
 * Public browsing (section 3.1): Explore, event pages, profiles and the help
 * center must render with no session on this device. There is no backend —
 * "public" means the local database answers the read without a login.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
  await seedIfEmpty();
});

async function open(path: string) {
  window.history.pushState({}, '', path);
  const view = render(<App />);
  return view;
}

describe('public routes need no session', () => {
  it('renders Explore for a signed-out visitor', async () => {
    const view = await open('/explore');
    expect(await screen.findByText('All events', {}, { timeout: 10_000 })).toBeInTheDocument();
    // Not bounced to the login screen.
    expect(window.location.pathname).toBe('/explore');
    view.unmount();
  }, 30_000);

  it('renders an event detail page for a signed-out visitor', async () => {
    const view = await open('/event/seed-1');
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Accra Music Festival 2026' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/event/seed-1');
    view.unmount();
  }, 30_000);

  it('renders a public profile for a signed-out visitor', async () => {
    const view = await open('/u/org-1');
    expect(
      await screen.findByRole('heading', { name: 'Kwame Asante' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/u/org-1');
    view.unmount();
  }, 30_000);

  it('renders the help center for a signed-out visitor', async () => {
    const view = await open('/help');
    expect(
      await screen.findByText('How can we help?', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/help');
    view.unmount();
  }, 30_000);
});
