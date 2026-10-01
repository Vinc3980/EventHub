import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { lazy, Suspense, type ReactElement } from 'react';
import App from '../App';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { withChunkRetry } from '../app/lazyScreen';
import { db, setSessionUid } from '../db/db';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
});

describe('navigation and loading states', () => {
  it('landing -> Log in shows the login form without a refresh', async () => {
    window.history.pushState({}, '', '/landing');
    render(<App />);

    const loginButton = await screen.findByRole('button', { name: 'Log in' }, { timeout: 5000 });
    await userEvent.click(loginButton);

    expect(
      await screen.findByLabelText(/^email/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('an authed visit to /home renders the feed', async () => {
    await db.users.put({
      uid: 'att-1',
      name: 'Nana Akua',
      email: 'nana@eventhub.app',
      roles: ['user'],
      createdAt: new Date().toISOString(),
      blockedUids: [],
      savedEventIds: [],
      followingIds: [],
    } as never);
    await setSessionUid('att-1');

    window.history.pushState({}, '', '/home');
    render(<App />);

    expect(
      await screen.findByText(/Good (morning|afternoon|evening), Nana/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('signing in with the seeded attendee lands on the feed', async () => {
    await seedIfEmpty();

    window.history.pushState({}, '', '/login');
    render(<App />);

    const fill = await screen.findByRole(
      'button',
      { name: 'Fill demo account for Attendee' },
      { timeout: 5000 },
    );
    await userEvent.click(fill);
    const submit = screen.getByRole('button', { name: 'Log in' });
    await userEvent.click(submit);

    await waitFor(
      async () => {
        expect(await screen.findByText(/Good (morning|afternoon|evening)/, {}, { timeout: 8000 })).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
  });
});


describe('chunk load failures', () => {
  it('retries a failed dynamic import once before rendering the screen', async () => {
    let attempts = 0;
    const Flaky = lazy(
      withChunkRetry(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('error loading dynamically imported module: /src/Flaky.tsx');
        }
        return { default: () => <p>Recovered screen</p> };
      }),
    );

    render(
      <ErrorBoundary>
        <Suspense fallback={<p>Loading screen…</p>}>
          <Flaky />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByText('Recovered screen', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('shows a reload prompt when the screen never loads', async () => {
    const Broken = lazy(
      withChunkRetry(
        (): Promise<{ default: () => ReactElement }> =>
          Promise.reject(new Error('error loading dynamically imported module: /src/Broken.tsx')),
      ),
    );

    render(
      <ErrorBoundary>
        <Suspense fallback={<p>Loading screen…</p>}>
          <Broken />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(
      await screen.findByText('Could not load this screen', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});