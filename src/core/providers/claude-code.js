// Provider that uses the user's installed + logged-in Claude Code CLI (`claude -p`).
// Gives real Claude-quality questions with NO API key — it rides the user's
// existing Claude Code authentication. The CLI runner is injectable for testing.
import { spawn } from "node:child_process";
import { buildGenerationPrompt } from "../engine.js";

function defaultRun(prompt, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--model", "haiku"], { shell: true });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Claude Code timed out")); }, timeoutMs);
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (err += d));
    child.on("error", e => {
      clearTimeout(timer);
      reject(new Error(`Claude Code CLI not found — is it installed and logged in? ${e.message}`));
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Claude Code exited ${code}: ${err.slice(0, 200)}`));
      else resolve(out.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export function createClaudeCodeProvider({ run = defaultRun } = {}) {
  return {
    async generateQuestions(opts) {
      return run(buildGenerationPrompt(opts));
    },
    async gradeTyped({ question, userAnswer }) {
      const prompt = [
        `Grade this short answer. Question: "${question.question}".`,
        `Expected answer: "${question.answer}". Student answer: "${userAnswer}".`,
        `Reply ONLY with JSON: {"correct": true|false, "feedback": "one short sentence"}.`
      ].join("\n");
      const raw = await run(prompt);
      const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
      try {
        const p = JSON.parse(raw.slice(s, e + 1));
        return { correct: !!p.correct, feedback: String(p.feedback ?? "") };
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
      return (await run(prompt)).trim();
    }
  };
}
