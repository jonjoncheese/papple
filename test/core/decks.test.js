import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDeckDirs, activeDeckDirs, resolveDeckText } from "../../src/core/decks.js";

test("listDeckDirs returns only subdirectories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "src-"));
  await mkdir(join(dir, "ap-chem"));
  await mkdir(join(dir, "apush"));
  await writeFile(join(dir, "README.md"), "x");
  const decks = await listDeckDirs(dir);
  assert.deepEqual(decks.sort(), ["ap-chem", "apush"]);
  await rm(dir, { recursive: true, force: true });
});

test("activeDeckDirs filters by settings, empty = all", () => {
  const all = ["ap-chem", "apush", "hc-chem-sem1"];
  assert.deepEqual(activeDeckDirs(all, ["apush"]), ["apush"]);
  assert.deepEqual(activeDeckDirs(all, []), all);
});

test("resolveDeckText: files present -> mode files with joined text", () => {
  const files = [{ source: "a.md", text: "alpha" }, { source: "b.md", text: "beta" }];
  const r = resolveDeckText("ap-chem", files);
  assert.equal(r.mode, "files");
  assert.ok(r.text.includes("alpha") && r.text.includes("beta"));
});

test("resolveDeckText: no usable files -> mode bank", () => {
  const r = resolveDeckText("ap-chem", []);
  assert.equal(r.mode, "bank");
  assert.equal(r.text, "");
});

test("resolveDeckText: whitespace-only files -> mode bank", () => {
  const r = resolveDeckText("ap-chem", [{ source: "a.md", text: "   \n  " }]);
  assert.equal(r.mode, "bank");
});
