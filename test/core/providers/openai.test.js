import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenAIProvider } from "../../../src/core/providers/openai.js";

function fakeFetch(content, cap = {}) {
  return async (url, opts) => {
    cap.url = url; cap.headers = opts.headers; cap.body = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  };
}

test("generateQuestions posts to chat/completions with bearer auth", async () => {
  const cap = {};
  const p = createOpenAIProvider({ apiKey: "sk-x", fetchImpl: fakeFetch("[]", cap) });
  const raw = await p.generateQuestions({ deckName: "apush", sourceText: "", focusTopics: [], count: 2, answerMode: "mc" });
  assert.equal(raw, "[]");
  assert.ok(cap.url.endsWith("/v1/chat/completions"));
  assert.equal(cap.headers.authorization, "Bearer sk-x");
  assert.ok(cap.body.messages[0].content.includes("apush"));
});

test("throws on non-ok", async () => {
  const p = createOpenAIProvider({ apiKey: "k", fetchImpl: async () => ({ ok: false, status: 401, text: async () => "bad" }) });
  await assert.rejects(() => p.complete("hi"), /OpenAI API error 401/);
});
