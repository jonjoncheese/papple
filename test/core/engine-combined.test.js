import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCombinedPrompt, generateCombinedBatch } from "../../src/core/engine.js";
import { validateQuestion } from "../../src/core/schema.js";

test("buildCombinedPrompt lists each subject and the total", () => {
  const p = buildCombinedPrompt({
    decks: [{ deck: "ap-chem", text: "" }, { deck: "apush", text: "" }],
    counts: [5, 5], answerMode: "mc", focusByDeck: {}
  });
  assert.ok(p.includes("ap-chem"));
  assert.ok(p.includes("apush"));
  assert.ok(p.includes("10")); // total across subjects
});

test("generateCombinedBatch makes ONE provider.complete call and returns N valid questions", async () => {
  let calls = 0;
  const provider = {
    async complete() {
      calls++;
      return JSON.stringify(Array.from({ length: 10 }, (_, i) => ({
        id: `x${i}`, deck: i < 5 ? "ap-chem" : "apush", topic: "T", source: "ai",
        type: "mc", question: `q${i}`, options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "e", hint: "h"
      })));
    }
  };
  const batch = await generateCombinedBatch({
    decks: [{ deck: "ap-chem", mode: "bank", text: "" }, { deck: "apush", mode: "bank", text: "" }],
    provider, count: 10, topicStats: {}, answerMode: "mc"
  });
  assert.equal(calls, 1);          // single call — NOT one per deck
  assert.equal(batch.length, 10);
  assert.ok(batch.every(q => validateQuestion(q).valid));
});
