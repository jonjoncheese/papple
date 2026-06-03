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

function deps(statePath, extra = {}) {
  return {
    loadState, saveState, statePath, now: fixedNow,
    loadActiveDecks: async () => [{ deck: "d", mode: "bank", text: "" }],
    buildProvider: () => ({
      async complete() {
        return JSON.stringify(Array.from({ length: 12 }, (_, i) => ({
          id: `q${i}`, deck: "d", topic: "T", source: "bank",
          type: "mc", question: `q${i}`, options: ["a","b","c","d"], answerIndex: 1, explanation: "because"
        })));
      },
      async gradeTyped() { return { correct: true, feedback: "good" }; },
      async hint() { return "think harder"; },
      ...extra.provider
    }),
    generateCombinedBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  };
}

async function setup(questionsPerDay = 2) {
  const dir = await mkdtemp(join(tmpdir(), "papans-"));
  const path = join(dir, "state.json");
  const s = defaultState();
  s.settings.questionsPerDay = questionsPerDay;
  await saveState(path, s);
  return { dir, path };
}

test("submitAnswer grades MC, records score + topic stats", async () => {
  const { dir, path } = await setup(2);
  const ctl = createController(deps(path));
  await ctl.ensureTodayBatch();
  const r = await ctl.submitAnswer("q0", { selectedIndex: 1 });
  assert.equal(r.correct, true);
  assert.equal(r.explanation, "because");
  const state = await loadState(path);
  assert.equal(state.today.progress.q0.answered, true);
  assert.equal(state.dailyScores["2026-06-02"].correct, 1);
  assert.equal(state.dailyScores["2026-06-02"].total, 1);
  assert.equal(state.topicStats["d::T"].seen, 1);
  await rm(dir, { recursive: true, force: true });
});

test("finishing all questions bumps the streak", async () => {
  const { dir, path } = await setup(2);
  const ctl = createController(deps(path));
  await ctl.ensureTodayBatch();
  await ctl.submitAnswer("q0", { selectedIndex: 1 });
  await ctl.submitAnswer("q1", { selectedIndex: 0 });
  const state = await loadState(path);
  assert.equal(state.streak.count, 1);
  assert.equal(state.streak.lastCompletedDate, "2026-06-02");
  await rm(dir, { recursive: true, force: true });
});

test("submitAnswer on a typed question uses provider.gradeTyped", async () => {
  const { dir, path } = await setup(1);
  const ctl = createController({
    ...deps(path),
    buildProvider: () => ({
      async complete() {
        return JSON.stringify(Array.from({ length: 3 }, (_, i) => ({
          id: `t${i}`, deck: "d", topic: "T", source: "bank",
          type: "typed", question: `q${i}`, answer: "42", explanation: "e"
        })));
      },
      async gradeTyped({ userAnswer }) { return { correct: userAnswer === "42", feedback: "f" }; },
      async hint() { return "h"; }
    })
  });
  await ctl.ensureTodayBatch();
  const r = await ctl.submitAnswer("t0", { typedAnswer: "42" });
  assert.equal(r.correct, true);
  await rm(dir, { recursive: true, force: true });
});

test("getStatus returns streak, today score, and a mood", async () => {
  const { dir, path } = await setup(2);
  const ctl = createController(deps(path));
  await ctl.ensureTodayBatch();
  await ctl.submitAnswer("q0", { selectedIndex: 1 });
  const st = await ctl.getStatus();
  assert.equal(st.streak, 0);
  assert.equal(st.today.correct, 1);
  assert.ok(["happy","neutral","sad"].includes(st.mood));
  await rm(dir, { recursive: true, force: true });
});
