import { test } from "node:test";
import assert from "node:assert/strict";
import { distributeCounts, generateDailyBatch } from "../../src/core/engine.js";

test("distributeCounts splits total across decks as evenly as possible", () => {
  assert.deepEqual(distributeCounts(10, 3), [4, 3, 3]);
  assert.deepEqual(distributeCounts(10, 2), [5, 5]);
  assert.deepEqual(distributeCounts(2, 5), [1, 1, 0, 0, 0]);
});

function fakeProvider(makeRaw) {
  return {
    async generateQuestions({ deckName, count }) {
      const items = Array.from({ length: count }, (_, i) => ({
        id: `${deckName}-${i}`, deck: deckName, topic: "T", source: "bank",
        type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 0,
        explanation: "e"
      }));
      return makeRaw ? makeRaw(deckName, items) : JSON.stringify(items);
    }
  };
}

test("generateDailyBatch aggregates questions across decks up to total", async () => {
  const decks = [
    { deck: "ap-chem", mode: "bank", text: "" },
    { deck: "apush", mode: "bank", text: "" }
  ];
  const batch = await generateDailyBatch({
    decks, provider: fakeProvider(), count: 6, topicStats: {}, answerMode: "mc"
  });
  assert.equal(batch.length, 6);
  const decksSeen = new Set(batch.map(q => q.deck));
  assert.deepEqual([...decksSeen].sort(), ["ap-chem", "apush"]);
});

test("generateDailyBatch skips a failing deck but still returns others", async () => {
  const decks = [
    { deck: "good", mode: "bank", text: "" },
    { deck: "bad", mode: "bank", text: "" }
  ];
  const provider = {
    async generateQuestions({ deckName, count }) {
      if (deckName === "bad") throw new Error("provider down for bad");
      const items = Array.from({ length: count }, (_, i) => ({
        id: `good-${i}`, deck: "good", topic: "T", source: "bank",
        type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 0, explanation: "e"
      }));
      return JSON.stringify(items);
    }
  };
  const batch = await generateDailyBatch({ decks, provider, count: 4, topicStats: {}, answerMode: "mc" });
  assert.ok(batch.length > 0);
  assert.ok(batch.every(q => q.deck === "good"));
});

test("generateDailyBatch throws if every deck fails", async () => {
  const decks = [{ deck: "x", mode: "bank", text: "" }];
  const provider = { async generateQuestions() { throw new Error("down"); } };
  await assert.rejects(
    () => generateDailyBatch({ decks, provider, count: 3, topicStats: {}, answerMode: "mc" }),
    /could not generate any questions/i
  );
});
