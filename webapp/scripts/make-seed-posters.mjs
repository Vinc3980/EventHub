/**
 * Generates poster frames for the seed videos.
 *
 *   npm run seed:posters   (or: node scripts/make-seed-posters.mjs)
 *
 * For every `public/seed/**\/*.mp4` (generated clips + imported wallpaper bundle)
 * writes `<name>.poster.jpg` next to it — the feed shows this frame instead of a
 * black box (or the old SVG artwork) until the video is played.
 * Requires the devDependency `ffmpeg-static`.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const seedDir = fileURLToPath(new URL('../public/seed/', import.meta.url));
const dirs = [seedDir, join(seedDir, 'wallpapers')];
let created = 0;

for (const dir of dirs) {
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.mp4')) continue;
    const source = join(dir, name);
    const poster = source.replace(/\.mp4$/, '.poster.jpg');
    const needsPoster =
      !exists(poster) || statSync(poster).mtimeMs < statSync(source).mtimeMs;
    if (!needsPoster) continue;

    execFileSync(
      ffmpegPath,
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        '0.5',
        '-i',
        source,
        '-frames:v',
        '1',
        '-vf',
        'scale=640:-2',
        '-q:v',
        '5',
        poster,
      ],
      { stdio: 'inherit' },
    );
    created += 1;
    console.log(`wrote ${poster.slice(poster.indexOf('seed'))} (${kb(poster)} KB)`);
  }
}

console.log(`done — ${created} poster(s) generated`);

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function kb(path) {
  return Math.round(statSync(path).size / 1024);
}
