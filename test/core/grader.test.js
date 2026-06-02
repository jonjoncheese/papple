import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeMc } from "../../src/core/grader.js";

const q = {
  id: "q1", type: "mc", question: "2+2?", options: ["3","4","5","6"],
  answerIndex: 1, explanation: "It's 4."
};

test("correct selection grades correct", () => {
  const r = gradeMc(q, 1);
  assert.equal(r.correct, true);
  assert.equal(r.correctIndex, 1);
  assert.equal(r.explanation, "It's 4.");
});

test("wrong selection grades incorrect", () => {
  const r = gradeMc(q, 0);
  assert.equal(r.correct, false);
  assert.equal(r.correctIndex, 1);
});

test("throws on non-mc question", () => {
  assert.throws(() => gradeMc({ ...q, type: "typed" }, 1));
});
