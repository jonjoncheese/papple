// Generates a small visible pineapple tray icon at src/renderer/tray.png (32x32 RGBA PNG).
// Pure Node (zlib) — no image libraries. Re-run with: node scripts/make-tray-icon.cjs
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 32, H = 32;
const px = Buffer.alloc(W * H * 4); // RGBA, transparent by default

function set(x, y, r, g, b, a) {
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - 16, dyBody = y - 20;
    // yellow pineapple body (ellipse)
    if ((dx * dx) / (9 * 9) + (dyBody * dyBody) / (11 * 11) <= 1) set(x, y, 0xF1, 0xC4, 0x0F, 255);
    // green leaf crown (triangle widening downward)
    if (y >= 2 && y <= 13) {
      const halfW = ((y - 2) / 11) * 8;
      if (Math.abs(dx) <= halfW) set(x, y, 0x2E, 0x8B, 0x57, 255);
    }
  }
}

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter byte
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const idat = zlib.deflateSync(raw);
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);

const out = path.join(__dirname, "..", "src", "renderer", "tray.png");
fs.writeFileSync(out, png);
console.log("wrote", out, png.length, "bytes");
