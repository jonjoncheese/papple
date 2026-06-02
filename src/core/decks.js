import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function listDeckDirs(sourcesDir) {
  let entries;
  try {
    entries = await readdir(sourcesDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

export function activeDeckDirs(allDecks, activeSetting) {
  if (!activeSetting || activeSetting.length === 0) return allDecks;
  return allDecks.filter(d => activeSetting.includes(d));
}

export function resolveDeckText(deckName, files) {
  const text = files.map(f => f.text).join("\n\n").trim();
  if (text.length === 0) return { deck: deckName, mode: "bank", text: "" };
  return { deck: deckName, mode: "files", text };
}
