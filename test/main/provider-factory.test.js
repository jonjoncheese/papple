import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProvider } from "../../src/main/provider-factory.js";

function captureFetch(json) {
  const cap = {};
  return { cap, fi: async (url, opts) => { cap.url = url; cap.opts = opts; return { ok: true, status: 200, json: async () => json }; } };
}

test("aiMode 'claude' hits the Anthropic endpoint", async () => {
  const { cap, fi } = captureFetch({ content: [{ text: "[]" }] });
  const p = buildProvider({ aiMode: "claude", apiKey: "k", apiModel: "claude-haiku-4-5-20251001" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(cap.url.includes("api.anthropic.com"));
});

test("aiMode 'gemini' hits the Google Generative Language endpoint with the key", async () => {
  const { cap, fi } = captureFetch({ candidates: [{ content: { parts: [{ text: "[]" }] } }] });
  const p = buildProvider({ aiMode: "gemini", apiKey: "gk" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(cap.url.includes("generativelanguage.googleapis.com"));
  assert.ok(cap.url.includes("key=gk"));
});

test("aiMode 'openai' hits the OpenAI endpoint with a bearer token", async () => {
  const { cap, fi } = captureFetch({ choices: [{ message: { content: "[]" } }] });
  const p = buildProvider({ aiMode: "openai", apiKey: "sk-x" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(cap.url.includes("api.openai.com"));
  assert.equal(cap.opts.headers.authorization, "Bearer sk-x");
});

test("unknown aiMode throws", () => {
  assert.throws(() => buildProvider({ aiMode: "nope" }, { fetchImpl: async () => ({}) }), /unknown ai mode/i);
});
