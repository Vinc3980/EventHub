import { liveQuery, type Observable } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { Post } from '../models';

const rowId = (row: Record<string, unknown>): string => String(row.id ?? '');

function hydrate(row: Record<string, unknown>): Post {
  return Post.fromMap(rowId(row), row);
}

function newestFirst(posts: Post[]): Post[] {
  return posts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export class PostService {
  async createPost(post: Post): Promise<string> {
    const postId = id('post');
    await db.posts.put({ ...post.toMap(), id: postId });
    return postId;
  }

  postsForEvent(eventId: string): Observable<Post[]> {
    return liveQuery(async () => {
      const rows = await db.posts.toArray();
      const posts = rows.filter((row) => row.eventId === eventId).map(hydrate);
      return newestFirst(posts);
    });
  }

  /** Every post in the feed, newest first. */
  feedPosts(): Observable<Post[]> {
    return liveQuery(async () => {
      const rows = await db.posts.toArray();
      return newestFirst(rows.map(hydrate));
    });
  }

  /** Posts written by anyone in `authorIds` (an empty list yields an empty feed). */
  feedPostsByAuthors(authorIds: string[]): Observable<Post[]> {
    const wanted = new Set(authorIds.filter((authorId) => authorId.length > 0));
    return liveQuery(async () => {
      if (wanted.size === 0) return [];
      const rows = await db.posts.toArray();
      const posts = rows
        .filter((row) => wanted.has(String(row.authorId ?? '')))
        .map(hydrate);
      return newestFirst(posts);
    });
  }

  postById(postId: string): Observable<Post | null> {
    return liveQuery(async () => {
      const row = await db.posts.get(postId);
      return row ? hydrate(row) : null;
    });
  }

  /** Appends a trimmed comment and keeps `commentCount` in sync. Empty text is ignored. */
  async addComment(postId: string, authorId: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed === '') return;
    const row = await db.posts.get(postId);
    if (!row) return;
    const post = hydrate(row);
    post.comments = [
      ...post.comments,
      { id: id('cmt'), authorId, text: trimmed, createdAt: new Date().toISOString() },
    ];
    post.commentCount = post.comments.length;
    await db.posts.put({ ...post.toMap(), id: postId });
  }

  /**
   * Removes a comment. The caller passes the signed-in uid; only the comment's
   * author (or the post's author) may delete it. Resolves `false` when nothing
   * was removed so the UI can explain why.
   */
  async removeComment(postId: string, commentId: string, requesterId: string): Promise<boolean> {
    const row = await db.posts.get(postId);
    if (!row) return false;
    const post = hydrate(row);
    const target = post.comments.find((comment) => comment.id === commentId);
    if (!target) return false;
    if (target.authorId !== requesterId && post.authorId !== requesterId) return false;
    post.comments = post.comments.filter((comment) => comment.id !== commentId);
    post.commentCount = post.comments.length;
    await db.posts.put({ ...post.toMap(), id: postId });
    return true;
  }

  /** Adds the uid to `likeIds`, or removes it when already present. */
  async toggleLike(postId: string, uid: string): Promise<void> {
    const row = await db.posts.get(postId);
    if (!row) return;
    const post = hydrate(row);
    post.likeIds = post.likeIds.includes(uid)
      ? post.likeIds.filter((likeId) => likeId !== uid)
      : [...post.likeIds, uid];
    await db.posts.put({ ...post.toMap(), id: postId });
  }

  async deletePost(postId: string): Promise<void> {
    await db.posts.delete(postId);
  }
}

export const postService = new PostService();
