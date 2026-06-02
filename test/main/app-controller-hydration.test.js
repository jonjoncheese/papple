import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";
import { generateDailyBatch } from "../../src/core/engine.js";
import { gradeMc } from "../../src/core/grader.js";
import { recordCompletion } from "../../src/core/streak.js";
import { recordAnswer } from "../../src/core/topics.js";
import { isHydrationDue, isQuietHours, nextUnanswered } from "../../src/core/scheduler.js";
import { createController } from "../../src/main/app-controller.js";

function ctlWith(statePath, nowDate) {
  return createController({
    loadState, saveState, statePath, now: () => nowDate,
    loadActiveDecks: async () => [{ deck: "d", mode: "bank", text: "" }],
    buildProvider: () => ({ async generateQuestions() { return "[]"; }, async gradeTyped() { return {correct:false,feedback:""}; }, async hint() { return ""; } }),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  });
}

async function stateFile(mut) {
  const dir = await mkdtemp(join(tmpdir(), "paphyd-"));
  const path = join(dir, "state.json");
  const s = defaultState(); mut?.(s);
  await saveState(path, s);
  return { dir, path };
}

test("hydrationDue true when enabled, daytime, never reminded", async () => {
  const { dir, path } = await stateFile();
  const ctl = ctlWith(path, new Date("2026-06-02T12:00:00"));
  assert.equal(await ctl.hydrationDue(), true);
  await rm(dir, { recursive: true, force: true });
});

test("hydrationDue false during quiet hours", async () => {
  const { dir, path } = await stateFile();
  const ctl = ctlWith(path, new Date("2026-06-02T23:30:00"));
  assert.equal(await ctl.hydrationDue(), false);
  await rm(dir, { recursive: true, force: true });
});

test("hydrationDue false when disabled", async () => {
  const { dir, path } = await stateFile(s => { s.settings.hydration.enabled = false; });
  const ctl = ctlWith(path, new Date("2026-06-02T12:00:00"));
  assert.equal(await ctl.hydrationDue(), false);
  await rm(dir, { recursive: true, force: true });
});

test("markHydrated then hydrationDue is false until interval passes", async () => {
  const { dir, path } = await stateFile();
  const ctl = ctlWith(path, new Date("2026-06-02T12:00:00"));
  await ctl.markHydrated();
  assert.equal(await ctl.hydrationDue(), false);
  await rm(dir, { recursive: true, force: true });
});
