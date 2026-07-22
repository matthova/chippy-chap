// Generates the Peck Party app icons as PNGs with zero dependencies —
// pixels are drawn in a buffer and encoded with Node's built-in zlib.
// Run: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size * 0.5;
  const cy = size * 0.52;
  const R = size * 0.34;          // main bubble
  const hx = cx - R * 0.35;       // highlight center
  const hy = cy - R * 0.38;
  const sparkles = [
    [0.2, 0.22, 0.035], [0.82, 0.3, 0.028], [0.75, 0.78, 0.032], [0.18, 0.72, 0.024],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;
      // Sky gradient background.
      let r = lerp(0x87, 0xc9, t);
      let g = lerp(0xce, 0xec, t);
      let b = lerp(0xeb, 0xff, t);

      // Sparkle dots.
      for (const [sx, sy, sr] of sparkles) {
        const d = Math.hypot(x - sx * size, y - sy * size);
        if (d < sr * size) { r = g = 255; b = 240; }
      }

      // Glossy red bubble with radial shading.
      const d = Math.hypot(x - cx, y - cy);
      if (d < R) {
        const hd = Math.hypot(x - hx, y - hy) / R;   // distance from light
        const shade = Math.max(0, 1 - hd * 0.85);
        r = lerp(0xc4, 0xff, shade + 0.15);
        g = lerp(0x2e, 0x8a, shade);
        b = lerp(0x3d, 0x93, shade);
        // Hot specular highlight.
        if (hd < 0.28) {
          const s = 1 - hd / 0.28;
          r = lerp(r, 255, s);
          g = lerp(g, 255, s);
          b = lerp(b, 255, s);
        }
        // Soft rim darkening.
        if (d > R * 0.92) {
          const e = (d - R * 0.92) / (R * 0.08);
          r *= 1 - e * 0.25; g *= 1 - e * 0.25; b *= 1 - e * 0.25;
        }
      }

      px[i] = Math.round(Math.min(255, r));
      px[i + 1] = Math.round(Math.min(255, g));
      px[i + 2] = Math.round(Math.min(255, b));
      px[i + 3] = 255;
    }
  }
  return encodePNG(size, px);
}

mkdirSync('icons', { recursive: true });
for (const size of [512, 192, 180]) {
  const name = size === 180 ? 'icons/apple-touch-icon.png' : `icons/icon-${size}.png`;
  writeFileSync(name, drawIcon(size));
  console.log(`wrote ${name}`);
}
