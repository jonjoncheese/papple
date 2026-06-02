import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuietHours, nextUnanswered, isHydrationDue } from "../../src/core/scheduler.js";

test("isQuietHours handles overnight window (22 -> 7)", () => {
  assert.equal(isQuietHours(23, 22, 7), true);
  assert.equal(isQuietHours(3, 22, 7), true);
  assert.equal(isQuietHours(12, 22, 7), false);
  assert.equal(isQuietHours(7, 22, 7), false); // end exclusive
});

test("isQuietHours handles same-day window (1 -> 5)", () => {
  assert.equal(isQuietHours(3, 1, 5), true);
  assert.equal(isQuietHours(6, 1, 5), false);
});

test("nextUnanswered returns first question with no answered progress", () => {
  const batch = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const progress = { a: { answered: true, correct: true } };
  assert.equal(nextUnanswered(batch, progress).id, "b");
});

test("nextUnanswered returns null when all answered", () => {
  const batch = [{ id: "a" }];
  assert.equal(nextUnanswered(batch, { a: { answered: true } }), null);
});

test("isHydrationDue true after interval, false before", () => {
  const now = 1_000_000;
  const intervalMs = 60_000;
  assert.equal(isHydrationDue(now - 70_000, now, intervalMs), true);
  assert.equal(isHydrationDue(now - 10_000, now, intervalMs), false);
});

test("isHydrationDue true when never reminded (null)", () => {
  assert.equal(isHydrationDue(null, 1000, 60_000), true);
});
