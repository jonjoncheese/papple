import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export async function parsePdf(buffer) {
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return { text: data.text ?? "" };
}
