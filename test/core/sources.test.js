import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripFrontmatter, chunkText, loadDeckFiles } from "../../src/core/sources.js";

test("stripFrontmatter removes leading YAML block", () => {
  const md = "---\ntags: [a]\n---\n# Title\nbody";
  assert.equal(stripFrontmatter(md), "# Title\nbody");
});

test("stripFrontmatter leaves plain text untouched", () => {
  assert.equal(stripFrontmatter("no frontmatter"), "no frontmatter");
});

test("chunkText splits on size and never exceeds max", () => {
  const text = "abcdefghij".repeat(50); // 500 chars
  const chunks = chunkText(text, 120);
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every(c => c.length <= 120));
});

test("loadDeckFiles reads md and parses pdf via injected parser", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-"));
  await writeFile(join(dir, "notes.md"), "---\nx: 1\n---\nMarkdown body");
  await writeFile(join(dir, "review.pdf"), "binary-ish");
  const fakeParser = async (buf) => ({ text: "PDF text from " + buf.length + " bytes" });
  const files = await loadDeckFiles(dir, { pdfParser: fakeParser });
  const names = files.map(f => f.source).sort();
  assert.deepEqual(names, ["notes.md", "review.pdf"]);
  assert.ok(files.find(f => f.source === "notes.md").text.includes("Markdown body"));
  assert.ok(files.find(f => f.source === "review.pdf").text.includes("PDF text"));
  await rm(dir, { recursive: true, force: true });
});

test("loadDeckFiles skips files that fail to parse", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-"));
  await writeFile(join(dir, "ok.md"), "fine");
  await writeFile(join(dir, "bad.pdf"), "x");
  const throwingParser = async () => { throw new Error("scanned image"); };
  const skipped = [];
  const files = await loadDeckFiles(dir, {
    pdfParser: throwingParser,
    onSkip: (name, err) => skipped.push([name, err.message])
  });
  assert.deepEqual(files.map(f => f.source), ["ok.md"]);
  assert.deepEqual(skipped, [["bad.pdf", "scanned image"]]);
  await rm(dir, { recursive: true, force: true });
});

test("stripFrontmatter handles CRLF line endings", () => {
  const md = "---\r\ntags: [a]\r\n---\r\n# Title\r\nbody";
  assert.equal(stripFrontmatter(md), "# Title\r\nbody");
});
