import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TickCircle } from 'iconsax-react';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  Stars,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../../app/ToastProvider';
import { useLive } from '../../db/live';
import { EventService, ReviewService } from '../../services';
import { Event, Review } from '../../models';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

export default function RateOrganizerScreen() {
  const { eventId = '' } = useParams();
  const eventService = new EventService();
  const { uid } = useAuth();
  const navigate = useNavigate();
  const { error: showError } = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [retry, setRetry] = useState(0);

  const reviewService = useMemo(() => new ReviewService(), []);

  const { data: event, loading, error } = useLive<Event | null>(
    () => eventService.getEvent(eventId),
    [eventId, retry],
  );

  const hasReviewed =
    useLive<boolean>(
      () => reviewService.hasReviewed({ eventId, attendeeId: uid ?? '' }),
      [eventId, uid, retry, done],
    ).data ?? false;

  const locked = hasReviewed || done;

  async function submit() {
    if (!uid || busy) return;
    if (rating < 1) {
      setRatingError('Please select a rating.');
      return;
    }
    setRatingError(null);
    setBusy(true);
    try {
      await reviewService.addReview(
        new Review({
          id: '',
          eventId,
          userId: uid,
          rating,
          comment: comment.trim(),
          timestamp: new Date(),
        }),
      );
      setDone(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load event." onRetry={() => setRetry((n) => n + 1)} />;
  }

  if (!event) {
    return <EmptyState title="Event not found." />;
  }

  if (done) {
    return (
      <div className="animate-fadeup flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-successbg">
          <TickCircle size={30} className="text-success" />
        </span>
        <h1 className="mt-5 text-title text-textprimary">Thanks for your review!</h1>
        <p className="mt-2 text-body text-textmuted">
          Your feedback helps organizers improve future events.
        </p>
        <div className="mt-6 w-full max-w-[320px]">
          <Button fullWidth size="lg" onClick={() => navigate(-1)}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeup pb-4">
      <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <h1 className="text-title text-textprimary">Rate this event</h1>
        <p className="mt-1 text-subtitle text-textprimary">{`How was ${event.title}?`}</p>
        <p className="mt-1 text-body text-textmuted">
          Your feedback helps organizers create better experiences.
        </p>

        <fieldset disabled={locked} className="mt-6 min-w-0 border-0 p-0">
          <div className="flex flex-col items-center rounded-base bg-neutralbg px-4 py-6">
            <Stars
              value={rating}
              size={34}
              label="Tap a star to rate"
              onChange={(next) => {
                setRating(next);
                setRatingError(null);
              }}
            />
            <p className="mt-3 text-caption text-textmuted">
              {rating > 0 ? RATING_LABELS[rating] : 'Tap a star to rate'}
            </p>
          </div>

          {ratingError && <p className="mt-2 text-caption text-danger">{ratingError}</p>}

          <div className="mt-4">
            <Field label="Write a review (optional)...">
              <Textarea
                value={comment}
                maxLength={600}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Button fullWidth size="lg" loading={busy} disabled={hasReviewed} onClick={() => void submit()}>
              Submit review
            </Button>
          </div>
          {hasReviewed && (
            <p className="mt-2 text-center text-caption text-textmuted">
              You already reviewed this event.
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
}
