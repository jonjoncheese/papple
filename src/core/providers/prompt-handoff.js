// No-key provider: copy an ever-growing prompt to the clipboard, open the AI
// site the user picked, wait for them to paste the model's reply back.
// Electron (clipboard / BrowserWindow / shell) is injected at the boundary —
// this module stays Electron-free so core tests stay pure.
import { buildGenerationPrompt } from "../engine.js";

export const HANDOFF_SITES = {
  chatgpt: { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  claude:  { id: "claude",  label: "Claude",  url: "https://claude.ai/new" },
  gemini:  { id: "gemini",  label: "Gemini",  url: "https://gemini.google.com/app" }
};

export function resolveHandoffSite(siteId) {
  return HANDOFF_SITES[siteId] || HANDOFF_SITES.chatgpt;
}

/** Prefix that tells the pasted-into chatbot exactly what we need back. */
export function wrapHandoffPrompt(prompt) {
  return [
    "You are helping Papple, a local study-buddy app. Do NOT chat — reply with ONLY a JSON array of quiz questions (no markdown fences, no prose before/after).",
    "",
    prompt,
    "",
    "Remember: ONLY the JSON array. Papple will parse it directly."
  ].join("\n");
}

/**
 * @param {{ handoff: (prompt: string) => Promise<string> }} opts
 *   `handoff` is provided by the Electron main process: copy → open site → wait for paste.
 */
export function createPromptHandoffProvider({ handoff } = {}) {
  if (typeof handoff !== "function") {
    throw new Error("prompt-handoff mode needs a handoff(prompt) function from the app shell");
  }
  const complete = (prompt) => handoff(wrapHandoffPrompt(prompt));
  return {
    complete,
    async generateQuestions(opts) {
      return complete(buildGenerationPrompt(opts));
    },
    // No second round-trip to a website for grading/hints — keep it local.
    async gradeTyped({ question, userAnswer }) {
      const norm = s => String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
      const e = norm(question.answer), g = norm(userAnswer);
      const correct = g.length > 0 && (g === e || e.includes(g) || g.includes(e));
      return { correct, feedback: correct ? "correct! 🍍" : `expected: ${question.answer}` };
    },
    async hint({ question }) {
      return question.hint || `Think about the key idea behind "${question.topic}". You've got this 🍍`;
    }
  };
}
