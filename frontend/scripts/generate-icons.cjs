'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// 5x7 pixel bitmaps para J, A, L
const FONT = {
  J: [[0,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  A: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  L: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
};

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const cr = Buffer.allocUnsafe(4); cr.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, cr]);
}

function generateIcon(size) {
  const w = size, h = size;
  const BG = [0x1e, 0x3a, 0x5f]; // JAL blue
  const FG = [0xff, 0xff, 0xff]; // white

  // Escalar texto "JAL": 5 cols por letra + 1 espacio, 7 filas
  const scale = Math.max(1, Math.floor(size / 24));
  const textW = (5 + 1 + 5 + 1 + 5) * scale; // 17 * scale
  const textH = 7 * scale;
  const startX = Math.floor((w - textW) / 2);
  const startY = Math.floor((h - textH) / 2);

  // Construir bitmap de "JAL"
  const bitmap = new Uint8Array(textH * textW);
  ['J', 'A', 'L'].forEach((ch, ci) => {
    const charX = ci * 6 * scale;
    FONT[ch].forEach((row, fy) => {
      row.forEach((px, fx) => {
        if (!px) return;
        for (let py = 0; py < scale; py++)
          for (let pxs = 0; pxs < scale; pxs++) {
            const bx = charX + fx * scale + pxs;
            const by = fy * scale + py;
            if (by < textH && bx < textW) bitmap[by * textW + bx] = 1;
          }
      });
    });
  });

  const scanlines = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      const bx = x - startX, by = y - startY;
      const isText = bx >= 0 && bx < textW && by >= 0 && by < textH && bitmap[by * textW + bx];
      const c = isText ? FG : BG;
      row[1 + x * 3] = c[0]; row[2 + x * 3] = c[1]; row[3 + x * 3] = c[2];
    }
    scanlines.push(row);
  }

  const raw = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

[
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
].forEach(({ size, name }) => {
  const buf = generateIcon(size);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`✓ ${name} (${buf.length} bytes)`);
});

console.log('Íconos generados en public/icons/');
