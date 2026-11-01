import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROUTE_META,
  backdropFor,
  breadcrumbs,
  documentTitle,
  isPublicRoute,
  layoutFor,
  routeMeta,
} from '../routes/routeMeta';

// Vitest runs from the webapp root; import.meta.url is an http:// URL under
// the jsdom environment, so resolve from cwd instead.
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

/** Every `path="…"` literal in the router. */
function appPaths(): string[] {
  return Array.from(appSource.matchAll(/path="([^"]+)"/g), (match) => match[1]);
}

describe('route metadata is exhaustive', () => {
  it('covers every route declared in App.tsx', () => {
    const declared = appPaths();
    expect(declared.length).toBeGreaterThan(30);
    const known = new Set(ROUTE_META.map((meta) => meta.pattern));
    const missing = declared.filter((path) => !known.has(path));
    expect(missing, `routes without meta: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no orphan metadata for routes that no longer exist', () => {
    const declared = new Set(appPaths());
    const orphans = ROUTE_META.filter(
      (meta) => meta.pattern !== '*' && !declared.has(meta.pattern),
    ).map((meta) => meta.pattern);
    expect(orphans, `meta without a route: ${orphans.join(', ')}`).toEqual([]);
  });

  it('gives every route a title, a known parent and a valid layout', () => {
    const known = new Set(ROUTE_META.map((meta) => meta.pattern));
    for (const meta of ROUTE_META) {
      expect(meta.title.trim().length, meta.pattern).toBeGreaterThan(0);
      if (meta.parent) expect(known.has(meta.parent), `${meta.pattern} → ${meta.parent}`).toBe(true);
      if (meta.layout) {
        expect(['default', 'focused', 'bare'], meta.pattern).toContain(meta.layout);
      }
    }
  });
});

describe('route lookup', () => {
  it('resolves static and dynamic paths', () => {
    expect(routeMeta('/host').title).toBe('Host');
    expect(routeMeta('/organizer/events/evt-9/analytics').title).toBe('Analytics');
    expect(routeMeta('/organizer/events/evt-9/scan').layout).toBe('bare');
    expect(routeMeta('/event/evt-1/register').layout).toBe('focused');
    expect(routeMeta('/definitely-not-a-route').pattern).toBe('*');
    expect(routeMeta('/host/').pattern).toBe('/host');
  });

  it('knows which routes are public', () => {
    expect(isPublicRoute('/explore')).toBe(true);
    expect(isPublicRoute('/event/evt-1')).toBe(true);
    expect(isPublicRoute('/u/att-1')).toBe(true);
    expect(isPublicRoute('/help')).toBe(true);
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/home')).toBe(false);
    expect(isPublicRoute('/settings')).toBe(false);
  });

  it('drives the three layouts', () => {
    expect(layoutFor('/home')).toBe('default');
    expect(layoutFor('/event/evt-1/pay/bk-1')).toBe('focused');
    expect(layoutFor('/chats/chat-1')).toBe('bare');
  });

  it('resolves backdrop for every route', () => {
    for (const meta of ROUTE_META) {
      const backdrop = backdropFor(meta.pattern);
      expect(['rich', 'soft', 'none'], meta.pattern).toContain(backdrop);
    }
    expect(backdropFor('/')).toBe('rich');
    expect(backdropFor('/home')).toBe('rich');
    expect(backdropFor('/explore')).toBe('rich');
    expect(backdropFor('/tickets')).toBe('rich');
    expect(backdropFor('/host')).toBe('rich');
    expect(backdropFor('/community')).toBe('rich');
    expect(backdropFor('/help')).toBe('rich');
    expect(backdropFor('/settings')).toBe('soft');
    expect(backdropFor('/admin')).toBe('soft');
    expect(backdropFor('/login')).toBe('none');
    expect(backdropFor('/chats/chat-1')).toBe('none');
  });
});

describe('breadcrumbs', () => {
  it('walks the ancestor chain without repeating the current page', () => {
    expect(breadcrumbs('/organizer/events/evt-1/analytics').map((crumb) => crumb.label)).toEqual([
      'Home',
      'Host',
      'My events',
    ]);
    expect(breadcrumbs('/settings/blocked').map((crumb) => crumb.label)).toEqual([
      'Home',
      'Settings',
    ]);
    expect(breadcrumbs('/chats/chat-1').map((crumb) => crumb.label)).toEqual([
      'Home',
      'Community',
      'Chats',
    ]);
  });

  it('leaves top-level pages with no trail', () => {
    expect(breadcrumbs('/home')).toEqual([]);
    expect(breadcrumbs('/')).toEqual([]);
  });
});

describe('document titles', () => {
  it('suffixes every inner page with the brand', () => {
    expect(documentTitle('/host')).toBe('Host · EventHub');
    expect(documentTitle('/organizer/events/evt-1/guests')).toBe('Guest list · EventHub');
  });

  it('keeps the landing page on the bare brand name', () => {
    expect(documentTitle('/')).toBe('EventHub');
    expect(documentTitle('/landing')).toBe('EventHub');
  });
});
