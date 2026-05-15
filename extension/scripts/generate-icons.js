/**
 * Generate simple PNG icons for the extension.
 * Run: node scripts/generate-icons.js
 */
const { writeFileSync, mkdirSync, existsSync } = require("fs");
const { join } = require("path");

const iconsDir = join(__dirname, "..", "public", "icons");
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Generate a simple 1x1 purple PNG and scale it via the canvas-less approach
// For a real project you'd use sharp or canvas, but this creates valid PNGs

function createMinimalPng(size) {
  // Create an SVG and convert to a data URI that can be used as an icon
  // For Chrome extension loading, we'll create actual PNG files
  // Using a minimal valid PNG approach

  // Actually, let's create SVG files and note that Chrome MV3 supports SVG icons
  // But to be safe, let's create a simple colored PNG using raw bytes

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createIHDR(size, size);

  // IDAT chunk (image data)
  const idat = createIDAT(size, size);

  // IEND chunk
  const iend = createIEND();

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8; // bit depth
  data[9] = 2; // color type (RGB)
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace

  return createChunk("IHDR", data);
}

function createIDAT(width, height) {
  // Create raw image data (filter byte + RGB pixels per row)
  const rawRows = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.4;

  for (let y = 0; y < height; y++) {
    const row = [0]; // filter byte (none)
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        // Purple gradient: #6366f1 to #8b5cf6
        const t = dist / radius;
        const r = Math.round(99 + (139 - 99) * t);
        const g = Math.round(102 + (92 - 102) * t);
        const b = Math.round(241 + (246 - 241) * t);
        row.push(r, g, b);
      } else {
        // Transparent (but we're RGB, so use white/background)
        row.push(0, 0, 0); // Black background for simplicity
      }
    }
    rawRows.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(rawRows);

  // Compress with zlib
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawData);

  return createChunk("IDAT", compressed);
}

function createIEND() {
  return createChunk("IEND", Buffer.alloc(0));
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

// CRC32 implementation
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

// Generate icons
[16, 48, 128].forEach((size) => {
  const png = createMinimalPng(size);
  const path = join(iconsDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`Generated ${path} (${png.length} bytes)`);
});

console.log("Icons generated successfully!");
