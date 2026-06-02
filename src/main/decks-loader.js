import { join } from "node:path";
import { listDeckDirs, activeDeckDirs, resolveDeckText } from "../core/decks.js";
import { loadDeckFiles } from "../core/sources.js";

export async function loadActiveDecks(sourcesDir, activeDecks, { pdfParser, onSkip = () => {} } = {}) {
  const all = await listDeckDirs(sourcesDir);
  const active = activeDeckDirs(all, activeDecks);
  const out = [];
  for (const name of active) {
    const files = await loadDeckFiles(join(sourcesDir, name), { pdfParser, onSkip });
    out.push(resolveDeckText(name, files));
  }
  return out;
}
