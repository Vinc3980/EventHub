/**
 * Nav hover & click-pin behavior tests.
 *
 * Exercises the useHoverIntent state machine across TopNav menus and Help:
 *  1. Hover from idle opens menu after ~120ms.
 *  2. Cross-menu switch: moving pointer from A to B immediately opens B and
 *     survives A's pending close timer.
 *  3. Click after hover pins the menu (does not close it).
 *  4. Pinned menu survives pointer-leave.
 *  5. Second click on pinned menu closes it.
 *  6. Touch pointerType does not open on hover (tap only).
 *  7. Help menu opens on hover.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopNav } from '../layouts/nav/TopNav';

// Polyfill PointerEvent in JSDOM if needed
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    pointerType: string;
    constructor(type: string, params: any = {}) {
      super(type, params);
      this.pointerType = params?.pointerType ?? '';
    }
  }
  window.PointerEvent = PointerEvent as any;
  (global as any).PointerEvent = PointerEvent as any;
}

// Mock AuthProvider so TopNav renders user state
vi.mock('../app/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      name: 'Ada Lovelace',
      avatarUrl: undefined,
      createdAt: new Date('2024-01-01'),
    },
    uid: 'usr-1',
    signOut: vi.fn(),
  }),
  effectiveRole: () => 'user',
}));

// Mock SocialData chats & notifications
vi.mock('../components/SocialData', () => ({
  useChats: () => ({ data: [] }),
  useChatMeta: () => ({}),
  useNotifications: () => ({ data: [] }),
}));

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <TopNav />
    </MemoryRouter>,
  );
}

describe('TopNav hover intent & pin behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens menu after 120ms on hover from idle', () => {
    renderNav();
    const exploreTrigger = screen.getByRole('button', { name: /Explore menu/i });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'false');

    // Pointer enters Explore trigger
    fireEvent.pointerEnter(exploreTrigger, { pointerType: 'mouse' });

    // Still closed before 120ms
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'false');

    // Opens after 120ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('switches immediately between menus and does not close from cross-menu race', () => {
    renderNav();
    const exploreTrigger = screen.getByRole('button', { name: /Explore menu/i });
    const ticketsTrigger = screen.getByRole('button', { name: /Tickets menu/i });

    // Open Explore
    fireEvent.pointerEnter(exploreTrigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(130);
    });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'true');

    // Pointer leaves Explore item
    fireEvent.pointerLeave(exploreTrigger, { pointerType: 'mouse' });

    // Pointer enters Tickets item immediately
    act(() => {
      fireEvent.pointerEnter(ticketsTrigger, { pointerType: 'mouse' });
    });

    // Tickets opens immediately without delay
    expect(ticketsTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'false');

    // Advance 300ms past Explore's 250ms close timer
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Tickets must still be open!
    expect(ticketsTrigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking trigger while hover-opened pins the menu and survives pointer-leave', () => {
    renderNav();
    const exploreTrigger = screen.getByRole('button', { name: /Explore menu/i });

    // Hover-open Explore
    fireEvent.pointerEnter(exploreTrigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(130);
    });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'true');

    // Click trigger while hover-opened -> pins the menu
    act(() => {
      fireEvent.click(exploreTrigger);
    });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'true');

    // Pointer leaves the item
    fireEvent.pointerLeave(exploreTrigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Pinned menu survives pointer-leave!
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'true');

    // Second click unpins and closes
    act(() => {
      fireEvent.click(exploreTrigger);
    });
    expect(exploreTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not open menu when pointerType is touch', () => {
    renderNav();
    const hostTrigger = screen.getByRole('button', { name: /Host menu/i });

    // Tap/touch simulated pointerEnter
    fireEvent.pointerEnter(hostTrigger, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(hostTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens Help menu on hover', () => {
    renderNav();
    const helpTrigger = screen.getByRole('button', { name: /^Help$/i });
    expect(helpTrigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.pointerEnter(helpTrigger, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(helpTrigger).toHaveAttribute('aria-expanded', 'true');
  });
});
