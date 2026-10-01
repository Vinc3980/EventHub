import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '..', 'public', 'icons');

const PRIMARY = [0x2b, 0x5f, 0xff];
const ACCENT = [0xff, 0x2e, 0x93];
const DEEP_VIOLET = PRIMARY.map((c, i) => Math.round(c * 0.45 + ACCENT[i] * 0.55));

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function smooth(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = px - (x + w / 2);
  const cy = py - (y + h / 2);
  const qx = Math.abs(cx) - (w / 2 - r);
  const qy = Math.abs(cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

function monogramBars(size, glyphScale) {
  const width = size * 0.54 * glyphScale;
  const height = size * 0.4 * glyphScale;
  const x0 = (size - width) / 2;
  const y0 = (size - height) / 2;
  const t = height * 0.2;
  const gap = t * 1.1;
  const letterW = (width - gap) / 2;
  const radius = t / 2;
  const bars = [];
  const push = (x, y, w, h) => bars.push({ x, y, w, h, r: radius });

  push(x0, y0, t, height);
  push(x0, y0, letterW, t);
  push(x0, y0 + (height - t) / 2, letterW * 0.82, t);
  push(x0, y0 + height - t, letterW, t);

  const hx = x0 + letterW + gap;
  push(hx, y0, t, height);
  push(hx + letterW - t, y0, t, height);
  push(hx, y0 + (height - t) / 2, letterW, t);

  return bars;
}

function renderIcon(size, { fullBleed, glyphScale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = fullBleed ? 0 : size * 0.22;
  const bars = monogramBars(size, glyphScale);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const bgAlpha = smooth(0.5, -0.5, sdRoundRect(px, py, 0, 0, size, size, radius));

      let glyphSd = Infinity;
      for (const bar of bars) {
        glyphSd = Math.min(glyphSd, sdRoundRect(px, py, bar.x, bar.y, bar.w, bar.h, bar.r));
      }
      const glyphAlpha = smooth(0.5, -0.5, glyphSd);

      const t = clamp((x + y) / (2 * Math.max(1, size - 1)), 0, 1);
      const r = Math.round(PRIMARY[0] + (DEEP_VIOLET[0] - PRIMARY[0]) * t);
      const g = Math.round(PRIMARY[1] + (DEEP_VIOLET[1] - PRIMARY[1]) * t);
      const b = Math.round(PRIMARY[2] + (DEEP_VIOLET[2] - PRIMARY[2]) * t);

      const a = bgAlpha;
      const fg = glyphAlpha * a;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r * (1 - fg) + 255 * fg);
      rgba[i + 1] = Math.round(g * (1 - fg) + 255 * fg);
      rgba[i + 2] = Math.round(b * (1 - fg) + 255 * fg);
      rgba[i + 3] = Math.round(a * 255);
    }
  }
  return rgba;
}

function writePng(name, size, options) {
  const rgba = renderIcon(size, options);
  writeFileSync(join(outDir, name), encodePng(size, size, rgba));
  return name;
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="EventHub">
  <defs>
    <linearGradient id="eh" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2B5FFF"/>
      <stop offset="100%" stop-color="#9F44C4"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#eh)"/>
  <g fill="#FFFFFF">
    <rect x="44" y="56" width="13" height="80" rx="6.5"/>
    <rect x="44" y="56" width="52" height="13" rx="6.5"/>
    <rect x="44" y="89.5" width="42" height="13" rx="6.5"/>
    <rect x="44" y="123" width="52" height="13" rx="6.5"/>
    <rect x="106" y="56" width="13" height="80" rx="6.5"/>
    <rect x="147" y="56" width="13" height="80" rx="6.5"/>
    <rect x="106" y="89.5" width="54" height="13" rx="6.5"/>
  </g>
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon.svg'), SVG, 'utf8');

const written = [
  'icon.svg',
  writePng('icon-192.png', 192, { fullBleed: false, glyphScale: 1 }),
  writePng('icon-512.png', 512, { fullBleed: false, glyphScale: 1 }),
  writePng('maskable-512.png', 512, { fullBleed: true, glyphScale: 0.68 }),
  writePng('apple-touch-icon.png', 180, { fullBleed: true, glyphScale: 0.82 }),
];

console.log(`PWA icons written to public/icons: ${written.join(', ')}`);
