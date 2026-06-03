import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export async function parsePdf(buffer) {
  // Require the inner module directly — the package's index.js has a debug block
  // that crashes (tries to read a bundled test PDF) when there's no module.parent.
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(buffer);
  return { text: data.text ?? "" };
}
