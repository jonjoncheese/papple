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
import { validateQuestion } from "../../src/core/schema.js";
import { createController } from "../../src/main/app-controller.js";

// Deps whose AI backend ALWAYS fails (simulates no key + no Ollama).
function failingDeps(statePath) {
  return {
    loadState, saveState, statePath, now: () => new Date("2026-06-02T12:00:00"),
    loadActiveDecks: async () => [{ deck: "d", mode: "bank", text: "" }],
    buildProvider: () => ({
      async generateQuestions() { throw new Error("no backend"); },
      async gradeTyped() { throw new Error("no backend"); },
      async hint() { throw new Error("no backend"); }
    }),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  };
}

async function setup(mut) {
  const dir = await mkdtemp(join(tmpdir(), "papfb-"));
  const path = join(dir, "state.json");
  const s = defaultState(); mut?.(s);
  await saveState(path, s);
  return { dir, path };
}

test("ensureTodayBatch falls back to the starter bank when generation fails", async () => {
  const { dir, path } = await setup();
  const ctl = createController(failingDeps(path));
  const today = await ctl.ensureTodayBatch();
  assert.ok(today.batch.length > 0);
  assert.ok(today.batch.every(q => validateQuestion(q).valid));
  await rm(dir, { recursive: true, force: true });
});

test("getNext returns a question in offline fallback mode (never hangs)", async () => {
  const { dir, path } = await setup();
  const ctl = createController(failingDeps(path));
  const q = await ctl.getNext();
  assert.ok(q && q.id);
  await rm(dir, { recursive: true, force: true });
});

test("typed answer grades locally when AI grading throws", async () => {
  const { dir, path } = await setup(s => { s.settings.answerMode = "typed"; });
  const ctl = createController(failingDeps(path));
  const today = await ctl.ensureTodayBatch();
  const typed = today.batch.find(q => q.type === "typed");
  assert.ok(typed, "expected a typed question in typed-only fallback batch");
  const r = await ctl.submitAnswer(typed.id, { typedAnswer: typed.answer });
  assert.equal(r.correct, true);
  await rm(dir, { recursive: true, force: true });
});

test("getHint returns a friendly fallback when AI hint throws", async () => {
  const { dir, path } = await setup();
  const ctl = createController(failingDeps(path));
  const today = await ctl.ensureTodayBatch();
  const hint = await ctl.getHint(today.batch[0].id);
  assert.ok(typeof hint === "string" && hint.length > 0);
  await rm(dir, { recursive: true, force: true });
});
