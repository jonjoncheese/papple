import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuestion, assertValidQuestion } from "../../src/core/schema.js";

const baseMc = {
  id: "q1", deck: "ap-chem", topic: "Stoichiometry", source: "bank",
  type: "mc", question: "2+2?", options: ["3","4","5","6"],
  answerIndex: 1, explanation: "It's 4."
};
const baseTyped = {
  id: "q2", deck: "ap-chem", topic: "Moles", source: "bank",
  type: "typed", question: "Avogadro's number?", answer: "6.022e23",
  explanation: "Definition."
};

test("valid mc question passes", () => {
  assert.equal(validateQuestion(baseMc).valid, true);
});

test("valid typed question passes", () => {
  assert.equal(validateQuestion(baseTyped).valid, true);
});

test("mc with bad answerIndex fails", () => {
  const r = validateQuestion({ ...baseMc, answerIndex: 9 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes("answerIndex")));
});

test("mc needing 4 options fails with 2", () => {
  const r = validateQuestion({ ...baseMc, options: ["a","b"] });
  assert.equal(r.valid, false);
});

test("unknown type fails", () => {
  const r = validateQuestion({ ...baseMc, type: "essay" });
  assert.equal(r.valid, false);
});

test("missing required field fails", () => {
  const { question, ...noQ } = baseMc;
  assert.equal(validateQuestion(noQ).valid, false);
});

test("assertValidQuestion throws on invalid", () => {
  assert.throws(() => assertValidQuestion({ ...baseMc, type: "x" }));
});
