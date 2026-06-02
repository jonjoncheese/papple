import { test } from "node:test";
import assert from "node:assert/strict";
import { topicKey, recordAnswer, weakTopics } from "../../src/core/topics.js";

test("topicKey joins deck and topic", () => {
  assert.equal(topicKey("ap-chem", "Moles"), "ap-chem::Moles");
});

test("recordAnswer increments seen, and missed when wrong", () => {
  let stats = {};
  stats = recordAnswer(stats, "ap-chem", "Moles", true);
  stats = recordAnswer(stats, "ap-chem", "Moles", false);
  assert.deepEqual(stats["ap-chem::Moles"], { seen: 2, missed: 1 });
});

test("weakTopics ranks by miss rate descending", () => {
  const stats = {
    "d::A": { seen: 10, missed: 1 },   // 0.1
    "d::B": { seen: 4, missed: 3 },    // 0.75
    "d::C": { seen: 5, missed: 2 }     // 0.4
  };
  const weak = weakTopics(stats, 2);
  assert.deepEqual(weak, [
    { key: "d::B", deck: "d", topic: "B", rate: 0.75 },
    { key: "d::C", deck: "d", topic: "C", rate: 0.4 }
  ]);
});

test("weakTopics ignores topics never seen", () => {
  const weak = weakTopics({ "d::A": { seen: 0, missed: 0 } }, 5);
  assert.equal(weak.length, 0);
});
