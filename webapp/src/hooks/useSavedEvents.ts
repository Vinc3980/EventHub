import { useCallback, useMemo } from 'react';
import { useAuth } from '../app/AuthProvider';
import { AuthService } from '../services/authService';

const auth = new AuthService();

/** Saved (bookmarked) event ids for the signed-in user, live. */
export function useSavedEvents(): {
  savedIds: string[];
  isSaved: (eventId: string) => boolean;
  toggleSave: (eventId: string) => void;
  saving: boolean;
} {
  const { uid, user } = useAuth();
  const savedIds = useMemo(() => user?.savedEventIds ?? [], [user]);
  const isSaved = useCallback(
    (eventId: string) => savedIds.includes(eventId),
    [savedIds],
  );

  const toggleSave = useCallback(
    (eventId: string) => {
      if (!uid) return;
      void auth.toggleSaveEvent(uid, eventId);
    },
    [uid],
  );

  return { savedIds, isSaved, toggleSave, saving: !user };
}
