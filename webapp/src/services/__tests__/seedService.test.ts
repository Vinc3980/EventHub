import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { resetDatabase } from '../../test/setup';
import { SEED_VIDEO_MAX_BYTES, WALLPAPER_IMAGES, WALLPAPER_VIDEOS } from '../seedMedia';
import { seedIfEmpty } from '../seedService';

describe('seedIfEmpty', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates 27 users and 100 events on the first run', async () => {
    await seedIfEmpty();

    expect(await db.users.count()).toBe(27);
    expect(await db.auth.count()).toBe(27);
    expect(await db.events.count()).toBe(100);
    expect(await db.chats.count()).toBe(10);
    expect(await db.registrations.count()).toBeGreaterThan(0);
    expect(await db.bookings.count()).toBeGreaterThan(0);
  });

  it('is idempotent — a second run does not duplicate or wipe data', async () => {
    await seedIfEmpty();
    await db.events.put({
      id: 'manual-event',
      ownerId: 'org-1',
      title: 'Added after seeding',
      category: 'social',
      date: new Date('2026-12-01T10:00:00.000Z'),
      status: 'published',
      ticketTypes: [],
      mediaUrls: [],
      collaboratorIds: [],
    });

    await seedIfEmpty();

    expect(await db.users.count()).toBe(27);
    expect(await db.events.count()).toBe(101);
    expect(await db.events.get('manual-event')).toBeDefined();
  });

  it('only uses local /seed/ artwork — never remote URLs', async () => {
    await seedIfEmpty();

    const events = await db.events.toArray();
    expect(events.length).toBe(100);
    for (const event of events) {
      const cover = String(event.coverImageUrl ?? '');
      expect(cover.startsWith('/seed/')).toBe(true);
      expect(cover.startsWith('http')).toBe(false);

      const media = (event.mediaUrls as string[] | undefined) ?? [];
      expect(media.length).toBeGreaterThan(0);
      for (const url of media) {
        expect(url.startsWith('/seed/')).toBe(true);
        expect(url.startsWith('http')).toBe(false);
      }
    }

    const users = await db.users.toArray();
    for (const user of users) {
      expect(String(user.avatarUrl ?? '').startsWith('/seed/')).toBe(true);
      expect(String(user.bannerUrl ?? '').startsWith('/seed/')).toBe(true);
    }
  });

  it('seeds a Home feed of posts with local media, videos and comments', async () => {
    await seedIfEmpty();

    const posts = await db.posts.toArray();
    expect(posts.length).toBeGreaterThanOrEqual(30);
    expect(posts.length).toBeLessThanOrEqual(40);

    let withComments = 0;
    let videos = 0;
    let linkedToEvents = 0;
    for (const post of posts) {
      const media = String(post.mediaUrl ?? '');
      if (media !== '') {
        expect(media.startsWith('/seed/')).toBe(true);
        expect(media.startsWith('http')).toBe(false);
      }
      if (post.isVideo === true) videos += 1;
      if (typeof post.eventId === 'string' && post.eventId !== '') linkedToEvents += 1;

      const comments = Array.isArray(post.comments) ? (post.comments as unknown[]) : [];
      expect(Number(post.commentCount ?? 0)).toBe(comments.length);
      if (comments.length > 0) withComments += 1;
      for (const comment of comments as Array<Record<string, unknown>>) {
        expect(typeof comment.text).toBe('string');
        expect(String(comment.text).length).toBeGreaterThan(0);
        expect(String(comment.authorId ?? '')).not.toBe('');
      }
    }

    expect(videos).toBeGreaterThanOrEqual(6);
    expect(videos).toBeLessThanOrEqual(9);
    expect(withComments).toBeGreaterThanOrEqual(12);
    expect(linkedToEvents).toBeGreaterThanOrEqual(8);
    expect(posts.some((post) => post.mediaUrl === '/seed/social-clip.mp4')).toBe(true);
    expect(posts.some((post) => post.mediaUrl === '/seed/gala-clip.mp4')).toBe(true);
    expect(posts.some((post) => post.mediaUrl === '/seed/wedding-clip.mp4')).toBe(true);
    expect(posts.some((post) => post.mediaUrl === '/seed/tech-clip.mp4')).toBe(true);

    // Every seed video ships a generated poster frame next to the file, so the
    // feed never has to fall back to the old SVG artwork as a poster.
    for (const post of posts) {
      const media = String(post.mediaUrl ?? '');
      if (post.isVideo !== true || !media.endsWith('.mp4')) continue;
      const poster = join(process.cwd(), 'public', `${media.slice(0, -4)}.poster.jpg`);
      expect(existsSync(poster)).toBe(true);
    }
  });

  it('uses the wallpaper bundle: images imported with no size limit, videos capped', async () => {
    const dir = join(process.cwd(), 'public', 'seed', 'wallpapers');
    const files = readdirSync(dir);
    const imageFiles = files.filter(
      (name) => /\.(avif|gif|jpe?g|png|webp)$/i.test(name) && !name.endsWith('.poster.jpg'),
    );
    const videoFiles = files.filter((name) => /\.(m4v|mov|mp4|webm)$/i.test(name));

    // Every image in the bundle is imported — images carry no size limit.
    expect(imageFiles.length).toBeGreaterThan(0);
    expect(WALLPAPER_IMAGES.length).toBe(imageFiles.length);
    for (const name of imageFiles) expect(WALLPAPER_IMAGES).toContain(`/seed/wallpapers/${name}`);

    // Every imported video exists on disk and is at or under the cap.
    expect(videoFiles.length).toBeGreaterThan(0);
    expect(WALLPAPER_VIDEOS.length).toBe(videoFiles.length);
    for (const url of WALLPAPER_VIDEOS) {
      const name = url.slice(url.lastIndexOf('/') + 1);
      expect(videoFiles).toContain(name);
      expect(statSync(join(dir, name)).size).toBeLessThanOrEqual(SEED_VIDEO_MAX_BYTES);
    }

    await seedIfEmpty();

    // The bundle drives event covers and feed media.
    const events = await db.events.toArray();
    for (const event of events) {
      expect(String(event.coverImageUrl ?? '')).toMatch(/^\/seed\/wallpapers\//);
    }

    const posts = await db.posts.toArray();
    const wallpaperImages = posts.filter((post) =>
      String(post.mediaUrl ?? '').startsWith('/seed/wallpapers/'),
    );
    expect(wallpaperImages.length).toBeGreaterThanOrEqual(10);
    expect(
      posts.some(
        (post) =>
          post.isVideo === true && String(post.mediaUrl ?? '').startsWith('/seed/wallpapers/'),
      ),
    ).toBe(true);
  });

  it('seeds a follow graph with matching follower counters', async () => {
    await seedIfEmpty();

    const users = await db.users.toArray();
    const uids = new Set(users.map((user) => String(user.uid ?? '')));
    const follows = await db.follows.toArray();
    expect(follows.length).toBeGreaterThan(60);

    for (const follow of follows) {
      const followerId = String(follow.followerId ?? '');
      const followingId = String(follow.followingId ?? '');
      expect(followerId).not.toBe('');
      expect(followingId).not.toBe('');
      expect(followerId).not.toBe(followingId);
      expect(uids.has(followerId)).toBe(true);
      expect(uids.has(followingId)).toBe(true);
    }

    for (const user of users) {
      const uid = String(user.uid ?? '');
      expect(Number(user.followers ?? -1)).toBe(
        follows.filter((follow) => String(follow.followingId ?? '') === uid).length,
      );
      expect(Number(user.following ?? -1)).toBe(
        follows.filter((follow) => String(follow.followerId ?? '') === uid).length,
      );
    }

    // att-14 is the "brand new account" — it follows nobody, so the Home
    // recommendation state is reachable out of the box.
    expect(follows.filter((follow) => String(follow.followerId ?? '') === 'att-14')).toHaveLength(
      0,
    );
    expect((await db.follows.where('followerId').equals('att-1').count())).toBeGreaterThan(0);
  });

  it('seeds every demo account with the demo123 password hash', async () => {
    await seedIfEmpty();
    const rows = await db.auth.toArray();
    expect(rows).toHaveLength(27);
    for (const row of rows) {
      expect(row.passwordHash).not.toBe('demo123');
      expect(row.passwordHash).toContain('$');
    }
  });
});
