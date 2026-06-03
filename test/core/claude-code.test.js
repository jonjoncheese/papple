import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeCodeProvider } from "../../src/core/providers/claude-code.js";

test("generateQuestions sends the built prompt to the CLI runner and returns its output", async () => {
  let received = "";
  const provider = createClaudeCodeProvider({ run: async (prompt) => { received = prompt; return "[]"; } });
  const out = await provider.generateQuestions({
    deckName: "ap-chem", sourceText: "", focusTopics: [], count: 3, answerMode: "mc"
  });
  assert.equal(out, "[]");
  assert.ok(received.includes("ap-chem"));
  assert.ok(received.includes("3"));
});

test("gradeTyped parses the CLI's JSON verdict", async () => {
  const provider = createClaudeCodeProvider({ run: async () => '{"correct": true, "feedback": "nice"}' });
  const r = await provider.gradeTyped({ question: { question: "q", answer: "a" }, userAnswer: "a" });
  assert.equal(r.correct, true);
  assert.equal(r.feedback, "nice");
});

test("gradeTyped falls back gracefully on non-JSON output", async () => {
  const provider = createClaudeCodeProvider({ run: async () => "I think so!" });
  const r = await provider.gradeTyped({ question: { question: "q", answer: "a" }, userAnswer: "a" });
  assert.equal(r.correct, false);
  assert.match(r.feedback, /rephrasing/i);
});

test("hint returns trimmed CLI output", async () => {
  const provider = createClaudeCodeProvider({ run: async () => "  consider the mole ratio  " });
  const h = await provider.hint({ question: { question: "q" }, sourceText: "" });
  assert.equal(h, "consider the mole ratio");
});
