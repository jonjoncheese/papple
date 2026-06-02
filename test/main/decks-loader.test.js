import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadActiveDecks } from "../../src/main/decks-loader.js";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "papsrc-"));
  await mkdir(join(dir, "withfiles"));
  await writeFile(join(dir, "withfiles", "n.md"), "real notes here");
  await mkdir(join(dir, "empty"));
  return dir;
}

test("returns one resolved deck per directory, files vs bank", async () => {
  const dir = await fixture();
  const decks = await loadActiveDecks(dir, [], { pdfParser: async () => ({ text: "" }) });
  const byName = Object.fromEntries(decks.map(d => [d.deck, d]));
  assert.equal(byName.withfiles.mode, "files");
  assert.ok(byName.withfiles.text.includes("real notes"));
  assert.equal(byName.empty.mode, "bank");
  await rm(dir, { recursive: true, force: true });
});

test("active filter limits which decks load", async () => {
  const dir = await fixture();
  const decks = await loadActiveDecks(dir, ["empty"], { pdfParser: async () => ({ text: "" }) });
  assert.deepEqual(decks.map(d => d.deck), ["empty"]);
  await rm(dir, { recursive: true, force: true });
});
