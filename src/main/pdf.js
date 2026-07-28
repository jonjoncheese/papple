import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);

function loadPdfParse() {
  // Prefer the inner module — package index.js crashes when there's no module.parent
  // (debug block tries to read a bundled test PDF).
  try {
    return require("pdf-parse/lib/pdf-parse.js");
  } catch (first) {
    // Packaged Electron: pdf-parse is asarUnpack'd to app.asar.unpacked. Some
    // resolve paths still point inside the asar; fall back to the unpacked copy.
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, "..", "..", "node_modules", "pdf-parse", "lib", "pdf-parse.js"),
      // from app.asar/src/main → ../../../../app.asar.unpacked/node_modules/...
      join(here, "..", "..", "..", "app.asar.unpacked", "node_modules", "pdf-parse", "lib", "pdf-parse.js"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return require(p);
    }
    throw first;
  }
}

export async function parsePdf(buffer) {
  const pdfParse = loadPdfParse();
  const data = await pdfParse(buffer);
  return { text: data.text ?? "" };
}
