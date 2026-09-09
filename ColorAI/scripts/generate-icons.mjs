// 生成 PWA 图标（纯 Node，无原生依赖）
// 用法：node scripts/generate-icons.mjs
// 产物：public/icons/icon-192.png、icon-512.png、maskable-icon-512.png、public/apple-touch-icon.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 品牌 CMYK 四色标：左上/右上/左下/右下（与 favicon.svg 一致）
const COLORS = ['#0E6F9C', '#E4007E', '#FFD200', '#26323B'];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ---------- PNG 编码 ----------
let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[o++] = rgba[i];
      raw[o++] = rgba[i + 1];
      raw[o++] = rgba[i + 2];
      raw[o++] = rgba[i + 3];
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function insideRoundedRect(px, py, x0, y0, w, h, r) {
  if (px < x0 || py < y0 || px >= x0 + w || py >= y0 + h) return false;
  const cx = Math.min(Math.max(px, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(py, y0 + r), y0 + h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// 渲染品牌标。opts.bg: [r,g,b,a] 或 null（透明）；opts.scale: 内容占满比例（maskable 用 0.78）
function renderMark(size, opts = {}) {
  const bg = opts.bg ?? [0, 0, 0, 0];
  const scale = opts.scale ?? 1;
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = bg[3];
  }

  const k = (size * scale) / 32; // favicon 以 32×32 为基准等比放大
  const margin = 2 * k;
  const block = 13 * k;
  const off = 17 * k;
  const r = 3.5 * k;
  const offset = (size * (1 - scale)) / 2;

  const positions = [
    [margin, margin],
    [off, margin],
    [margin, off],
    [off, off],
  ];

  for (let p = 0; p < 4; p++) {
    const [c1, c2, c3] = hexToRgb(COLORS[p]);
    const x0 = offset + positions[p][0];
    const y0 = offset + positions[p][1];
    for (let y = Math.floor(y0); y < Math.ceil(y0 + block); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x0 + block); x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (insideRoundedRect(x + 0.5, y + 0.5, x0, y0, block, block, r)) {
          const i = (y * size + x) * 4;
          rgba[i] = c1;
          rgba[i + 1] = c2;
          rgba[i + 2] = c3;
          rgba[i + 3] = 255;
        }
      }
    }
  }
  return rgba;
}

const PAPER = [0xf4, 0xf5, 0xf3, 0xff]; // #F4F5F3

mkdirSync(join(ROOT, 'public', 'icons'), { recursive: true });

const outputs = [
  ['public/icons/icon-192.png', 192, renderMark(192)],
  ['public/icons/icon-512.png', 512, renderMark(512)],
  ['public/icons/maskable-icon-512.png', 512, renderMark(512, { bg: PAPER, scale: 0.78 })],
  ['public/apple-touch-icon.png', 180, renderMark(180, { bg: PAPER })],
];

for (const [rel, size, rgba] of outputs) {
  const file = join(ROOT, rel);
  writeFileSync(file, encodePNG(size, size, rgba));
  console.log(`✓ ${rel} (${size}×${size})`);
}
