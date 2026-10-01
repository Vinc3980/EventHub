/**
 * Public-asset URL helper for deployments that don't sit at the domain root.
 *
 * GitHub Pages serves this app from a project site (`/EventHub/`), while the
 * stored data and source literals stay root-absolute (`/seed/…`, `/icons/…`).
 * Call `assetUrl()` wherever those turn into `src`/`href` values (or when
 * writing seed rows); it is a no-op at the root and idempotent everywhere.
 */
export function assetUrl(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL;
  if (base === '/') return path;
  if (path === base || path.startsWith(base)) return path;
  return base.replace(/\/$/, '') + path;
}

/** Seed rows only ever store public asset paths under /seed/ or /icons/. */
function isPublicAssetPath(value: string): boolean {
  return value.startsWith('/seed/') || value.startsWith('/icons/');
}

function prefixAssets(value: unknown): unknown {
  if (typeof value === 'string') return isPublicAssetPath(value) ? assetUrl(value) : value;
  if (Array.isArray(value)) return value.map(prefixAssets);
  if (value instanceof Date) return value;
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(source)) copy[key] = prefixAssets(source[key]);
    return copy;
  }
  return value;
}

/** Deep-copies a seed row, base-prefixing every `/seed/…` or `/icons/…` string. */
export function withAssetBase<T>(row: T): T {
  return prefixAssets(row) as T;
}
