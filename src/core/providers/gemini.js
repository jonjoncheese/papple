// Google Gemini provider — direct API (no CLI cold-start), and the API key is
// free with a fast tier, so this is the recommended default for new users.
import { buildGenerationPrompt } from "../engine.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash"; // 2.0-flash has no free-tier quota on many projects; 2.5-flash does

async function callGemini({ apiKey, model, fetchImpl, prompt }) {
  const url = `${BASE}/${model || DEFAULT_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

export function createGeminiProvider({ apiKey, model, fetchImpl = globalThis.fetch }) {
  const complete = (prompt) => callGemini({ apiKey, model, fetchImpl, prompt });
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
