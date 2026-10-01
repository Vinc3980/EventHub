import { liveQuery, type Observable } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { Review } from '../models';

type Row = Record<string, unknown>;

const rowId = (row: Row): string => String(row.id ?? '');

const matchesOrganizer = (row: Row, organizerId: string, eventIds: Set<string>): boolean =>
  row.organizerId === organizerId || eventIds.has(String(row.eventId ?? ''));

export class ReviewService {
  async addReview(review: Review): Promise<string> {
    const reviewId = id('rev');
    await db.reviews.put({ ...review.toMap(), id: reviewId });
    return reviewId;
  }

  private async eventIdsForOrganizer(organizerId: string): Promise<Set<string>> {
    const rows = await db.events.toArray();
    const eventIds = new Set<string>();
    for (const row of rows) {
      if (row.ownerId === organizerId) {
        eventIds.add(rowId(row));
      } else if (
        Array.isArray(row.collaboratorIds) &&
        row.collaboratorIds.includes(organizerId)
      ) {
        eventIds.add(rowId(row));
      }
    }
    return eventIds;
  }

  reviewsForOrganizer(organizerId: string): Observable<Review[]> {
    return liveQuery(async () => {
      const eventIds = await this.eventIdsForOrganizer(organizerId);
      const rows = await db.reviews.toArray();
      const reviews = rows
        .filter((row) => matchesOrganizer(row, organizerId, eventIds))
        .map((row) => Review.fromMap(rowId(row), row));
      reviews.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return reviews;
    });
  }

  reviewsForEvent(eventId: string): Observable<Review[]> {
    return liveQuery(async () => {
      const rows = await db.reviews.toArray();
      return rows
        .filter((row) => row.eventId === eventId)
        .map((row) => Review.fromMap(rowId(row), row));
    });
  }

  async averageRating(organizerId: string): Promise<number> {
    const eventIds = await this.eventIdsForOrganizer(organizerId);
    const rows = await db.reviews.toArray();
    let total = 0;
    let count = 0;
    for (const row of rows) {
      if (matchesOrganizer(row, organizerId, eventIds)) {
        total += Number(row.rating ?? 0);
        count++;
      }
    }
    return count === 0 ? 0 : total / count;
  }

  async reviewCount(organizerId: string): Promise<number> {
    const eventIds = await this.eventIdsForOrganizer(organizerId);
    const rows = await db.reviews.toArray();
    let count = 0;
    for (const row of rows) {
      if (matchesOrganizer(row, organizerId, eventIds)) count++;
    }
    return count;
  }

  async hasReviewed(params: { eventId: string; attendeeId: string }): Promise<boolean> {
    const rows = await db.reviews.toArray();
    return rows.some(
      (row) =>
        row.eventId === params.eventId &&
        (row.userId === params.attendeeId || row.attendeeId === params.attendeeId),
    );
  }
}

export const reviewService = new ReviewService();
