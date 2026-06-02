import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

export function stripFrontmatter(text) {
  if (text.startsWith("---")) {
    const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (m) return text.slice(m[0].length);
  }
  return text;
}

// split into <=maxChars chunks, preferring paragraph boundaries
export function chunkText(text, maxChars = 2000) {
  const chunks = [];
  let buf = "";
  for (const para of text.split(/\n\s*\n/)) {
    if ((buf + "\n\n" + para).length > maxChars && buf) {
      chunks.push(buf);
      buf = "";
    }
    if (para.length > maxChars) {
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
    } else {
      buf = buf ? buf + "\n\n" + para : para;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export async function loadDeckFiles(deckDir, { pdfParser, onSkip = () => {} } = {}) {
  let entries;
  try {
    entries = await readdir(deckDir);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const out = [];
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    if (ext !== ".md" && ext !== ".pdf") continue;
    const full = join(deckDir, name);
    try {
      if (ext === ".md") {
        const raw = await readFile(full, "utf8");
        out.push({ source: name, text: stripFrontmatter(raw) });
      } else {
        if (!pdfParser) throw new Error("no pdf parser provided");
        const buf = await readFile(full);
        const { text } = await pdfParser(buf);
        out.push({ source: name, text });
      }
    } catch (err) {
      onSkip(name, err);
    }
  }
  return out;
}
