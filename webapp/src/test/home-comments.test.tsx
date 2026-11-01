import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { setSessionUid } from '../db/db';
import { seedIfEmpty } from '../services/seedService';
import { resetDatabase } from './setup';

const HEADING = { name: /^Comments/ } as const;

async function renderHome(): Promise<void> {
  await seedIfEmpty();
  await setSessionUid('att-1');
  window.history.pushState({}, '', '/home');
  render(<App />);
}

function resizeTo(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  resizeTo(1024);
});

describe('home comment icon toggle', () => {
  it('closes the comments panel on a second click and keeps it closed (desktop)', async () => {
    await renderHome();

    let buttons = await screen.findAllByRole('button', { name: 'View comments' }, {
      timeout: 10_000,
    });
    expect(buttons.length).toBeGreaterThan(1);

    // The panel auto-selects the first post on load.
    await waitFor(() => expect(buttons[0]).toHaveAttribute('aria-pressed', 'true'), {
      timeout: 5000,
    });
    expect(await screen.findByRole('heading', HEADING)).toBeInTheDocument();

    // Open a different post's comments.
    await userEvent.click(buttons[1]);
    await waitFor(() => expect(buttons[1]).toHaveAttribute('aria-pressed', 'true'));
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');

    // Second click on the same icon closes the panel.
    await userEvent.click(buttons[1]);
    await waitFor(() =>
      expect(screen.getByText('Select a post to read its comments.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('heading', HEADING)).not.toBeInTheDocument();
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');

    // It must stay closed — the auto-select effect may not resurrect it.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('heading', HEADING)).not.toBeInTheDocument();
    expect(screen.getByText('Select a post to read its comments.')).toBeInTheDocument();
    buttons = screen.getAllByRole('button', { name: 'View comments' });
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
  }, 30_000);

  it('opens and dismisses the comments Sheet from the icon on mobile', async () => {
    resizeTo(390);
    await renderHome();

    const buttons = await screen.findAllByRole('button', { name: 'View comments' }, {
      timeout: 10_000,
    });
    expect(buttons.length).toBeGreaterThan(0);

    await userEvent.click(buttons[0]);
    const dialog = await screen.findByRole('dialog', {}, { timeout: 10_000 });
    // The desktop panel is hidden by CSS (jsdom does not apply it), so scope
    // the assertions to the Sheet itself.
    expect(within(dialog).getByRole('heading', HEADING)).toBeInTheDocument();

    await userEvent.click(buttons[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
  }, 30_000);
});
