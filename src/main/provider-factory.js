import { createClaudeProvider } from "../core/providers/claude.js";
import { createClaudeCodeProvider } from "../core/providers/claude-code.js";
import { createGeminiProvider } from "../core/providers/gemini.js";
import { createOpenAIProvider } from "../core/providers/openai.js";

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export function buildProvider(settings, { fetchImpl = globalThis.fetch } = {}) {
  switch (settings.aiMode) {
    case "claude-code": // uses the installed Claude Code login — no key, free, slower
      return createClaudeCodeProvider();
    case "gemini": // free + fast with a Gemini API key
      return createGeminiProvider({ apiKey: settings.apiKey, model: settings.apiModel, fetchImpl });
    case "openai":
      return createOpenAIProvider({ apiKey: settings.apiKey, model: settings.apiModel, fetchImpl });
    case "claude": // Anthropic API key
      return createClaudeProvider({ apiKey: settings.apiKey, model: settings.apiModel || DEFAULT_CLAUDE_MODEL, fetchImpl });
    default:
      throw new Error(`unknown ai mode: ${settings.aiMode}`);
  }
}
