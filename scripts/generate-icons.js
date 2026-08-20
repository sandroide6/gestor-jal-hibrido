/**
 * Genera los íconos PNG requeridos por el PWA manifest.
 * Uso: node scripts/generate-icons.js
 * Sin dependencias externas — usa solo zlib de Node.js.
 */
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// CRC32 para chunks PNG
const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return ((crc ^ 0xFFFFFFFF) >>> 0);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf    = Buffer.concat([typeBytes, data]);
  const out       = Buffer.alloc(4 + 4 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
  return out;
}

function createPNG(size) {
  const BG   = [30, 58, 95];   // #1e3a5f — JAL azul
  const GOLD = [212, 160, 23]; // #d4a017 — JAL dorado

  // Dibujar píxeles: fondo azul + rombos dorados simplificados
  const pixels = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 3;
      const cx  = x / size - 0.5;
      const cy  = y / size - 0.5;
      const r   = Math.sqrt(cx * cx + cy * cy);

      // Círculo dorado exterior
      const onRing = r > 0.34 && r < 0.44;
      // Cruz / símbolo central blanco
      const onCross =
        (Math.abs(cx) < 0.06 && Math.abs(cy) < 0.22) ||
        (Math.abs(cy) < 0.06 && Math.abs(cx) < 0.22);

      let color;
      if (onRing)  color = GOLD;
      else if (onCross) color = [255, 255, 255];
      else         color = BG;

      pixels[idx]     = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
    }
  }

  // Construir imagen PNG (RGB, 8-bit, sin alpha)
  const rowSize = 1 + size * 3;
  const raw     = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filtro: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3;
      const dst = y * rowSize + 1 + x * 3;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData[8]  = 8;  // bit depth
  ihdrData[9]  = 2;  // color type: RGB
  ihdrData[10] = 0;  // compression: deflate
  ihdrData[11] = 0;  // filter: adaptive
  ihdrData[12] = 0;  // interlace: none

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'frontend', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const file = path.join(outDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(file, createPNG(size));
  console.log(`✓ ${file}`);
}

console.log('Íconos generados correctamente.');
