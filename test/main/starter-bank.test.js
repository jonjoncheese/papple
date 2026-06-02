import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuestion } from "../../src/core/schema.js";
import { STARTER_QUESTIONS, starterBatch } from "../../src/main/starter-bank.js";

test("every starter question is schema-valid", () => {
  for (const q of STARTER_QUESTIONS) {
    const r = validateQuestion(q);
    assert.ok(r.valid, `invalid: ${q.id} -> ${r.errors.join("; ")}`);
  }
});

test("starterBatch (mc mode) returns 1..count multiple-choice questions", () => {
  const b = starterBatch(5, "mc");
  assert.ok(b.length > 0 && b.length <= 5);
  assert.ok(b.every(q => q.type === "mc"));
});

test("starterBatch (typed mode) returns only typed questions", () => {
  const b = starterBatch(10, "typed");
  assert.ok(b.length > 0);
  assert.ok(b.every(q => q.type === "typed"));
});

test("starterBatch (both) caps at count", () => {
  assert.equal(starterBatch(3, "both").length, 3);
});
