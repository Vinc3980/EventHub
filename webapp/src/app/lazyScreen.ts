const RETRY_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a dynamic `import()` with one automatic retry.
 *
 * A Vite dev-server restart (or a tab left open across an update) makes the first
 * import of a screen fail with "error loading dynamically imported module". React
 * caches a rejected `lazy` payload forever, so without a retry inside the factory
 * the only way out is a full page reload.
 */
export function withChunkRetry<T>(load: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await load();
    } catch {
      await delay(RETRY_DELAY_MS);
      try {
        return await load();
      } catch {
        throw new Error('This screen could not be loaded. Reload the page to continue.');
      }
    }
  };
}

/** True when the failure was a chunk/module load rather than a render crash. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('dynamically imported module') ||
    message.includes('could not be loaded') ||
    message.includes('Failed to fetch dynamically imported module')
  );
}
