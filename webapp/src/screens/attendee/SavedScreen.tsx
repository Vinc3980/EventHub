import { useState } from 'react';
import { Star1 } from 'iconsax-react';
import { EmptyState, ErrorState, EventCard, Skeleton } from '../../components/ui';
import { useLive } from '../../db/live';
import { useSavedEvents } from '../../hooks/useSavedEvents';
import { EventService } from '../../services';
import { Event } from '../../models';

export default function SavedScreen() {
  const { savedIds, isSaved, toggleSave } = useSavedEvents();
  const eventService = new EventService();
  const [retry, setRetry] = useState(0);
  const savedKey = savedIds.join(',');

  const { data: events, loading, error } = useLive<Event[]>(
    async () => {
      const out: Event[] = [];
      for (const eventId of savedKey.split(',').filter((id) => id.length > 0)) {
        const ev = await eventService.getEvent(eventId);
        if (ev) out.push(ev);
      }
      return out;
    },
    [savedKey, retry],
  );

  if (error) {
    return <ErrorState title="Saved events could not be loaded." onRetry={() => setRetry((n) => n + 1)} />;
  }

  if (loading || events === undefined) {
    return (
      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3" aria-busy="true" aria-label="Loading saved events">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Star1 size={26} />}
        title="No saved events"
        body="Bookmark events to find them here later."
      />
    );
  }

  return (
    <div className="animate-fadeup grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
      {events.map((ev) => (
        <EventCard
          key={ev.id}
          ev={ev}
          saved={isSaved(ev.id)}
          onSave={() => toggleSave(ev.id)}
          href={`/event/${ev.id}`}
        />
      ))}
    </div>
  );
}
