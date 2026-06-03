import { test } from "node:test";
import assert from "node:assert/strict";
import { createGeminiProvider } from "../../../src/core/providers/gemini.js";

function fakeFetch(text, cap = {}) {
  return async (url, opts) => {
    cap.url = url; cap.body = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
  };
}

test("generateQuestions posts the prompt to :generateContent and returns the text", async () => {
  const cap = {};
  const p = createGeminiProvider({ apiKey: "k", model: "gemini-2.0-flash", fetchImpl: fakeFetch("[]", cap) });
  const raw = await p.generateQuestions({ deckName: "ap-chem", sourceText: "", focusTopics: [], count: 3, answerMode: "mc" });
  assert.equal(raw, "[]");
  assert.ok(cap.url.includes("gemini-2.0-flash:generateContent"));
  assert.ok(cap.body.contents[0].parts[0].text.includes("ap-chem"));
});

test("throws a friendly error on non-ok", async () => {
  const p = createGeminiProvider({ apiKey: "k", fetchImpl: async () => ({ ok: false, status: 403, text: async () => "denied" }) });
  await assert.rejects(() => p.complete("hi"), /Gemini API error 403/);
});
