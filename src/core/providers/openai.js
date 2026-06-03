// OpenAI provider — direct chat-completions API (fast, paid).
import { buildGenerationPrompt } from "../engine.js";

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

async function callOpenAI({ apiKey, model, fetchImpl, prompt }) {
  const res = await fetchImpl(API_URL, {
    method: "POST",
    headers: { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: model || DEFAULT_MODEL, messages: [{ role: "user", content: prompt }] })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export function createOpenAIProvider({ apiKey, model, fetchImpl = globalThis.fetch }) {
  const complete = (prompt) => callOpenAI({ apiKey, model, fetchImpl, prompt });
  return {
    complete,
    async generateQuestions(opts) { return complete(buildGenerationPrompt(opts)); },
    async gradeTyped({ question, userAnswer }) {
      const raw = await complete(
        `Grade this short answer. Question: "${question.question}". Expected: "${question.answer}". ` +
        `Student: "${userAnswer}". Reply ONLY JSON: {"correct": true|false, "feedback": "one short sentence"}.`
      );
      const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
      try { const p = JSON.parse(raw.slice(s, e + 1)); return { correct: !!p.correct, feedback: String(p.feedback ?? "") }; }
      catch { return { correct: false, feedback: "Couldn't grade that one — try rephrasing." }; }
    },
    async hint({ question }) {
      return (await complete(`Give ONE short hint (not the answer) for: "${question.question}". Just the hint sentence.`)).trim();
    }
  };
}
