import { buildGenerationPrompt } from "../engine.js";

async function callOllama({ host, model, fetchImpl, prompt }) {
  let res;
  try {
    res = await fetchImpl(`${host}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false })
    });
  } catch (err) {
    throw new Error(`Ollama not reachable at ${host}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}`);
  }
  const data = await res.json();
  return (data.response ?? "").trim();
}

export function createOllamaProvider({ model, host = "http://localhost:11434", fetchImpl = globalThis.fetch }) {
  return {
    async generateQuestions(opts) {
      return callOllama({ host, model, fetchImpl, prompt: buildGenerationPrompt(opts) });
    },
    async gradeTyped({ question, userAnswer }) {
      const prompt = [
        `Grade this short answer. Question: "${question.question}".`,
        `Expected: "${question.answer}". Student: "${userAnswer}".`,
        `Reply ONLY JSON: {"correct": true|false, "feedback": "short"}.`
      ].join("\n");
      const raw = await callOllama({ host, model, fetchImpl, prompt });
      const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        return { correct: !!parsed.correct, feedback: String(parsed.feedback ?? "") };
      } catch {
        return { correct: false, feedback: "Couldn't grade that one — try rephrasing." };
      }
    },
    async hint({ question, sourceText }) {
      const prompt = `Give ONE short hint (not the answer) for: "${question.question}".`;
      return (await callOllama({ host, model, fetchImpl, prompt })).trim();
    }
  };
}
