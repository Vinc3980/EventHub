import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '..', 'public', 'seed');

const FONT = 'Arial, Helvetica, sans-serif';
const BRAND_START = '#2B5FFF';
const BRAND_END = '#A044C4';
const NEUTRAL_START = '#F3F4F6';
const NEUTRAL_END = '#9CA3AF';
const INK = '#111827';

const written = [];

function write(name, svg) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, name), svg, 'utf8');
  written.push(name);
}

function gradient(id, from, to) {
  return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>`;
}

function monogram(cx, cy, r, textSize, ink) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" fill-opacity="0.92"/>
    <text x="${cx}" y="${cy + textSize * 0.35}" text-anchor="middle" font-family="${FONT}" font-size="${textSize}" font-weight="700" fill="${ink}">EH</text>`;
}

function caption(cx, y, label, fill, size, spacing) {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="600" letter-spacing="${spacing}" fill="${fill}">${label}</text>`;
}

const weddingDecor = `<g fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="6">
      <circle cx="112" cy="92" r="44"/>
      <circle cx="168" cy="92" r="44"/>
      <circle cx="636" cy="416" r="50"/>
      <circle cx="694" cy="416" r="50"/>
    </g>`;

const funeralDecor = `<g fill="#FFFFFF" fill-opacity="0.40">
      <rect x="0" y="70" width="800" height="10"/>
      <rect x="0" y="420" width="800" height="10"/>
      <circle cx="96" cy="404" r="34" fill-opacity="0.55"/>
      <circle cx="704" cy="96" r="34" fill-opacity="0.55"/>
    </g>`;

const corporateDecor = `<g fill="#FFFFFF" fill-opacity="0.20">
      <rect x="56" y="368" width="64" height="112"/>
      <rect x="136" y="316" width="64" height="164"/>
      <rect x="216" y="272" width="64" height="208"/>
      <rect x="560" y="60" width="64" height="80"/>
      <rect x="640" y="60" width="64" height="120"/>
      <rect x="720" y="60" width="64" height="160"/>
    </g>`;

const socialDecor = `<g fill="#FFFFFF">
      <circle cx="92" cy="104" r="14" fill-opacity="0.55"/>
      <circle cx="164" cy="66" r="9" fill-opacity="0.45"/>
      <circle cx="712" cy="118" r="12" fill-opacity="0.50"/>
      <circle cx="644" cy="70" r="8" fill-opacity="0.40"/>
      <circle cx="88" cy="404" r="10" fill-opacity="0.45"/>
      <circle cx="740" cy="392" r="15" fill-opacity="0.50"/>
      <rect x="140" y="392" width="22" height="22" fill-opacity="0.35" transform="rotate(18 151 403)"/>
      <rect x="676" y="356" width="26" height="26" fill-opacity="0.35" transform="rotate(-14 689 369)"/>
    </g>`;

const fallbackDecor = `<g fill="#FFFFFF" fill-opacity="0.55">
      <circle cx="110" cy="110" r="40"/>
      <circle cx="700" cy="400" r="52"/>
      <rect x="640" y="72" width="96" height="16"/>
      <rect x="64" y="412" width="120" height="16"/>
    </g>`;

function cover(label, from, to, decor, dark) {
  const ink = dark ? BRAND_START : '#FFFFFF';
  const sub = label === 'EVENTHUB' ? '' : `\n    ${caption(400, 404, 'EVENTHUB', ink, 16, 5)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-label="${label} cover">
  <defs>
    ${gradient('coverGrad', from, to)}
  </defs>
  <rect width="800" height="500" fill="url(#coverGrad)"/>
  <circle cx="662" cy="88" r="176" fill="#FFFFFF" fill-opacity="0.10"/>
  <circle cx="120" cy="432" r="152" fill="#FFFFFF" fill-opacity="0.08"/>
  ${decor}
  ${monogram(400, 214, 78, 54, BRAND_START)}
  ${caption(400, 362, label, dark ? INK : '#FFFFFF', 30, 8)}${sub}
</svg>
`;
}

function banner() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400" role="img" aria-label="EventHub banner">
  <defs>
    ${gradient('bannerGrad', BRAND_START, BRAND_END)}
  </defs>
  <rect width="1200" height="400" fill="url(#bannerGrad)"/>
  <circle cx="1020" cy="70" r="190" fill="#FFFFFF" fill-opacity="0.10"/>
  <circle cx="1130" cy="330" r="120" fill="#FFFFFF" fill-opacity="0.08"/>
  <circle cx="80" cy="340" r="140" fill="#FFFFFF" fill-opacity="0.07"/>
  <g fill="#FFFFFF" fill-opacity="0.35">
    <circle cx="960" cy="300" r="10"/>
    <circle cx="1010" cy="250" r="7"/>
    <circle cx="880" cy="340" r="8"/>
    <rect x="900" y="180" width="18" height="18" transform="rotate(20 909 189)"/>
  </g>
  ${monogram(240, 200, 96, 66, BRAND_START)}
  <text x="400" y="196" font-family="${FONT}" font-size="66" font-weight="700" letter-spacing="4" fill="#FFFFFF">EVENTHUB</text>
  <text x="404" y="244" font-family="${FONT}" font-size="20" font-weight="600" letter-spacing="7" fill="#FFFFFF" fill-opacity="0.88">PLAN, PROMOTE, GATHER</text>
</svg>
`;
}

const avatarPalettes = [
  [BRAND_START, BRAND_END],
  ['#2B5FFF', '#8E3FBF'],
  ['#1F4FE0', BRAND_END],
  ['#3D6BFF', '#A044C4'],
  ['#2B5FFF', '#8A35B0'],
  ['#4757FF', '#9A3FC4'],
];

function avatar(index, from, to) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="EventHub avatar ${index}">
  <defs>
    ${gradient('avatarGrad', from, to)}
  </defs>
  <rect width="200" height="200" rx="100" ry="100" fill="url(#avatarGrad)"/>
  <circle cx="100" cy="100" r="74" fill="#FFFFFF" fill-opacity="0.16"/>
  <circle cx="100" cy="100" r="92" fill="none" stroke="#FFFFFF" stroke-opacity="0.40" stroke-width="4"/>
  <text x="100" y="124" text-anchor="middle" font-family="${FONT}" font-size="66" font-weight="700" fill="#FFFFFF">EH</text>
</svg>
`;
}

write('wedding.svg', cover('WEDDING', BRAND_START, BRAND_END, weddingDecor, false));
write('funeral.svg', cover('MEMORIAL', NEUTRAL_START, NEUTRAL_END, funeralDecor, true));
write('corporate.svg', cover('CORPORATE', BRAND_START, BRAND_END, corporateDecor, false));
write('social.svg', cover('SOCIAL', BRAND_START, BRAND_END, socialDecor, false));
write('fallback.svg', cover('EVENTHUB', NEUTRAL_START, NEUTRAL_END, fallbackDecor, true));
write('banner.svg', banner());
for (let i = 0; i < avatarPalettes.length; i++) {
  const [from, to] = avatarPalettes[i];
  write(`avatar-${i + 1}.svg`, avatar(i + 1, from, to));
}

process.stdout.write(`wrote ${written.length} files to public/seed: ${written.join(', ')}\n`);
