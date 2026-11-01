/**
 * Photographic background configuration and responsive asset manifests.
 *
 * All URLs pass through `assetUrl` so they resolve correctly both in local dev
 * ('/') and when hosted on GitHub Pages ('/EventHub/').
 */
import { assetUrl } from '../lib/asset';

export interface BackdropMeta {
  src: string;
  srcSet: string;
  lqip: string;
  alt: string;
  photographer: string;
}

export const BACKGROUNDS: { app: BackdropMeta; auth: BackdropMeta } = {
  app: {
    src: assetUrl('/bg/app.webp'),
    srcSet: [
      `${assetUrl('/bg/app-640.webp')} 640w`,
      `${assetUrl('/bg/app-1280.webp')} 1280w`,
      `${assetUrl('/bg/app-1920.webp')} 1920w`,
    ].join(', '),
    lqip: 'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAACQAwCdASoYABAAPzmGu1QvKSYjMAgB4CcJYwAAQP6SV5hEIHWAAP7L97v9zvmgl3J/bZRP/P2DfL35EPfm5Vr/h+2jdPNBbV4daaCAwNQPzIBLC8etVZE8UAA=',
    alt: 'Warm evening ambient celebration string lights with calm bokeh',
    photographer: 'Roman Mager',
  },
  auth: {
    src: assetUrl('/bg/auth.webp'),
    srcSet: [
      `${assetUrl('/bg/auth-640.webp')} 640w`,
      `${assetUrl('/bg/auth-1280.webp')} 1280w`,
      `${assetUrl('/bg/auth-1920.webp')} 1920w`,
    ].join(', '),
    lqip: 'data:image/webp;base64,UklGRnYAAABXRUJQVlA4IGoAAABQBACdASoYABAAPzmEuVOvKKWisAgB4CcJbAC1CMgCt4iZ5X+Q1Pxq9hAAAP7lHHZjGDQjxUWuUa10bIsveQVo8q5MVbMykoYqCn6oGaVQY6Nz/hp7AinMhgHeBSuQC9G4vHYFqZTGoAAA',
    alt: 'Festive evening celebration lights, stage glow, and crowd silhouette at dusk',
    photographer: 'Aditya Chinchure',
  },
};

export const BACKGROUND_CONFIG = BACKGROUNDS;

