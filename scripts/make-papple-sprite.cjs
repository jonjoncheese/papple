// Papple sprite frames: papple.png (idle), -wave, -blink (quick blink),
// -drink (sips water), -sleep (lying down comfy). Pure Node (zlib).
// Run: node scripts/make-papple-sprite.cjs
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 40, H = 40;
const C = {
  body: [246, 200, 60], bodyShade: [225, 175, 45], arm: [250, 216, 104],
  green: [70, 165, 95], greenDark: [48, 130, 72], feet: [236, 150, 52],
  cheek: [246, 168, 172], black: [45, 35, 35], white: [255, 252, 240],
  cup: [222, 234, 244], water: [118, 196, 226], cupEdge: [150, 180, 200],
};

function buildSprite({ wave = false, eyesClosed = false, drink = false, lying = false } = {}) {
  const px = Buffer.alloc(W * H * 4);
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3] ?? 255;
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, c);
      }
  };
  const spike = (cx, tipY, baseY, halfW, c, cEdge) => {
    for (let y = tipY; y <= baseY; y++) {
      const t = (y - tipY) / (baseY - tipY), half = t * halfW;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) set(x, y, c);
      if (cEdge) set(cx - half, y, cEdge);
    }
  };
  const arc = (cx, cy) => { set(cx - 2, cy - 1, C.black); set(cx - 1, cy, C.black); set(cx, cy, C.black); set(cx + 1, cy, C.black); set(cx + 2, cy - 1, C.black); };

  // ---------- SLEEPING: curled-up cozy ball, facing the viewer ----------
  if (lying) {
    // low wide squished body (slumped/curled)
    ellipse(20, 31, 12.5, 7.5, C.body);
    for (let y = 31; y <= 39; y++) for (let x = 22; x <= 32; x++) { const dx = (x - 20) / 12.5, dy = (y - 31) / 7.5; if (dx * dx + dy * dy <= 1 && (x - 20) + (y - 31) > 8) set(x, y, C.bodyShade); }
    // short droopy crown on top
    spike(19, 17, 25, 2.4, C.green, C.greenDark);
    spike(15, 19, 25, 2.0, C.green, C.greenDark);
    spike(23, 19, 25, 2.0, C.green, C.greenDark);
    spike(12, 21, 25, 1.7, C.greenDark);
    spike(26, 21, 25, 1.7, C.greenDark);
    ellipse(12, 30, 1.6, 1.9, C.white);
    // arms curled up tucked at the front (the cute part)
    ellipse(15, 34, 2.9, 2.5, C.arm);
    ellipse(25, 34, 2.9, 2.5, C.arm);
    // tucked little feet
    ellipse(18, 38, 2.1, 1.5, C.feet); ellipse(22, 38, 2.1, 1.5, C.feet);
    // sleepy face — closed ∪ eyes, rosy cheeks, tiny content smile
    ellipse(13.5, 31, 2, 1.6, C.cheek); ellipse(26.5, 31, 2, 1.6, C.cheek);
    arc(16, 30); arc(24, 30);
    [[18, 31], [19, 31.5], [20, 31.7], [21, 31.5], [22, 31]].forEach(([x, y]) => set(x, y, C.black));
    return px;
  }

  // ---------- STANDING (idle / wave / blink / drink) ----------
  ellipse(20, 24.5, 11.5, 11, C.body);
  for (let y = 25; y <= 37; y++) for (let x = 22; x <= 31; x++) { const dx = (x - 20) / 11.5, dy = (y - 25) / 11.5; if (dx * dx + dy * dy <= 1 && (x - 20) + (y - 25) > 9) set(x, y, C.bodyShade); }
  for (let y = 16; y <= 36; y++) for (let x = 11; x <= 29; x++) { const dx = (x - 20) / 11.5, dy = (y - 25) / 11.5; if (dx * dx + dy * dy <= 0.9 && ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0)) set(x, y, C.bodyShade); }
  ellipse(14.5, 35, 3.4, 2.6, C.feet);
  ellipse(25.5, 35, 3.4, 2.6, C.feet);
  spike(20, 5, 18, 2.4, C.green, C.greenDark);
  spike(16, 7, 18, 2.2, C.green, C.greenDark);
  spike(24, 7, 18, 2.2, C.green, C.greenDark);
  spike(13, 10, 18, 1.8, C.greenDark);
  spike(27, 10, 18, 1.8, C.greenDark);
  ellipse(13, 23, 1.7, 2.1, C.white);

  // arms
  if (drink) ellipse(12, 23, 3, 3, C.arm);      // arm raised holding the cup
  else if (wave) ellipse(7, 20, 3, 3.4, C.arm); // wave hand up
  else ellipse(9, 28, 3, 3, C.arm);
  ellipse(31, 28, 3, 3, C.arm);

  // cheeks
  ellipse(15, 27, 2.2, 1.8, C.cheek);
  ellipse(25, 27, 2.2, 1.8, C.cheek);

  // eyes
  if (eyesClosed) { arc(17, 25); arc(23, 25); }
  else { ellipse(17, 24, 1.5, 1.8, C.black); ellipse(23, 24, 1.5, 1.8, C.black); }

  if (drink) {
    // a cup tilted to the mouth + open "gulp" mouth
    for (let y = 22; y <= 27; y++) for (let x = 16; x <= 22; x++) set(x, y, C.cup);
    for (let y = 22; y <= 23; y++) for (let x = 16; x <= 22; x++) set(x, y, C.water);
    for (let x = 16; x <= 22; x++) { set(x, 22, C.cupEdge); set(x, 27, C.cupEdge); }
    ellipse(20, 28.5, 1.6, 1.8, C.black); // open mouth
  } else {
    // smile
    [[18, 27], [19, 28], [20, 28.4], [21, 28.4], [22, 28], [23, 27]].forEach(([x, y]) => { set(x, y, C.black); set(x, y + 1, C.black); });
  }
  return px;
}

function encode(buf, w, h) {
  const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const t = Buffer.from(type); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([len, t, data, crc]); };
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const out = name => path.join(__dirname, "..", "src", "renderer", name);
fs.writeFileSync(out("papple.png"), encode(buildSprite(), W, H));
fs.writeFileSync(out("papple-wave.png"), encode(buildSprite({ wave: true }), W, H));
fs.writeFileSync(out("papple-blink.png"), encode(buildSprite({ eyesClosed: true }), W, H));
fs.writeFileSync(out("papple-drink.png"), encode(buildSprite({ drink: true }), W, H));
fs.writeFileSync(out("papple-sleep.png"), encode(buildSprite({ lying: true }), W, H));

// 8x review (change the arg to inspect a frame)
const review = buildSprite(), S = 8, bw = W * S, bh = H * S, big = Buffer.alloc(bw * bh * 4);
for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
  const si = (Math.floor(y / S) * W + Math.floor(x / S)) * 4, di = (y * bw + x) * 4;
  big[di] = review[si]; big[di + 1] = review[si + 1]; big[di + 2] = review[si + 2]; big[di + 3] = review[si + 3];
}
fs.writeFileSync(path.join(__dirname, "papple_review.png"), encode(big, bw, bh));
console.log("wrote idle/wave/blink/drink/sleep frames + review");
