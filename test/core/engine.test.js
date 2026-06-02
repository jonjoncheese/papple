import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGenerationPrompt, parseQuestionsJson } from "../../src/core/engine.js";

test("prompt includes deck, count, answer mode, source text", () => {
  const p = buildGenerationPrompt({
    deckName: "ap-chem", sourceText: "MOLES AND STOICH",
    focusTopics: ["Stoichiometry"], count: 5, answerMode: "mc"
  });
  assert.ok(p.includes("ap-chem"));
  assert.ok(p.includes("5"));
  assert.ok(p.includes("MOLES AND STOICH"));
  assert.ok(p.includes("Stoichiometry"));
  assert.ok(/multiple choice|mc/i.test(p));
});

test("prompt for bank mode (no source) asks to use curriculum knowledge", () => {
  const p = buildGenerationPrompt({
    deckName: "apush", sourceText: "", focusTopics: [], count: 3, answerMode: "both"
  });
  assert.ok(/curriculum|standard|your knowledge/i.test(p));
});

test("parseQuestionsJson extracts a JSON array from fenced text", () => {
  const raw = 'Sure!\n```json\n[{"id":"x","deck":"ap-chem","topic":"T","source":"bank",' +
    '"type":"mc","question":"q","options":["a","b","c","d"],"answerIndex":0,' +
    '"explanation":"e"}]\n```\n';
  const qs = parseQuestionsJson(raw, "ap-chem");
  assert.equal(qs.length, 1);
  assert.equal(qs[0].deck, "ap-chem");
});

test("parseQuestionsJson backfills deck when model omits it", () => {
  const raw = '[{"id":"x","topic":"T","source":"bank","type":"typed",' +
    '"question":"q","answer":"a","explanation":"e"}]';
  const qs = parseQuestionsJson(raw, "apush");
  assert.equal(qs[0].deck, "apush");
});

test("parseQuestionsJson throws when no valid questions", () => {
  assert.throws(() => parseQuestionsJson("no json here", "ap-chem"));
});

test("parseQuestionsJson drops invalid items but keeps valid ones", () => {
  const raw = '[{"bad":true},{"id":"y","deck":"d","topic":"T","source":"bank",' +
    '"type":"mc","question":"q","options":["a","b","c","d"],"answerIndex":2,' +
    '"explanation":"e"}]';
  const qs = parseQuestionsJson(raw, "d");
  assert.equal(qs.length, 1);
  assert.equal(qs[0].id, "y");
});
