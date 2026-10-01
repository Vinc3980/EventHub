/**
 * Generates the local seed video clips used by the Home feed posts.
 *
 *   npm run seed:video   (or: node scripts/make-seed-video.mjs)
 *
 * Output: public/seed/social-clip.mp4 and public/seed/gala-clip.mp4 — short,
 * small, local (the seed data may never reference remote media).
 * Requires the devDependency `ffmpeg-static`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const outDir = fileURLToPath(new URL('../public/seed/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const FONT = 'C\\:/Windows/Fonts/arial.ttf';

const clips = [
  {
    file: 'social-clip.mp4',
    colors: 'c0=0x2B5FFF:c1=0x7C3AED:c2=0xFF2E93:c3=0x16171A',
    text: 'EVENTHUB',
    sub: 'SOCIAL NIGHT',
  },
  {
    file: 'gala-clip.mp4',
    colors: 'c0=0x16171A:c1=0x2B5FFF:c2=0x17B26A:c3=0xFF2E93',
    text: 'EVENTHUB',
    sub: 'LIVE FROM ACCRA',
  },
  {
    file: 'wedding-clip.mp4',
    colors: 'c0=0xFF2E93:c1=0x7C3AED:c2=0x2B5FFF:c3=0x16171A',
    text: 'EVENTHUB',
    sub: 'WEDDING SEASON',
  },
  {
    file: 'tech-clip.mp4',
    colors: 'c0=0x2B5FFF:c1=0x16171A:c2=0x7C3AED:c3=0x17B26A',
    text: 'EVENTHUB',
    sub: 'TECH SUMMIT',
  },
];

for (const clip of clips) {
  const out = `${outDir}${clip.file}`;
  const gradient = `gradients=s=640x360:d=6:speed=0.07:nb_colors=4:${clip.colors}`;
  const filter = [
    `drawtext=fontfile=${FONT}:text='${clip.text}':fontsize=44:fontcolor=white@0.92:x=(w-text_w)/2:y=(h-text_h)/2-24`,
    `drawtext=fontfile=${FONT}:text='${clip.sub}':fontsize=20:fontcolor=white@0.75:x=(w-text_w)/2:y=(h-text_h)/2+34`,
  ].join(',');

  execFileSync(
    ffmpegPath,
    [
      '-y',
      '-f', 'lavfi',
      '-i', gradient,
      '-vf', filter,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '32',
      '-preset', 'veryfast',
      '-movflags', '+faststart',
      '-t', '6',
      out,
    ],
    { stdio: 'inherit' },
  );

  const kb = Math.round(statSync(out).size / 1024);
  console.log(`wrote ${clip.file} (${kb} KB)`);
}
