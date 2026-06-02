import { test } from "node:test";
import assert from "node:assert/strict";
import { dayDiff, recordCompletion } from "../../src/core/streak.js";

test("dayDiff counts whole days", () => {
  assert.equal(dayDiff("2026-06-01", "2026-06-02"), 1);
  assert.equal(dayDiff("2026-06-01", "2026-06-01"), 0);
  assert.equal(dayDiff("2026-06-01", "2026-06-05"), 4);
});

test("first completion sets streak to 1", () => {
  const s = recordCompletion({ count: 0, lastCompletedDate: null }, "2026-06-02");
  assert.deepEqual(s, { count: 1, lastCompletedDate: "2026-06-02" });
});

test("consecutive day increments", () => {
  const s = recordCompletion({ count: 3, lastCompletedDate: "2026-06-01" }, "2026-06-02");
  assert.equal(s.count, 4);
});

test("same day is a no-op on count", () => {
  const s = recordCompletion({ count: 3, lastCompletedDate: "2026-06-02" }, "2026-06-02");
  assert.equal(s.count, 3);
});

test("gap resets to 1", () => {
  const s = recordCompletion({ count: 9, lastCompletedDate: "2026-06-01" }, "2026-06-05");
  assert.equal(s.count, 1);
});
