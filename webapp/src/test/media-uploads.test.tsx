import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { db, setSessionUid } from '../db/db';
import { Event, Post } from '../models';
import {
  MAX_COVER_IMAGE_BYTES,
  MAX_POST_VIDEO_BYTES,
  MediaSizeError,
  mediaKindOf,
  readFileAsDataUrl,
} from '../lib/media';
import { seedIfEmpty } from '../services/seedService';
import { PostFrame } from '../components/feed/PostFrame';
import { AppVideoPlayer } from '../components/media/AppVideoPlayer';
import { putEvent } from './helpers';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
});

describe('local media helper', () => {
  it('reads a file as a data URL when it is inside the budget', async () => {
    const file = new File(['clip bytes'], 'clip.mp4', { type: 'video/mp4' });
    const url = await readFileAsDataUrl(file, 1024);
    expect(url.startsWith('data:video/mp4')).toBe(true);
  });

  it('rejects oversize files with MediaSizeError before reading them', async () => {
    const file = new File([new ArrayBuffer(64)], 'big.mp4', { type: 'video/mp4' });
    await expect(readFileAsDataUrl(file, 16)).rejects.toBeInstanceOf(MediaSizeError);
  });

  it('classifies image, video and unsupported files', () => {
    expect(mediaKindOf(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe('image');
    expect(mediaKindOf(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBe('video');
    expect(mediaKindOf(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
  });
});

describe('video cover detection', () => {
  it('flags data-URL and file-extension video covers', () => {
    expect(Event.isVideo('data:video/mp4;base64,AAAA')).toBe(true);
    expect(Event.isVideo('data:video/webm;base64,AAAA')).toBe(true);
    expect(Event.isVideo('data:image/png;base64,AAAA')).toBe(false);
    expect(Event.isVideo('/seed/social-clip.mp4')).toBe(true);
    expect(Event.isVideo('/seed/social.svg')).toBe(false);
    expect(Event.isVideo('')).toBe(false);
  });
});

describe('composer video attachment', () => {
  it('warns about videos over 15 MB, then shares a small one as a video post', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/home');
    render(<App />);

    const prompt = await screen.findByRole(
      'button',
      { name: /Share an update/ },
      { timeout: 10_000 },
    );
    await userEvent.click(prompt);
    const textarea = await screen.findByLabelText('Share an update', {}, { timeout: 10_000 });
    await userEvent.type(textarea, 'Last night was unreal');

    const videoButton = await screen.findByRole('button', { name: 'Video' }, { timeout: 10_000 });
    const form = videoButton.closest('form');
    expect(form).not.toBeNull();
    const input = form!.querySelector('input[type="file"]') as HTMLInputElement;

    // The Video button narrows the picker to video files before clicking.
    await userEvent.click(videoButton);
    expect(input.accept).toBe('video/*');

    await userEvent.upload(
      input,
      new File([new ArrayBuffer(MAX_POST_VIDEO_BYTES + 1)], 'huge.mp4', {
        type: 'video/mp4',
      }),
    );
    expect(
      await screen.findByText('That video is too large — keep it under 15 MB.', {}, {
        timeout: 10_000,
      }),
    ).toBeInTheDocument();

    await userEvent.upload(input, new File(['tiny'], 'clip.mp4', { type: 'video/mp4' }));
    expect(
      await screen.findByLabelText('Video attachment preview', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove video' })).toBeInTheDocument();

    await userEvent.click(within(form!).getByRole('button', { name: 'Post' }));
    await waitFor(
      async () => {
        const posts = await db.posts.toArray();
        expect(
          posts.some(
            (post) =>
              post.isVideo === true &&
              String(post.mediaUrl ?? '').startsWith('data:video/mp4'),
          ),
        ).toBe(true);
      },
      { timeout: 10_000 },
    );
  }, 40_000);
});

describe('create-event cover upload', () => {
  it('uploads an image cover from the device', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/organizer/events/new');
    render(<App />);

    const coverButton = await screen.findByRole(
      'button',
      { name: /Tap to add cover image/ },
      { timeout: 10_000 },
    );
    await userEvent.click(coverButton);
    const dialog = await screen.findByRole('dialog', {}, { timeout: 10_000 });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Upload from your device/ }),
    );

    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['pic'], 'cover.jpg', { type: 'image/jpeg' }));

    await waitFor(
      () => {
        const img = coverButton.querySelector('img');
        expect(img?.getAttribute('src')).toMatch(/^data:image\/jpeg/);
      },
      { timeout: 10_000 },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 40_000);

  it('rejects oversized cover images and renders a video cover', async () => {
    await seedIfEmpty();
    await setSessionUid('att-1');
    window.history.pushState({}, '', '/organizer/events/new');
    render(<App />);

    const coverButton = await screen.findByRole(
      'button',
      { name: /Tap to add cover image/ },
      { timeout: 10_000 },
    );
    await userEvent.click(coverButton);
    const dialog = await screen.findByRole('dialog', {}, { timeout: 10_000 });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Upload from your device/ }),
    );
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(
      input,
      new File([new ArrayBuffer(MAX_COVER_IMAGE_BYTES + 1)], 'huge.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(
      await screen.findByText('That image is too large — keep it under 3 MB.', {}, {
        timeout: 10_000,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    await userEvent.upload(input, new File(['clip'], 'cover.mp4', { type: 'video/mp4' }));
    await waitFor(
      () => {
        expect(coverButton.querySelector('video')).not.toBeNull();
      },
      { timeout: 10_000 },
    );
  }, 40_000);
});

describe('post video poster frames', () => {
  it('uses the generated local poster for seed videos and omits it for uploads', () => {
    const seedVideo = new Post({
      id: 'post-seed-video',
      authorId: 'att-1',
      text: 'Stage build update',
      mediaUrl: '/seed/social-clip.mp4',
      isVideo: true,
      timestamp: new Date('2026-01-01T10:00:00.000Z'),
    });
    const seedView = render(
      <PostFrame
        post={seedVideo}
        liked={false}
        onLike={() => undefined}
        onComment={() => undefined}
      />,
    );
    const seedTag = seedView.container.querySelector('video');
    expect(seedTag).not.toBeNull();
    expect(seedTag?.getAttribute('poster')).toBe('/seed/social-clip.poster.jpg');
    seedView.unmount();

    const upload = new Post({
      id: 'post-upload-video',
      authorId: 'att-1',
      text: 'From my phone',
      mediaUrl: 'data:video/mp4;base64,AAAA',
      isVideo: true,
      timestamp: new Date('2026-01-01T10:00:00.000Z'),
    });
    const uploadView = render(
      <PostFrame
        post={upload}
        liked={false}
        onLike={() => undefined}
        onComment={() => undefined}
      />,
    );
    const uploadTag = uploadView.container.querySelector('video');
    expect(uploadTag).not.toBeNull();
    expect(uploadTag?.getAttribute('poster')).toBeNull();
  });
});

describe('event gallery media (Photos & video)', () => {
  async function openCreateForm(): Promise<HTMLInputElement> {
    await seedIfEmpty();
    await setSessionUid('org-1');
    window.history.pushState({}, '', '/organizer/events/new');
    render(<App />);
    const heading = await screen.findByRole(
      'heading',
      { name: 'Photos & video' },
      { timeout: 10_000 },
    );
    const section = heading.closest('section');
    expect(section).not.toBeNull();
    const input = section!.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe('image/*,video/*');
    return input;
  }

  it('adds picked photos as removable thumbnails and saves them with the draft', async () => {
    const input = await openCreateForm();

    await userEvent.upload(input, new File(['beach day'], 'beach.jpg', { type: 'image/jpeg' }));
    const remove = await screen.findByLabelText('Remove photo 1', {}, { timeout: 10_000 });
    expect(remove).toBeInTheDocument();

    const title = await screen.findByLabelText(/^Event title/, {}, { timeout: 10_000 });
    await userEvent.type(title, 'Gallery Night');
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    await waitFor(
      async () => {
        const events = await db.events.toArray();
        const draft = events.find((event) => event.title === 'Gallery Night');
        expect(draft).toBeDefined();
        const mediaUrls = (draft!.mediaUrls as string[] | undefined) ?? [];
        expect(mediaUrls).toHaveLength(1);
        expect(mediaUrls[0].startsWith('data:image/jpeg')).toBe(true);
      },
      { timeout: 10_000 },
    );
  }, 40_000);

  it('caps the gallery at 12 items with a note and hides the Add tile', async () => {
    const input = await openCreateForm();
    const files = Array.from({ length: 13 }, (_, index) =>
      new File([`photo ${index}`], `photo-${index}.jpg`, { type: 'image/jpeg' }),
    );
    await userEvent.upload(input, files);

    await waitFor(
      () => {
        expect(screen.getAllByLabelText(/^Remove (photo|video) /)).toHaveLength(12);
      },
      { timeout: 10_000 },
    );
    expect(await screen.findByText('You can add up to 12 items.', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText('12/12 added')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add media' })).not.toBeInTheDocument();
  }, 40_000);

  it('opens the gallery from an existing event, minus the cover', async () => {
    await seedIfEmpty();
    await setSessionUid('org-1');
    await putEvent({
      id: 'ev-gallery',
      title: 'Existing gallery',
      coverImageUrl: '/seed/social.svg',
      mediaUrls: [
        '/seed/social.svg',
        '/seed/wallpapers/abaddon-kong-1920x1080-18152.jpg',
        '/seed/wallpapers/19259-300109084_medium.mp4',
      ],
    });
    window.history.pushState({}, '', '/organizer/events/ev-gallery/edit');
    render(<App />);

    expect(await screen.findByLabelText('Remove photo 1', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByLabelText('Remove video 2', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Remove (photo|video) /)).toHaveLength(2);
    expect(screen.getByLabelText('Video 2 preview')).toBeInTheDocument();
  }, 40_000);
});

describe('custom video player', () => {
  it('replaces native controls with the app control bar', async () => {
    const { container } = render(
      <AppVideoPlayer
        src="/seed/social-clip.mp4"
        poster="/seed/social-clip.poster.jpg"
        className="max-h-[70vh] w-full"
        loop
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video!.hasAttribute('controls')).toBe(false);
    expect(video!.getAttribute('poster')).toBe('/seed/social-clip.poster.jpg');
    expect(video!.hasAttribute('loop')).toBe(true);

    const slider = screen.getByRole('slider', { name: 'Seek' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(await screen.findByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  }, 30_000);
});
