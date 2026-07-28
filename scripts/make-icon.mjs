// Build Windows .ico from the pixel papple sprite (src/renderer/papple.png).
// Usage: node scripts/make-icon.mjs
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pngPath = join(root, "src", "renderer", "papple.png");
const outDir = join(root, "build");
mkdirSync(outDir, { recursive: true });
const ico = await pngToIco(readFileSync(pngPath));
const out = join(outDir, "icon.ico");
writeFileSync(out, ico);
console.log("wrote", out, ico.length, "bytes");
