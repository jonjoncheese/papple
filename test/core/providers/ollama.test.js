import { test } from "node:test";
import assert from "node:assert/strict";
import { createOllamaProvider } from "../../../src/core/providers/ollama.js";

function fakeFetch(responseText, capture = {}) {
  return async (url, opts) => {
    capture.url = url;
    capture.body = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ response: responseText }) };
  };
}

test("generateQuestions posts to /api/generate and returns response text", async () => {
  const cap = {};
  const provider = createOllamaProvider({
    model: "llama3.2", host: "http://localhost:11434", fetchImpl: fakeFetch("[]", cap)
  });
  const raw = await provider.generateQuestions({
    deckName: "apush", sourceText: "", focusTopics: [], count: 3, answerMode: "both"
  });
  assert.equal(raw, "[]");
  assert.ok(cap.url.endsWith("/api/generate"));
  assert.equal(cap.body.model, "llama3.2");
  assert.equal(cap.body.stream, false);
});

test("throws friendly error when Ollama unreachable", async () => {
  const provider = createOllamaProvider({
    model: "llama3.2", host: "http://localhost:11434",
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); }
  });
  await assert.rejects(
    () => provider.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" }),
    /Ollama not reachable/
  );
});
