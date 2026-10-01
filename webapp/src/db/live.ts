import { useEffect, useState } from 'react';
import { liveQuery, type Observable } from 'dexie';

export type LiveResult<T> = { data: T | undefined; loading: boolean; error?: Error };

type Query<T> = () => Promise<T> | Observable<T> | T;

/**
 * Dexie's `liveQuery()` resolves whatever the querier returns with
 * `Promise.resolve()`, so an observable-returning service method
 * (e.g. `followService.followingIds()`) would emit *the observable itself*
 * instead of its values. This subscribes to such results directly while still
 * running non-observable queriers inside `liveQuery` so table reads keep
 * re-triggering them.
 */
function subscribeToQuery<T>(
  query: Query<T>,
  observer: { next: (value: T) => void; error: (error: unknown) => void },
): { unsubscribe: () => void } {
  let inner: { unsubscribe: () => void } | null = null;
  let handedOff = false;

  const outer = liveQuery(() => query()).subscribe({
    next: (value) => {
      if (handedOff) return;
      if (isObservable<T>(value)) {
        handedOff = true;
        outer.unsubscribe();
        inner = value.subscribe(observer);
        return;
      }
      observer.next(value as T);
    },
    error: (error) => observer.error(error),
  });

  return {
    unsubscribe: () => {
      handedOff = true;
      outer.unsubscribe();
      inner?.unsubscribe();
      inner = null;
    },
  };
}

function isObservable<T>(value: unknown): value is Observable<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Observable<T>).subscribe === 'function'
  );
}

/**
 * React binding for Dexie live queries — the `dexie-react-livequery` package
 * does not exist on npm, so this is the equivalent (spec deviation note).
 */
export function useLiveQuery<T>(
  query: Query<T>,
  deps: unknown[] = [],
  initial?: T,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(initial);

  useEffect(() => {
    let active = true;
    const sub = subscribeToQuery<T>(query, {
      next: (next) => {
        if (active) setValue(next);
      },
      error: () => {
        if (active) setValue(initial);
      },
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

/** Variant that also exposes loading + error for skeletons. */
export function useLive<T>(query: Query<T>, deps: unknown[] = []): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({
    data: undefined,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    const sub = subscribeToQuery<T>(query, {
      next: (next) => {
        if (active) setState({ data: next, loading: false });
      },
      error: (error) => {
        if (active) setState({ data: undefined, loading: false, error: error as Error });
      },
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
