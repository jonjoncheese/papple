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

function makeDeps(overrides = {}) {
  return {
    loadState, saveState, statePath: overrides.statePath,
    now: overrides.now ?? (() => new Date("2026-06-02T12:00:00")),
    loadActiveDecks: overrides.loadActiveDecks ?? (async () => [{ deck: "d", mode: "bank", text: "" }]),
    buildProvider: overrides.buildProvider ?? (() => ({
      async generateQuestions({ deckName, count }) {
        return JSON.stringify(Array.from({ length: count }, (_, i) => ({
          id: `${deckName}-${i}`, deck: deckName, topic: "T", source: "bank",
          type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 0, explanation: "e"
        })));
      },
      async gradeTyped() { return { correct: true, feedback: "ok" }; },
      async hint() { return "hint"; }
    })),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  };
}

async function tmpStatePath() {
  const dir = await mkdtemp(join(tmpdir(), "papctl-"));
  return { path: join(dir, "state.json"), dir };
}

test("ensureTodayBatch generates and caches a batch for today", async () => {
  const { path, dir } = await tmpStatePath();
  const s = defaultState(); s.settings.questionsPerDay = 5;
  await saveState(path, s);
  const ctl = createController(makeDeps({ statePath: path }));
  const today = await ctl.ensureTodayBatch();
  assert.equal(today.batch.length, 5);
  assert.equal(today.date, "2026-06-02");
  let calls = 0;
  const ctl2 = createController(makeDeps({
    statePath: path,
    buildProvider: () => ({ async generateQuestions() { calls++; return "[]"; } })
  }));
  await ctl2.ensureTodayBatch();
  assert.equal(calls, 0);
  await rm(dir, { recursive: true, force: true });
});

test("getNext returns the first unanswered question", async () => {
  const { path, dir } = await tmpStatePath();
  await saveState(path, defaultState());
  const ctl = createController(makeDeps({ statePath: path }));
  const q = await ctl.getNext();
  assert.ok(q && q.id);
  await rm(dir, { recursive: true, force: true });
});
