/**
 * Vitest setup.
 *
 * jsdom does not ship IndexedDB, matchMedia, IntersectionObserver/ResizeObserver
 * or a usable window.scrollTo, so the suite provides shims for all of them plus
 * a helper that wipes every Dexie table between tests.
 */
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { db } from '../db/db';

// ---------------------------------------------------------------------------
// matchMedia
// ---------------------------------------------------------------------------

class MockMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media: string;
  matches = false;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;

  constructor(query: string) {
    super();
    this.media = query;
  }

  addListener(): void {
    // no-op: jsdom never changes media queries
  }

  removeListener(): void {
    // no-op
  }
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => new MockMediaQueryList(query),
  });
}

// ---------------------------------------------------------------------------
// IntersectionObserver / ResizeObserver
// ---------------------------------------------------------------------------

class MockIntersectionObserver extends EventTarget implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    super();
  }

  observe(): void {
    // no-op
  }

  unobserve(): void {
    // no-op
  }

  disconnect(): void {
    // no-op
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class MockResizeObserver extends EventTarget implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {
    super();
  }

  observe(): void {
    // no-op
  }

  unobserve(): void {
    // no-op
  }

  disconnect(): void {
    // no-op
  }
}

if (typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'function') {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
}

if (typeof window !== 'undefined' && typeof window.ResizeObserver !== 'function') {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  });
}

// ---------------------------------------------------------------------------
// scrollTo — jsdom logs "Not implemented" instead of scrolling
// ---------------------------------------------------------------------------

const noopScroll = (): void => undefined;

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    configurable: true,
    value: noopScroll,
  });
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  Object.defineProperty(Element.prototype, 'scrollTo', {
    writable: true,
    configurable: true,
    value: noopScroll,
  });
}

// ---------------------------------------------------------------------------
// Database reset helper — clears every table (including the session) so each
// test starts from an empty, freshly opened database.
// ---------------------------------------------------------------------------

export async function resetDatabase(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  const tables = db.tables;
  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.clear();
    }
  });
}

afterEach(() => {
  vi.useRealTimers();
});
