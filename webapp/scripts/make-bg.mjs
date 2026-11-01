import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bgDir = join(scriptDir, '..', 'public', 'bg');
const themeDir = join(scriptDir, '..', 'src', 'theme');

mkdirSync(bgDir, { recursive: true });

const SOURCES = {
  app: {
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2560&q=85',
    photographer: 'Roman Mager',
    profileUrl: 'https://unsplash.com/@roman_mager',
    photoUrl: 'https://unsplash.com/photos/5mZ_M06Fc9g',
    description: 'Warm evening ambient celebration string lights with calm bokeh',
    license: 'Unsplash License (free to use, commercial and non-commercial)',
  },
  auth: {
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=2560&q=85',
    photographer: 'Aditya Chinchure',
    profileUrl: 'https://unsplash.com/@adityachinchure',
    photoUrl: 'https://unsplash.com/photos/ZhQCZjr9fHo',
    description: 'Festive evening celebration lights, stage glow, and crowd silhouette at dusk',
    license: 'Unsplash License (free to use, commercial and non-commercial)',
  },
};

const WIDTHS = [
  { suffix: '-640', width: 640, quality: 78 },
  { suffix: '-1280', width: 1280, quality: 80 },
  { suffix: '-1920', width: 1920, quality: 82 },
];

async function run() {
  console.log('Downloading and processing backdrop images from Unsplash...');
  const lqips = {};

  for (const [key, meta] of Object.entries(SOURCES)) {
    console.log(`Fetching ${key} backdrop (${meta.photographer})...`);
    const response = await fetch(meta.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${key}: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Generate LQIP placeholder (20px width blurred webp base64)
    const lqipBuffer = await sharp(buffer)
      .resize(24, 16, { fit: 'cover' })
      .webp({ quality: 20 })
      .toBuffer();
    lqips[key] = `data:image/webp;base64,${lqipBuffer.toString('base64')}`;

    // Process different WebP responsive widths
    for (const { suffix, width, quality } of WIDTHS) {
      const outPath = join(bgDir, `${key}${suffix}.webp`);
      const info = await sharp(buffer)
        .resize(width, Math.round((width * 9) / 16), { fit: 'cover', position: 'center' })
        .webp({ quality })
        .toFile(outPath);
      console.log(`Saved ${key}${suffix}.webp: ${Math.round(info.size / 1024)} KB`);
    }

    // Default 1920w file
    const defaultPath = join(bgDir, `${key}.webp`);
    await sharp(buffer)
      .resize(1920, 1080, { fit: 'cover', position: 'center' })
      .webp({ quality: 82 })
      .toFile(defaultPath);
  }

  // Write CREDITS.md
  const creditsContent = `# Backdrop Photographic Credits

The EventHub web application uses photographic backdrops under the **Unsplash License** (free to use for commercial and personal projects; no permission or attribution strictly required, but proudly credited below):

## 1. App Backdrop (\`public/bg/app*.webp\`)
- **Photographer**: Roman Mager ([@roman_mager](${SOURCES.app.profileUrl}))
- **Source**: [${SOURCES.app.photoUrl}](${SOURCES.app.photoUrl})
- **Description**: ${SOURCES.app.description}
- **License**: ${SOURCES.app.license}
- **Role in App**: Background texture for main site chrome (rich on Home/Explore/Hubs; heavily blurred and tinted on soft routes).

## 2. Auth & Landing Backdrop (\`public/bg/auth*.webp\`)
- **Photographer**: Aditya Chinchure ([@adityachinchure](${SOURCES.auth.profileUrl}))
- **Source**: [${SOURCES.auth.photoUrl}](${SOURCES.auth.photoUrl})
- **Description**: ${SOURCES.auth.description}
- **License**: ${SOURCES.auth.license}
- **Role in App**: Hero backdrop behind the login/signup authentication cards and public landing discovery hero.

---
*Generated via \`npm run assets:bg\` using Sharp.*
`;

  writeFileSync(join(bgDir, 'CREDITS.md'), creditsContent, 'utf8');
  console.log('Wrote public/bg/CREDITS.md');

  // Write src/theme/backgrounds.ts
  const backgroundsTs = `/**
 * Photographic background configuration and responsive asset manifests.
 *
 * All URLs pass through \`assetUrl\` so they resolve correctly both in local dev
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
      \`\${assetUrl('/bg/app-640.webp')} 640w\`,
      \`\${assetUrl('/bg/app-1280.webp')} 1280w\`,
      \`\${assetUrl('/bg/app-1920.webp')} 1920w\`,
    ].join(', '),
    lqip: '${lqips.app}',
    alt: '${SOURCES.app.description}',
    photographer: '${SOURCES.app.photographer}',
  },
  auth: {
    src: assetUrl('/bg/auth.webp'),
    srcSet: [
      \`\${assetUrl('/bg/auth-640.webp')} 640w\`,
      \`\${assetUrl('/bg/auth-1280.webp')} 1280w\`,
      \`\${assetUrl('/bg/auth-1920.webp')} 1920w\`,
    ].join(', '),
    lqip: '${lqips.auth}',
    alt: '${SOURCES.auth.description}',
    photographer: '${SOURCES.auth.photographer}',
  },
};
`;

  writeFileSync(join(themeDir, 'backgrounds.ts'), backgroundsTs, 'utf8');
  console.log('Wrote src/theme/backgrounds.ts');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
