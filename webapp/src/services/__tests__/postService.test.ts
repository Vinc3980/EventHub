import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { Post } from '../../models';
import { firstValue } from '../../test/helpers';
import { resetDatabase } from '../../test/setup';
import { PostService } from '../postService';

describe('PostService', () => {
  const service = new PostService();

  beforeEach(async () => {
    await resetDatabase();
  });

  async function create(
    text: string,
    authorId = 'att-1',
    timestamp = new Date('2026-10-01T10:00:00.000Z'),
  ): Promise<string> {
    return service.createPost(new Post({ id: '', authorId, text, timestamp }));
  }

  async function read(postId: string): Promise<Post> {
    const row = await db.posts.get(postId);
    expect(row, postId).toBeDefined();
    return Post.fromMap(postId, row!);
  }

  it('createPost stores the row under a generated id', async () => {
    const postId = await create('Hello Accra');

    expect(postId).toMatch(/^post-/);
    const stored = await read(postId);
    expect(stored).toBeInstanceOf(Post);
    expect(stored.text).toBe('Hello Accra');
    expect(stored.authorId).toBe('att-1');
    expect(stored.comments).toEqual([]);
    expect(stored.commentCount).toBe(0);
  });

  it('feedPosts returns every post newest first', async () => {
    const older = await create('older post', 'att-1', new Date('2026-10-01T10:00:00.000Z'));
    const newer = await create('newer post', 'att-2', new Date('2026-10-02T10:00:00.000Z'));

    const feed = await firstValue(service.feedPosts());

    expect(feed.map((post) => post.id)).toEqual([newer, older]);
    expect(feed.map((post) => post.text)).toEqual(['newer post', 'older post']);
  });

  it('feedPostsByAuthors filters by author and yields an empty list for no authors', async () => {
    await create('from att-1', 'att-1', new Date('2026-10-01T10:00:00.000Z'));
    await create('from att-2', 'att-2', new Date('2026-10-02T10:00:00.000Z'));
    await create('from org-1', 'org-1', new Date('2026-10-03T10:00:00.000Z'));

    const following = await firstValue(service.feedPostsByAuthors(['att-1', 'org-1']));
    expect(following.map((post) => post.text)).toEqual(['from org-1', 'from att-1']);

    expect(await firstValue(service.feedPostsByAuthors([]))).toEqual([]);
    expect(await firstValue(service.feedPostsByAuthors(['nobody']))).toEqual([]);
  });

  it('addComment trims, ignores empty text and keeps comments/commentCount in sync', async () => {
    const postId = await create('post with comments', 'att-1');

    await service.addComment(postId, 'att-2', '   ');
    expect((await read(postId)).comments).toHaveLength(0);

    await service.addComment(postId, 'att-2', '  See you there!  ');
    await service.addComment(postId, 'att-3', 'Congratulations');

    const stored = await read(postId);
    expect(stored.comments).toHaveLength(2);
    expect(stored.commentCount).toBe(2);
    expect(stored.comments[0].text).toBe('See you there!');
    expect(stored.comments[0].authorId).toBe('att-2');
    expect(stored.comments[0].id).toMatch(/^cmt-/);
    expect(Number.isNaN(Date.parse(stored.comments[0].createdAt))).toBe(false);

    const row = await db.posts.get(postId);
    expect(row?.commentCount).toBe(2);
    expect((row?.comments as unknown[]).length).toBe(2);
  });

  it('removeComment only lets the comment author or the post owner delete', async () => {
    const postId = await create('my post', 'att-1');
    await service.addComment(postId, 'att-2', 'nice one');
    const first = (await read(postId)).comments[0];

    expect(await service.removeComment(postId, first.id, 'att-3')).toBe(false);
    expect((await read(postId)).comments).toHaveLength(1);

    expect(await service.removeComment(postId, first.id, 'att-2')).toBe(true);
    expect((await read(postId)).commentCount).toBe(0);

    await service.addComment(postId, 'att-2', 'again');
    const second = (await read(postId)).comments[0];
    expect(await service.removeComment(postId, second.id, 'att-1')).toBe(true);
    expect((await read(postId)).comments).toHaveLength(0);
    expect(await service.removeComment(postId, 'cmt-missing', 'att-1')).toBe(false);
  });

  it('toggleLike adds, then removes the uid', async () => {
    const postId = await create('liked post');

    await service.toggleLike(postId, 'att-1');
    expect((await read(postId)).likeIds).toEqual(['att-1']);

    await service.toggleLike(postId, 'att-2');
    expect((await read(postId)).likeIds).toEqual(['att-1', 'att-2']);

    await service.toggleLike(postId, 'att-1');
    expect((await read(postId)).likeIds).toEqual(['att-2']);
  });
});
