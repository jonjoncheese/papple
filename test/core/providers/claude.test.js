import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeProvider } from "../../../src/core/providers/claude.js";

function fakeFetch(responseText, capture = {}) {
  return async (url, opts) => {
    capture.url = url;
    capture.body = JSON.parse(opts.body);
    capture.headers = opts.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: responseText }] })
    };
  };
}

test("generateQuestions returns raw model text and calls messages endpoint", async () => {
  const cap = {};
  const provider = createClaudeProvider({
    apiKey: "sk-test", model: "claude-haiku-4-5-20251001",
    fetchImpl: fakeFetch("[]", cap)
  });
  const raw = await provider.generateQuestions({
    deckName: "ap-chem", sourceText: "x", focusTopics: [], count: 5, answerMode: "mc"
  });
  assert.equal(raw, "[]");
  assert.ok(cap.url.includes("/v1/messages"));
  assert.equal(cap.headers["x-api-key"], "sk-test");
  assert.ok(cap.body.messages[0].content.includes("ap-chem"));
});

test("gradeTyped parses correctness JSON from model", async () => {
  const provider = createClaudeProvider({
    apiKey: "k", model: "m",
    fetchImpl: fakeFetch('{"correct": true, "feedback": "nice"}')
  });
  const r = await provider.gradeTyped({
    question: { question: "Avogadro?", answer: "6.022e23" }, userAnswer: "6.022e23"
  });
  assert.equal(r.correct, true);
  assert.equal(r.feedback, "nice");
});

test("hint returns trimmed model text", async () => {
  const provider = createClaudeProvider({
    apiKey: "k", model: "m", fetchImpl: fakeFetch("  think about moles  ")
  });
  const h = await provider.hint({
    question: { question: "q" }, sourceText: ""
  });
  assert.equal(h, "think about moles");
});

test("throws a friendly error when API returns non-ok", async () => {
  const provider = createClaudeProvider({
    apiKey: "k", model: "m",
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "unauthorized" })
  });
  await assert.rejects(
    () => provider.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" }),
    /Claude API error 401/
  );
});
