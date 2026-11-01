/**
 * Desktop mega-menu keyboard contract (section 3.2):
 *  - ArrowDown on the trigger opens the panel and focuses the first item.
 *  - ArrowUp/ArrowDown move within a column, ArrowRight/ArrowLeft move across
 *    columns at the same row.
 *  - Escape closes and returns focus to the trigger.
 *  - Tab closes the panel and lets focus continue.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NavMenu } from '../layouts/nav/NavMenu';
import { NAV_MENUS, type NavMenu as NavMenuConfig } from '../layouts/nav/navConfig';

const HOST_MENU = NAV_MENUS.find((menu) => menu.id === 'host') as NavMenuConfig;

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <NavMenu
        menu={HOST_MENU}
        active={false}
        uid="att-1"
        open={open}
        onOpenChange={setOpen}
        onEventTool={() => undefined}
      />
    </MemoryRouter>
  );
}

const trigger = () => screen.getByRole('button', { name: /Host/ });
const item = (name: RegExp) => screen.getByRole('menuitem', { name });

describe('top navigation keyboard navigation', () => {
  it('opens with ArrowDown and roves within and across columns', async () => {
    render(<Harness />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(item(/Create event/)).toHaveFocus());

    // Down within the first column.
    await userEvent.keyboard('{ArrowDown}');
    expect(item(/My events/)).toHaveFocus();

    // Up returns to the previous item.
    await userEvent.keyboard('{ArrowUp}');
    expect(item(/Create event/)).toHaveFocus();

    // Right moves to the same row in the next column ("Plan" → "Promote").
    await userEvent.keyboard('{ArrowRight}');
    expect(item(/Send invitations/)).toHaveFocus();

    // Left returns to the first column.
    await userEvent.keyboard('{ArrowLeft}');
    expect(item(/Create event/)).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(item(/Create event/)).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger()).toHaveFocus();
  });

  it('closes on Tab', async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(item(/Create event/)).toHaveFocus());

    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'));
  });
});
