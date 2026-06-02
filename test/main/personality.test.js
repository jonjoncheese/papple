import { test } from "node:test";
import assert from "node:assert/strict";
import { pappleLine, moodFor, EVENTS } from "../../src/main/personality.js";

test("every known event returns a face + non-empty text", () => {
  for (const ev of EVENTS) {
    const line = pappleLine(ev, () => 0);
    assert.equal(typeof line.face, "string");
    assert.ok(line.text.length > 0, `empty text for ${ev}`);
  }
});

test("unknown event falls back to a neutral line, never throws", () => {
  const line = pappleLine("does-not-exist", () => 0);
  assert.ok(line.text.length > 0);
});

test("correct-answer line rotates with the rng", () => {
  const a = pappleLine("correct", () => 0).text;
  const b = pappleLine("correct", () => 0.99).text;
  assert.notEqual(a, b);
});

test("moodFor: alive streak + good score = happy", () => {
  assert.equal(moodFor({ streakAlive: true, recentScoreRate: 0.9 }), "happy");
});

test("moodFor: missed day = sad", () => {
  assert.equal(moodFor({ streakAlive: false, recentScoreRate: 0.9 }), "sad");
});

test("moodFor: alive but low score = neutral", () => {
  assert.equal(moodFor({ streakAlive: true, recentScoreRate: 0.3 }), "neutral");
});
