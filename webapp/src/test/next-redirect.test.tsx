/**
 * Auth round-trip (section 3.5): a gated URL sends the visitor to
 * `/login?next=…`, and a successful sign-in returns them to exactly that URL.
 * `safeNext` rejects open redirects so the param cannot leave the app.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { loginPathFor, safeNext } from '../app/guards';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
});

describe('next redirect', () => {
  it('encodes the requested URL and rejects open redirects', () => {
    expect(loginPathFor('/tickets', '?view=past')).toBe('/login?next=%2Ftickets%3Fview%3Dpast');
    expect(safeNext('?next=%2Fsettings')).toBe('/settings');
    expect(safeNext('?next=%2Fsettings%3Ftab%3Dsecurity')).toBe('/settings?tab=security');
    expect(safeNext('?next=https%3A%2F%2Fevil.example')).toBe('/home');
    expect(safeNext('?next=%2F%2Fevil.example')).toBe('/home');
    expect(safeNext('?next=%2Flogin')).toBe('/home');
    expect(safeNext('?next=%2Fsignup')).toBe('/home');
    expect(safeNext('')).toBe('/home');
    expect(safeNext('', '/explore')).toBe('/explore');
  });

  it('round-trips a private URL through the login screen', async () => {
    await seedIfEmpty();
    window.history.pushState({}, '', '/settings');
    const view = render(<App />);

    // Gated route → login, carrying the original destination.
    await waitFor(() => expect(window.location.pathname).toBe('/login'), { timeout: 10_000 });
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/settings');

    // Sign in with the seeded attendee.
    const fill = await screen.findByRole(
      'button',
      { name: 'Fill demo account for Attendee' },
      { timeout: 10_000 },
    );
    await userEvent.click(fill);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    // Returned to the page that required a session.
    await waitFor(() => expect(window.location.pathname).toBe('/settings'), { timeout: 15_000 });
    expect(await screen.findByText('Member since', {}, { timeout: 10_000 })).toBeInTheDocument();
    view.unmount();
  }, 45_000);
});
