/**
 * Generate simple PNG icons for the extension.
 * Run: node scripts/generate-icons.cjs
 */
const { writeFileSync, mkdirSync, existsSync } = require("fs");
const { join } = require("path");
const zlib = require("zlib");

const iconsDir = join(__dirname, "..", "public", "icons");
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Image data
  const rawRows = [];
  const cx = size / 2, cy = size / 2, r = size * 0.42;

  for (let y = 0; y < size; y++) {
    const row = [0]; // filter none
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r) {
        const t = dist / r;
        // Purple gradient: #6366f1 → #8b5cf6
        row.push(
          Math.round(99 + (139 - 99) * t),
          Math.round(102 + (92 - 102) * t),
          Math.round(241 + (246 - 241) * t),
          255
        );
      } else if (dist < r + 1.5) {
        // Anti-aliased edge
        const alpha = Math.round(255 * Math.max(0, 1 - (dist - r) / 1.5));
        row.push(120, 97, 243, alpha);
      } else {
        row.push(0, 0, 0, 0); // transparent
      }
    }
    rawRows.push(Buffer.from(row));
  }

  const compressed = zlib.deflateSync(Buffer.concat(rawRows));

  return Buffer.concat([
    signature,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

[16, 48, 128].forEach((size) => {
  const png = createPng(size);
  const path = join(iconsDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
});

console.log("Done!");
