import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProvider } from "../../src/main/provider-factory.js";

const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ content: [{ text: "[]" }], response: "[]" }) });

test("aiMode 'claude' builds a provider that hits the Anthropic endpoint", async () => {
  let calledUrl = "";
  const fi = async (url) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ content: [{ text: "[]" }] }) }; };
  const p = buildProvider({ aiMode: "claude", apiKey: "k", claudeModel: "claude-haiku-4-5-20251001" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(calledUrl.includes("api.anthropic.com"));
});

test("aiMode 'ollama' builds a provider that hits the local Ollama endpoint", async () => {
  let calledUrl = "";
  const fi = async (url) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ response: "[]" }) }; };
  const p = buildProvider({ aiMode: "ollama", ollamaModel: "llama3.2" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(calledUrl.includes("11434"));
});

test("unknown aiMode throws", () => {
  assert.throws(() => buildProvider({ aiMode: "nope" }, { fetchImpl }), /unknown ai mode/i);
});
