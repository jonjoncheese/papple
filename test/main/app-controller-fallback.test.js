import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";
import { generateCombinedBatch } from "../../src/core/engine.js";
import { gradeMc } from "../../src/core/grader.js";
import { recordCompletion } from "../../src/core/streak.js";
import { recordAnswer } from "../../src/core/topics.js";
import { isHydrationDue, isQuietHours, nextUnanswered } from "../../src/core/scheduler.js";
import { createController } from "../../src/main/app-controller.js";

const fixedNow = () => new Date("2026-06-02T12:00:00");

function makeQuestions(count, deck = "d") {
  return Array.from({ length: count }, (_, i) => ({
    id: `${deck}-${i}`, deck, topic: "T", source: "ai",
    type: "mc", question: "q", options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "e"
  }));
}

function workingDeps(statePath) {
  return {
    loadState, saveState, statePath, now: fixedNow,
    loadActiveDecks: async () => [{ deck: "d", mode: "bank", text: "" }],
    buildProvider: () => ({
      async complete() { return JSON.stringify(makeQuestions(10)); },
      async gradeTyped() { return { correct: true, feedback: "" }; },
      async hint() { return "h"; }
    }),
    generateCombinedBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  };
}

function failingDeps(statePath) {
  return {
    ...workingDeps(statePath),
    buildProvider: () => ({
      async complete() { throw new Error("no backend"); },
      async gradeTyped() { throw new Error("no backend"); },
      async hint() { throw new Error("no backend"); }
    })
  };
}

async function setup(mut) {
  const dir = await mkdtemp(join(tmpdir(), "papgen-"));
  const path = join(dir, "state.json");
  const s = defaultState(); mut?.(s);
  await saveState(path, s);
  return { dir, path };
}

test("getNext rejects when no AI backend is available (no bank fallback)", async () => {
  const { dir, path } = await setup();
  const ctl = createController(failingDeps(path));
  await assert.rejects(() => ctl.getNext());
  const state = await loadState(path);
  assert.equal(state.today.batch.length, 0); // nothing cached as an empty batch
  await rm(dir, { recursive: true, force: true });
});

test("endless mode tops up the batch when it's exhausted", async () => {
  const { dir, path } = await setup(s => { s.settings.questionsPerDay = 2; s.settings.endlessMode = true; });
  const ctl = createController(workingDeps(path));
  const today = await ctl.ensureTodayBatch();
  assert.equal(today.batch.length, 2);
  await ctl.submitAnswer(today.batch[0].id, { selectedIndex: 0 });
  await ctl.submitAnswer(today.batch[1].id, { selectedIndex: 0 });
  const q = await ctl.getNext();
  assert.ok(q && q.id, "expected a topped-up question");
  const state = await loadState(path);
  assert.ok(state.today.batch.length > 2, "batch should have grown");
  await rm(dir, { recursive: true, force: true });
});

test("endless mode OFF returns null when exhausted (done for today)", async () => {
  const { dir, path } = await setup(s => { s.settings.questionsPerDay = 1; s.settings.endlessMode = false; });
  const ctl = createController(workingDeps(path));
  const today = await ctl.ensureTodayBatch();
  await ctl.submitAnswer(today.batch[0].id, { selectedIndex: 0 });
  const q = await ctl.getNext();
  assert.equal(q, null);
  await rm(dir, { recursive: true, force: true });
});
