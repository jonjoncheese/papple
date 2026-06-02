import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";

test("defaultState has expected keys", () => {
  const s = defaultState();
  assert.equal(s.streak.count, 0);
  assert.equal(s.streak.lastCompletedDate, null);
  assert.deepEqual(s.topicStats, {});
  assert.equal(s.settings.questionsPerDay, 10);
  assert.equal(s.settings.hydration.enabled, true);
});

test("loadState returns defaults when file missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papple-"));
  const s = await loadState(join(dir, "nope.json"));
  assert.equal(s.streak.count, 0);
  await rm(dir, { recursive: true, force: true });
});

test("saveState then loadState round-trips", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papple-"));
  const file = join(dir, "state.json");
  const s = defaultState();
  s.streak.count = 5;
  await saveState(file, s);
  const loaded = await loadState(file);
  assert.equal(loaded.streak.count, 5);
  await rm(dir, { recursive: true, force: true });
});

test("loadState merges missing keys onto defaults", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papple-"));
  const file = join(dir, "state.json");
  await saveState(file, { streak: { count: 3, lastCompletedDate: "2026-06-01" } });
  const loaded = await loadState(file);
  assert.equal(loaded.streak.count, 3);
  assert.equal(loaded.settings.questionsPerDay, 10); // default filled in
  await rm(dir, { recursive: true, force: true });
});
