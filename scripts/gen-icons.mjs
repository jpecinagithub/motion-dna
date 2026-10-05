/**
 * Generates PWA icons (192 / 512 / 512-maskable PNG) with a hand-rolled
 * PNG encoder — no native dependencies required.
 * Run: node scripts/gen-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

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
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function paint(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = hex('#05070d');
  const margin = maskable ? size * 0.14 : 0; // safe zone for maskable
  const S = (v) => Math.round((margin + v * (size - 2 * margin)) / 1);

  const dot = (cx, cy, r, [rr, gg, bb], alpha = 1) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(size - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const i = (y * size + x) * 4;
        const a = alpha * Math.max(0, 1 - d / r);
        rgba[i] = Math.round(rr * a + rgba[i] * (1 - a));
        rgba[i + 1] = Math.round(gg * a + rgba[i + 1] * (1 - a));
        rgba[i + 2] = Math.round(bb * a + rgba[i + 2] * (1 - a));
        rgba[i + 3] = 255;
      }
    }
  };

  // background
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0]; rgba[i * 4 + 1] = bg[1]; rgba[i * 4 + 2] = bg[2]; rgba[i * 4 + 3] = 255;
  }

  // DNA double helix: two sine strands + rungs
  const electric = hex('#3b82f6');
  const violet = hex('#8b5cf6');
  const coral = hex('#fb7185');
  const N = 64;
  for (let k = 0; k <= N; k++) {
    const v = k / N; // 0..1 vertical
    const ph = v * Math.PI * 2.2;
    const x1 = 0.5 + 0.22 * Math.sin(ph);
    const x2 = 0.5 + 0.22 * Math.sin(ph + Math.PI);
    dot(S(x1), S(v), size * 0.022, electric);
    dot(S(x2), S(v), size * 0.022, violet);
    if (k % 8 === 0) dot(S(0.5), S(v), size * 0.014, coral, 0.9);
  }
  return rgba;
}

mkdirSync(root, { recursive: true });
for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-512-maskable.png', 512, true]]) {
  writeFileSync(join(root, name), encodePNG(size, size, paint(size, maskable)));
  console.log('wrote', name);
}
