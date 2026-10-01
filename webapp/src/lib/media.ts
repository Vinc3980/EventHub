export type MediaKind = 'image' | 'video';

export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_POST_VIDEO_BYTES = 15_000_000;
export const MAX_COVER_IMAGE_BYTES = 3_000_000;
export const MAX_COVER_VIDEO_BYTES = 20_000_000;

/** Rejected when a file exceeds the caller's byte budget. */
export class MediaSizeError extends Error {
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super('file too large');
    this.name = 'MediaSizeError';
    this.maxBytes = maxBytes;
  }
}

/** 'image' / 'video' from the browser's MIME type, else null (unsupported file). */
export function mediaKindOf(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

/**
 * Reads a local file as a base64 data URL (WebDB has no blob store, so media
 * lives inline). Rejects with MediaSizeError when the file is over maxBytes.
 */
export function readFileAsDataUrl(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new MediaSizeError(maxBytes));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}
