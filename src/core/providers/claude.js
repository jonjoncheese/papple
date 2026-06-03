import { buildGenerationPrompt } from "../engine.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

async function callClaude({ apiKey, model, fetchImpl, prompt, maxTokens = 4096 }) {
  const res = await fetchImpl(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

export function createClaudeProvider({ apiKey, model, fetchImpl = globalThis.fetch }) {
  const complete = (prompt, maxTokens = 4096) => callClaude({ apiKey, model, fetchImpl, prompt, maxTokens });
  return {
    complete,
    async generateQuestions(opts) {
      return complete(buildGenerationPrompt(opts));
    },
    async gradeTyped({ question, userAnswer }) {
      const prompt = [
        `Grade this short answer. Question: "${question.question}".`,
        `Expected answer: "${question.answer}". Student answer: "${userAnswer}".`,
        `Reply ONLY with JSON: {"correct": true|false, "feedback": "one short sentence"}.`
      ].join("\n");
      const raw = await callClaude({ apiKey, model, fetchImpl, prompt, maxTokens: 256 });
      const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        return { correct: !!parsed.correct, feedback: String(parsed.feedback ?? "") };
      } catch {
        return { correct: false, feedback: "Couldn't grade that one — try rephrasing." };
      }
    },
    async hint({ question, sourceText }) {
      const prompt = [
        `Give ONE short hint (not the answer) for this question: "${question.question}".`,
        sourceText ? `Context:\n${sourceText.slice(0, 1500)}` : "",
        `Reply with just the hint sentence.`
      ].filter(Boolean).join("\n");
      const raw = await callClaude({ apiKey, model, fetchImpl, prompt, maxTokens: 128 });
      return raw.trim();
    }
  };
}
