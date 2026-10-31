/**
 * Context that lets any screen open the shared event picker (section 3.6).
 * AppShell owns the single `<EventPickerSheet>` instance and provides this.
 */
import { createContext, useContext } from 'react';

interface EventToolContextValue {
  /** Open the picker for a `/organizer/events/:id/<tool>` template. */
  openEventTool: (template: string) => void;
}

const EventToolContext = createContext<EventToolContextValue>({
  openEventTool: () => undefined,
});

export const EventToolProvider = EventToolContext.Provider;

export function useEventTool(): EventToolContextValue {
  return useContext(EventToolContext);
}
