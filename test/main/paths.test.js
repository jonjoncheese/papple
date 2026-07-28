import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { defaultSourcesDir, statePath, rendererDir } from "../../src/main/paths.js";

test("statePath lands under app userData as papple-state.json", () => {
  const app = { getPath: (k) => (k === "userData" ? "C:\\Users\\x\\AppData\\Roaming\\papple" : "") };
  assert.equal(statePath(app), join("C:\\Users\\x\\AppData\\Roaming\\papple", "papple-state.json"));
});

test("defaultSourcesDir uses Documents/PappleSources when packaged", () => {
  const app = {
    isPackaged: true,
    getPath: (k) => (k === "documents" ? "C:\\Users\\x\\Documents" : "")
  };
  assert.equal(defaultSourcesDir(app), join("C:\\Users\\x\\Documents", "PappleSources"));
});

test("defaultSourcesDir uses repo papple-sources when not packaged", () => {
  const app = { isPackaged: false };
  assert.match(defaultSourcesDir(app), /papple-sources$/);
});

test("rendererDir points at src/renderer", () => {
  assert.match(rendererDir.replace(/\\/g, "/"), /src\/renderer$/);
});
